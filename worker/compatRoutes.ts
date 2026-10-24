type D1 = any;
export type CompatEnv = { DB?: D1 };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers },
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

async function currentUserId(request: Request, db: D1): Promise<string | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND datetime(s.expires_at)>datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first();
  return row?.id ? String(row.id) : null;
}

const ids = (value: string | null) => (value || "").split(",").filter((v) => /^[0-9a-f-]{36}$/i.test(v)).slice(0, 90);
const goodUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

async function recordAffiliateClick(request: Request, env: CompatEnv) {
  const body = await request.json().catch(() => null) as {
    book_id?: unknown;
    source?: unknown;
    placement?: unknown;
  } | null;
  const bookId = body?.book_id;
  if (!goodUuid(bookId)) return json({ error: "Bad book id" }, { status: 400 });

  const source = typeof body?.source === "string" ? body.source.trim().slice(0, 40) : "amazon";
  const placement = typeof body?.placement === "string" ? body.placement.trim().slice(0, 80) : null;
  if (!source) return json({ error: "Source is required" }, { status: 400 });

  const userId = await currentUserId(request, env.DB!);
  try {
    await env.DB!.prepare(
      `INSERT INTO affiliate_clicks (id, book_id, user_id, source, placement, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), bookId, userId, source, placement, new Date().toISOString()).run();
  } catch (error) {
    console.error("affiliate click insert failed", error);
    return json({ error: "Could not record click" }, { status: 500 });
  }
  return json({ ok: true });
}

export async function handleCompatRoute(request: Request, env: CompatEnv): Promise<Response | null> {
  if (!env.DB) return null;
  const url = new URL(request.url);

  if (url.pathname === "/api/affiliate-click" && request.method === "POST") {
    return recordAffiliateClick(request, env);
  }

  if (url.pathname === "/api/social/book-meta" && request.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Bad book id" }, { status: 400 });
    const row = await env.DB.prepare(
      `SELECT id, slug, seo_slug, title, author, category, language FROM books
       WHERE id=? AND is_draft=0 AND status IN ('published','published_noindex') LIMIT 1`,
    ).bind(id).first();
    return json({ data: row || null });
  }

  if (url.pathname === "/api/social/review-upvotes" && request.method === "GET") {
    const userId = await currentUserId(request, env.DB);
    if (!userId) return json({ data: [] });
    const reviewIds = ids(url.searchParams.get("ids"));
    if (!reviewIds.length) return json({ data: [] });
    const rows = await env.DB.prepare(
      `SELECT review_id FROM review_upvotes WHERE user_id=? AND review_id IN (${reviewIds.map(() => "?").join(",")})`,
    ).bind(userId, ...reviewIds).all();
    return json({ data: rows.results || [] });
  }

  if (url.pathname === "/api/social/reactions" && request.method === "GET") {
    const commentIds = ids(url.searchParams.get("comment_ids"));
    if (!commentIds.length) return json({ data: [] });
    const rows = await env.DB.prepare(
      `SELECT comment_id,type,user_id FROM reactions WHERE comment_id IN (${commentIds.map(() => "?").join(",")})`,
    ).bind(...commentIds).all();
    return json({ data: rows.results || [] });
  }

  return null;
}
