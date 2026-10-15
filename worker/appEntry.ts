import authWorker from "./entry";

type D1 = any;
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1;
  BOOK_COVERS?: any;
  BOOK_ASSETS?: any;
  BOOKNOMICS_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

type SafeUser = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const cookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) result.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return result;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

async function currentUser(request: Request, db: D1): Promise<SafeUser | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.avatar_url
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first();
  return row ? (row as SafeUser) : null;
}

async function requireUser(request: Request, env: Env) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const user = await currentUser(request, env.DB);
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  return { user, response: null };
}

async function getLibrary(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const rows = await env.DB!.prepare(
    `SELECT b.id, COALESCE(b.seo_slug, b.slug) AS slug, b.title, b.author, b.category,
            b.cover_color, b.cover_url, b.tagline, b.rating, b.reading_time,
            COALESCE(rp.completed, 0) AS read
     FROM library l
     JOIN books b ON b.id = l.book_id
     LEFT JOIN reading_progress rp ON rp.user_id = l.user_id AND rp.book_id = l.book_id
     WHERE l.user_id = ? AND b.is_draft = 0 AND b.status IN ('published','published_noindex')
     ORDER BY datetime(l.created_at) DESC`,
  )
    .bind(auth.user!.id)
    .all();
  return json({ data: (rows.results || []).map((row: any) => ({ ...row, read: Boolean(row.read) })) });
}

async function getLibraryStatus(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const bookId = url.searchParams.get("book_id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const row = await env.DB!.prepare("SELECT 1 AS ok FROM library WHERE user_id = ? AND book_id = ? LIMIT 1")
    .bind(auth.user!.id, bookId)
    .first();
  return json({ saved: Boolean(row) });
}

async function toggleLibrary(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as { book_id?: string; saved?: boolean } | null;
  const bookId = body?.book_id || "";
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });

  const existing = await env.DB!.prepare("SELECT id FROM library WHERE user_id = ? AND book_id = ? LIMIT 1")
    .bind(auth.user!.id, bookId)
    .first();
  const shouldSave = typeof body?.saved === "boolean" ? body.saved : !existing;
  if (shouldSave && !existing) {
    await env.DB!.prepare("INSERT INTO library (id, user_id, book_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), auth.user!.id, bookId, new Date().toISOString())
      .run();
  } else if (!shouldSave && existing) {
    await env.DB!.prepare("DELETE FROM library WHERE user_id = ? AND book_id = ?")
      .bind(auth.user!.id, bookId)
      .run();
  }
  return json({ saved: shouldSave });
}

async function updateReadingProgress(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as { book_id?: string; completed?: boolean } | null;
  const bookId = body?.book_id || "";
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const completed = body?.completed ? 1 : 0;
  const now = new Date().toISOString();
  await env.DB!.prepare(
    `INSERT INTO reading_progress (id, user_id, book_id, completed, last_read_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, book_id) DO UPDATE SET completed = excluded.completed, last_read_at = excluded.last_read_at`,
  )
    .bind(crypto.randomUUID(), auth.user!.id, bookId, completed, now)
    .run();
  return json({ ok: true, completed: Boolean(completed) });
}

async function getDashboard(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const userId = auth.user!.id;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const profile = await env.DB!.prepare("SELECT streak_count, last_active_date FROM profiles WHERE id = ? LIMIT 1")
    .bind(userId)
    .first();
  let streak = Number(profile?.streak_count || 0);
  const last = profile?.last_active_date ? String(profile.last_active_date) : null;
  if (last !== today) {
    streak = last === yesterday ? streak + 1 : 1;
    await env.DB!.prepare("UPDATE profiles SET streak_count = ?, last_active_date = ? WHERE id = ?")
      .bind(streak, today, userId)
      .run();
  }

  const [progress, habits, recent, mastery] = await Promise.all([
    env.DB!.prepare(
      `SELECT rp.completed, b.reading_time, b.category
       FROM reading_progress rp JOIN books b ON b.id = rp.book_id
       WHERE rp.user_id = ?`,
    ).bind(userId).all(),
    env.DB!.prepare("SELECT done FROM habit_entries WHERE user_id = ?").bind(userId).all(),
    env.DB!.prepare(
      `SELECT b.id, COALESCE(b.seo_slug, b.slug) AS slug, b.title, b.author, b.cover_color, b.cover_url, b.category
       FROM library l JOIN books b ON b.id = l.book_id
       WHERE l.user_id = ? ORDER BY datetime(l.created_at) DESC LIMIT 8`,
    ).bind(userId).all(),
    env.DB!.prepare(
      `SELECT ubm.book_id, ubm.quiz_score, ubm.quiz_total, ubm.badge_awarded,
              b.title, COALESCE(b.seo_slug, b.slug) AS slug, b.cover_color, b.cover_url
       FROM user_book_mastery ubm JOIN books b ON b.id = ubm.book_id
       WHERE ubm.user_id = ? AND ubm.badge_awarded = 1
       ORDER BY datetime(ubm.completed_at) DESC LIMIT 6`,
    ).bind(userId).all(),
  ]);

  const progressRows = (progress.results || []) as any[];
  const habitRows = (habits.results || []) as any[];
  const recentRows = (recent.results || []) as any[];
  const masteryRows = (mastery.results || []) as any[];
  const completedRows = progressRows.filter((row) => Boolean(row.completed));
  const totalMinSaved = completedRows.reduce((sum, row) => sum + (Number(row.reading_time || 12) * 25), 0);
  const counts: Record<string, number> = {};
  for (const row of recentRows) if (row.category) counts[row.category] = (counts[row.category] || 0) + 1;
  for (const row of completedRows) if (row.category) counts[row.category] = (counts[row.category] || 0) + 1;

  const badges = masteryRows.map((row) => ({
    book_id: row.book_id,
    quiz_score: Number(row.quiz_score || 0),
    quiz_total: Number(row.quiz_total || 0),
    badge_awarded: Boolean(row.badge_awarded),
    books: {
      title: row.title,
      slug: row.slug,
      cover_color: row.cover_color,
      cover_url: row.cover_url,
    },
  }));

  return json({
    streak,
    stats: {
      completed: completedRows.length,
      inProgress: progressRows.filter((row) => !row.completed).length,
      totalHabits: habitRows.length,
      doneHabits: habitRows.filter((row) => Boolean(row.done)).length,
      hoursSaved: Math.round(totalMinSaved / 60),
      masterBadges: badges.length,
    },
    recent: recentRows.slice(0, 4),
    categoryMap: Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    badges,
  });
}

