type D1 = any;
type Env = { DB?: D1 };
type SafeUser = { id: string; email: string };

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
  const row = await db.prepare(
    `SELECT u.id, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`,
  ).bind(tokenHash).first();
  return row ? row as SafeUser : null;
}

async function requireUser(request: Request, env: Env) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const user = await currentUser(request, env.DB);
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  return { user, response: null };
}

function randomReferralCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function ensureReferralCode(db: D1, userId: string) {
  const existing = await db.prepare("SELECT referral_code FROM profiles WHERE id = ? LIMIT 1").bind(userId).first();
  if (existing?.referral_code) return String(existing.referral_code);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomReferralCode();
    const used = await db.prepare("SELECT 1 AS ok FROM profiles WHERE referral_code = ? LIMIT 1").bind(code).first();
    if (used) continue;
    await db.prepare(
      "UPDATE profiles SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR trim(referral_code) = '')",
    ).bind(code, userId).run();
    const row = await db.prepare("SELECT referral_code FROM profiles WHERE id = ? LIMIT 1").bind(userId).first();
    if (row?.referral_code) return String(row.referral_code);
  }
  throw new Error("Could not allocate referral code");
}

async function referralMe(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const user = auth.user!;
  const code = await ensureReferralCode(env.DB!, user.id);
  const row = await env.DB!.prepare(
    "SELECT COUNT(*) AS count FROM referrals WHERE referrer_user_id = ?",
  ).bind(user.id).first();
  return json({ code, count: Number(row?.count || 0) });
}

