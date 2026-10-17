type D1 = any;

export type CutoverAdminEnv = { DB?: D1 };
type SafeUser = { id: string; email: string };

const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers },
});

const cookies = (request: Request) => {
  const out = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) out.set(key, decodeURIComponent(rest.join("=")));
  }
  return out;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
};

async function requireAdmin(request: Request, env: CutoverAdminEnv) {
  if (!env.DB) return { user: null as SafeUser | null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return { user: null as SafeUser | null, response: json({ error: "Authentication required" }, { status: 401 }) };
  const user = await env.DB.prepare(
    `SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND datetime(s.expires_at)>datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first() as SafeUser | null;
  if (!user) return { user: null, response: json({ error: "Session expired" }, { status: 401 }) };
  const role = await env.DB.prepare("SELECT 1 AS ok FROM user_roles WHERE user_id=? AND role='admin' LIMIT 1").bind(user.id).first();
  if (!role) return { user: null, response: json({ error: "Admin access required" }, { status: 403 }) };
  return { user, response: null as Response | null };
}

const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

async function publishedToday(request: Request, env: CutoverAdminEnv) {
  const auth = await requireAdmin(request, env); if (auth.response) return auth.response;
  // Books currently do not have a dedicated published_at column in the D1 schema.
  // Count already-published rows created during the current IST calendar day; this
  // preserves the safety widget without inventing client-side state.
  const row = await env.DB!.prepare(
    `SELECT COUNT(*) AS total FROM books
     WHERE is_draft=0 AND status='published'
       AND date(datetime(created_at, '+5 hours', '+30 minutes')) = date(datetime('now', '+5 hours', '+30 minutes'))`,
  ).first();
  return json({ count: Number(row?.total || 0) });
}

async function listIndexingJobs(request: Request, env: CutoverAdminEnv) {
  const auth = await requireAdmin(request, env); if (auth.response) return auth.response;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 200), 1), 500);
  const rows = await env.DB!.prepare(
    `SELECT id,book_id,url,status,gsc_status,last_checked_at,attempts,error_message,created_at,updated_at
     FROM seo_indexing_jobs ORDER BY datetime(created_at) DESC LIMIT ?`,
  ).bind(limit).all();
  return json({ data: rows.results || [] });
}

async function patchIndexingJob(request: Request, env: CutoverAdminEnv, id: string) {
  const auth = await requireAdmin(request, env); if (auth.response) return auth.response;
  if (!uuid(id)) return json({ error: "Bad job id" }, { status: 400 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid update" }, { status: 400 });
  const allowed = ["status", "gsc_status", "last_checked_at", "attempts", "error_message"] as const;
  const entries = allowed.filter(k => body[k] !== undefined).map(k => [k, body[k]] as const);
  if (!entries.length) return json({ error: "No mutable fields supplied" }, { status: 400 });
  const now = new Date().toISOString();
  await env.DB!.prepare(
    `UPDATE seo_indexing_jobs SET ${entries.map(([k]) => `${k}=?`).join(",")}, updated_at=? WHERE id=?`,
  ).bind(...entries.map(([k, v]) => k === "attempts" ? Number(v || 0) : (v == null ? null : String(v))), now, id).run();
  const row = await env.DB!.prepare("SELECT * FROM seo_indexing_jobs WHERE id=? LIMIT 1").bind(id).first();
  return json({ data: row || null });
}

async function listSocialPosts(request: Request, env: CutoverAdminEnv) {
  const auth = await requireAdmin(request, env); if (auth.response) return auth.response;
  const rows = await env.DB!.prepare(
    `SELECT id,book_id,platform,status,content,published_at,post_type,media_url,scheduled_at,error_message,created_at,updated_at
     FROM social_posts ORDER BY datetime(created_at) DESC LIMIT 2000`,
  ).all();
  return json({ data: rows.results || [] });
}

function cleanSocialPayload(body: any) {
  const platform = typeof body?.platform === "string" ? body.platform.trim().slice(0, 50) : "";
  const status = typeof body?.status === "string" ? body.status.trim().slice(0, 30) : "draft";
  if (!platform) throw new Error("Platform required");
  return {
    book_id: uuid(body?.book_id) ? body.book_id : null,
    platform,
    status,
    content: typeof body?.content === "string" ? body.content.slice(0, 30000) : null,
    published_at: typeof body?.published_at === "string" ? body.published_at : null,
    post_type: typeof body?.post_type === "string" ? body.post_type.slice(0, 50) : null,
    media_url: typeof body?.media_url === "string" ? body.media_url.slice(0, 2000) : null,
    scheduled_at: typeof body?.scheduled_at === "string" ? body.scheduled_at : null,
    error_message: typeof body?.error_message === "string" ? body.error_message.slice(0, 2000) : null,
  };
}

async function createSocialPost(request: Request, env: CutoverAdminEnv) {
  const auth = await requireAdmin(request, env); if (auth.response) return auth.response;
  let p: ReturnType<typeof cleanSocialPayload>;
  try { p = cleanSocialPayload(await request.json().catch(() => null)); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid post" }, { status: 400 }); }
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await env.DB!.prepare(
    `INSERT INTO social_posts
     (id,book_id,platform,post_type,content,media_url,status,scheduled_at,published_at,error_message,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(id,p.book_id,p.platform,p.post_type,p.content,p.media_url,p.status,p.scheduled_at,p.published_at,p.error_message,now,now).run();
  return json({ data: await env.DB!.prepare("SELECT * FROM social_posts WHERE id=? LIMIT 1").bind(id).first() }, { status: 201 });
}

async function patchSocialPost(request: Request, env: CutoverAdminEnv, id: string) {
  const auth = await requireAdmin(request, env); if (auth.response) return auth.response;
  if (!uuid(id)) return json({ error: "Bad post id" }, { status: 400 });
  let p: ReturnType<typeof cleanSocialPayload>;
  try { p = cleanSocialPayload(await request.json().catch(() => null)); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid post" }, { status: 400 }); }
  const now = new Date().toISOString();
  await env.DB!.prepare(
    `UPDATE social_posts SET book_id=?,platform=?,post_type=?,content=?,media_url=?,status=?,scheduled_at=?,published_at=?,error_message=?,updated_at=? WHERE id=?`,
  ).bind(p.book_id,p.platform,p.post_type,p.content,p.media_url,p.status,p.scheduled_at,p.published_at,p.error_message,now,id).run();
  return json({ data: await env.DB!.prepare("SELECT * FROM social_posts WHERE id=? LIMIT 1").bind(id).first() });
}

export async function handleCutoverAdminRoute(request: Request, env: CutoverAdminEnv): Promise<Response | null> {
  if (!env.DB) return null;
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/admin/published-today-count" && request.method === "GET") return await publishedToday(request, env);
    if (url.pathname === "/api/admin/indexing-jobs" && request.method === "GET") return await listIndexingJobs(request, env);
    const job = url.pathname.match(/^\/api\/admin\/indexing-jobs\/([^/]+)$/);
    if (job && request.method === "PATCH") return await patchIndexingJob(request, env, decodeURIComponent(job[1]));
    if (url.pathname === "/api/admin/social-posts" && request.method === "GET") return await listSocialPosts(request, env);
    if (url.pathname === "/api/admin/social-posts" && request.method === "POST") return await createSocialPost(request, env);
    const social = url.pathname.match(/^\/api\/admin\/social-posts\/([^/]+)$/);
    if (social && request.method === "PATCH") return await patchSocialPost(request, env, decodeURIComponent(social[1]));
    return null;
  } catch (error) {
    console.error("cutover admin route failed", error);
    return json({ error: "Admin operation failed" }, { status: 500 });
  }
}