async function getBookContext(request: Request, env: Env, bookId: string) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "";
  const language = url.searchParams.get("language") || "";
  const alternateBookId = url.searchParams.get("alternate_book_id") || "";

  const [related, sameLang, reviews, links] = await Promise.all([
    category
      ? env.DB.prepare(
          `SELECT id, COALESCE(seo_slug, slug) AS slug, title, author, category, cover_color, cover_url, tagline, rating, reading_time
           FROM books WHERE is_draft = 0 AND status IN ('published','published_noindex') AND category = ? AND id <> ? LIMIT 6`,
        ).bind(category, bookId).all()
      : Promise.resolve({ results: [] }),
    language
      ? env.DB.prepare(
          `SELECT id, COALESCE(seo_slug, slug) AS slug, title, author, category, cover_color, cover_url, tagline, rating, reading_time
           FROM books WHERE is_draft = 0 AND status IN ('published','published_noindex') AND language = ? AND id <> ?
           AND (? = '' OR category <> ?) LIMIT 4`,
        ).bind(language, bookId, category, category).all()
      : Promise.resolve({ results: [] }),
    env.DB.prepare(
      `SELECT rating, content, created_at FROM book_reviews
       WHERE book_id = ? ORDER BY upvote_count DESC, datetime(created_at) DESC LIMIT 50`,
    ).bind(bookId).all(),
    language
      ? env.DB.prepare(
          `SELECT title, COALESCE(seo_slug, slug) AS slug FROM books
           WHERE is_draft = 0 AND status IN ('published','published_noindex') AND language = ? AND id <> ? LIMIT 120`,
        ).bind(language, bookId).all()
      : Promise.resolve({ results: [] }),
  ]);

  const reviewRows = (reviews.results || []) as any[];
  const avg = reviewRows.length
    ? reviewRows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviewRows.length
    : 0;
  const top = reviewRows.find((row) => row.content && String(row.content).trim().length > 20) || null;
  let counterpart = null;
  if (/^[0-9a-f-]{36}$/i.test(alternateBookId)) {
    const row = await env.DB.prepare(
      `SELECT COALESCE(seo_slug, slug) AS slug, language FROM books
       WHERE id = ? AND is_draft = 0 AND status IN ('published','published_noindex') LIMIT 1`,
    ).bind(alternateBookId).first();
    if (row) counterpart = { slug: row.slug, language: row.language };
  }

  return json({
    related: related.results || [],
    sameLang: sameLang.results || [],
    reviewStats: { count: reviewRows.length, avg: Math.round(avg * 10) / 10, top },
    linkTargets: links.results || [],
    counterpart,
  }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/library" && request.method === "GET") return getLibrary(request, env);
    if (pathname === "/api/library/status" && request.method === "GET") return getLibraryStatus(request, env);
    if (pathname === "/api/library/toggle" && request.method === "POST") return toggleLibrary(request, env);
    if (pathname === "/api/reading-progress" && request.method === "POST") return updateReadingProgress(request, env);
    if (pathname === "/api/dashboard" && request.method === "GET") return getDashboard(request, env);
    if (pathname.startsWith("/api/book-context/") && request.method === "GET") {
      return getBookContext(request, env, decodeURIComponent(pathname.slice("/api/book-context/".length)));
    }

    return authWorker.fetch(request, env as any);
  },
};