async function claimReferral(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const user = auth.user!;
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return json({ error: "Invalid referral code" }, { status: 400 });

  const referrer = await env.DB!.prepare(
    "SELECT id FROM profiles WHERE upper(referral_code) = ? LIMIT 1",
  ).bind(code).first();
  if (!referrer || String(referrer.id) === user.id) return json({ ok: true, claimed: false });

  const existing = await env.DB!.prepare(
    "SELECT referrer_user_id FROM referrals WHERE referred_user_id = ? LIMIT 1",
  ).bind(user.id).first();
  if (existing) return json({ ok: true, claimed: false, referrer_user_id: existing.referrer_user_id });

  await env.DB!.prepare(
    `INSERT OR IGNORE INTO referrals (id, referrer_user_id, referred_user_id, created_at)
     VALUES (?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), String(referrer.id), user.id, new Date().toISOString()).run();

  const recorded = await env.DB!.prepare(
    "SELECT referrer_user_id FROM referrals WHERE referred_user_id = ? LIMIT 1",
  ).bind(user.id).first();
  return json({ ok: true, claimed: !!recorded, referrer_user_id: recorded?.referrer_user_id || null });
}

async function listLearningPaths(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const user = await currentUser(request, env.DB);
  const userId = user?.id || null;
  const result = await env.DB.prepare(
    `SELECT
       lp.id, lp.slug, lp.title, lp.description, lp.theme_color, lp.icon,
       COUNT(lpb.book_id) AS total,
       COALESCE(SUM(CASE WHEN rp.completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
       MAX(CASE WHEN pe.id IS NOT NULL THEN 1 ELSE 0 END) AS enrolled
     FROM learning_paths lp
     LEFT JOIN learning_path_books lpb ON lpb.path_id = lp.id
     LEFT JOIN reading_progress rp
       ON rp.book_id = lpb.book_id AND rp.user_id = ?
     LEFT JOIN path_enrollments pe
       ON pe.path_id = lp.id AND pe.user_id = ?
     GROUP BY lp.id, lp.slug, lp.title, lp.description, lp.theme_color, lp.icon, lp.sort_order
     ORDER BY lp.sort_order ASC, lp.title ASC`,
  ).bind(userId, userId).all();

  const paths = (result?.results || []).map((row: any) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    theme_color: String(row.theme_color),
    icon: String(row.icon),
    total: Number(row.total || 0),
    completed: Number(row.completed || 0),
    enrolled: Number(row.enrolled || 0) === 1,
  }));
  return json({ paths });
}

async function learningPathDetail(request: Request, env: Env, slug: string) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  if (!slug || slug.length > 200) return json({ error: "Bad path slug" }, { status: 400 });
  const path = await env.DB.prepare(
    `SELECT id, slug, title, description, theme_color, icon, sort_order, created_at
     FROM learning_paths WHERE slug = ? LIMIT 1`,
  ).bind(slug).first();
  if (!path) return json({ error: "Path not found" }, { status: 404 });

  const user = await currentUser(request, env.DB);
  const userId = user?.id || null;
  const rows = await env.DB.prepare(
    `SELECT b.id, b.slug, b.title, b.author, b.cover_color, b.cover_url, b.tagline, b.reading_time,
            lpb.position, CASE WHEN rp.completed = 1 THEN 1 ELSE 0 END AS completed
     FROM learning_path_books lpb
     JOIN books b ON b.id = lpb.book_id
     LEFT JOIN reading_progress rp ON rp.book_id = b.id AND rp.user_id = ?
     WHERE lpb.path_id = ?
     ORDER BY lpb.position ASC`,
  ).bind(userId, path.id).all();

  let enrolled = false;
  if (userId) {
    const enrollment = await env.DB.prepare(
      "SELECT 1 AS ok FROM path_enrollments WHERE user_id = ? AND path_id = ? LIMIT 1",
    ).bind(userId, path.id).first();
    enrolled = !!enrollment;
  }

  const books = (rows?.results || []).map((row: any) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    author: String(row.author),
    cover_color: row.cover_color == null ? null : String(row.cover_color),
    cover_url: row.cover_url == null ? null : String(row.cover_url),
    tagline: row.tagline == null ? null : String(row.tagline),
    reading_time: row.reading_time == null ? null : Number(row.reading_time),
    position: Number(row.position || 0),
    completed: Number(row.completed || 0) === 1,
  }));

  return json({ path, books, enrolled });
}

async function setEnrollment(request: Request, env: Env, pathId: string, enrolled: boolean) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const user = auth.user!;
  if (!pathId || pathId.length > 100) return json({ error: "Bad path id" }, { status: 400 });

  const path = await env.DB!.prepare("SELECT id FROM learning_paths WHERE id = ? LIMIT 1").bind(pathId).first();
  if (!path) return json({ error: "Path not found" }, { status: 404 });

  if (enrolled) {
    await env.DB!.prepare(
      `INSERT OR IGNORE INTO path_enrollments (id, user_id, path_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), user.id, pathId, new Date().toISOString()).run();
  } else {
    await env.DB!.prepare(
      "DELETE FROM path_enrollments WHERE user_id = ? AND path_id = ?",
    ).bind(user.id, pathId).run();
  }
  return json({ ok: true, enrolled });
}

export async function handleGrowthRoute(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  try {
    if (pathname === "/api/referrals/me" && request.method === "GET") return await referralMe(request, env);
    if (pathname === "/api/referrals/claim" && request.method === "POST") return await claimReferral(request, env);
    if (pathname === "/api/learning-paths" && request.method === "GET") return await listLearningPaths(request, env);

    const enrollMatch = pathname.match(/^\/api\/learning-paths\/([^/]+)\/enroll$/);
    if (enrollMatch && request.method === "POST") {
      return await setEnrollment(request, env, decodeURIComponent(enrollMatch[1]), true);
    }
    if (enrollMatch && request.method === "DELETE") {
      return await setEnrollment(request, env, decodeURIComponent(enrollMatch[1]), false);
    }

    const detailMatch = pathname.match(/^\/api\/learning-paths\/([^/]+)$/);
    if (detailMatch && request.method === "GET") {
      return await learningPathDetail(request, env, decodeURIComponent(detailMatch[1]));
    }
    return null;
  } catch (error) {
    console.error("growth route failed", error);
    return json({ error: "Something went wrong" }, { status: 500 });
  }
}
