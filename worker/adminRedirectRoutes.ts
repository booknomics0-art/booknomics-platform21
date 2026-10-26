type D1 = any;
export type AdminRedirectEnv = { DB?: D1 };

type SafeUser = { id: string; email: string };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
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

async function requireAdmin(request: Request, env: AdminRedirectEnv) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  const user = await env.DB.prepare(
    `SELECT u.id, COALESCE(u.supabase_email, u.email) AS email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first();
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  const role = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
  ).bind(user.id).first();
  if (!role) return { user: null, response: json({ error: "Admin access required" }, { status: 403 }) };
  return { user: user as SafeUser, response: null };
}

export async function handleAdminRedirectRoute(request: Request, env: AdminRedirectEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/admin/url-redirects" || request.method !== "PUT") return null;

  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as any;
  const oldPath = typeof body?.old_path === "string" ? body.old_path.trim() : "";
  const newPath = typeof body?.new_path === "string" ? body.new_path.trim() : "";
  const statusCode = Number(body?.status_code || 301);
  const notes = typeof body?.notes === "string" ? body.notes.slice(0, 500) : null;
  if (!oldPath.startsWith("/books/") || !newPath.startsWith("/books/")) {
    return json({ error: "Redirect paths must stay under /books/" }, { status: 400 });
  }
  if (oldPath === newPath) return json({ error: "Redirect source and target must differ" }, { status: 400 });
  if (![301, 302, 307, 308].includes(statusCode)) return json({ error: "Invalid redirect status" }, { status: 400 });

  const now = new Date().toISOString();
  await env.DB!.prepare(
    `INSERT INTO url_redirects (id, old_path, new_path, status_code, created_by, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(old_path) DO UPDATE SET
       new_path = excluded.new_path,
       status_code = excluded.status_code,
       created_by = excluded.created_by,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
  ).bind(
    crypto.randomUUID(), oldPath, newPath, statusCode, auth.user!.id, notes, now, now,
  ).run();

  return json({ data: { old_path: oldPath, new_path: newPath, status_code: statusCode, notes, updated_at: now } });
}
