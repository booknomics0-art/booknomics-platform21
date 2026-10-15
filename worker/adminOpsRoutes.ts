type D1 = any;
export type AdminOpsEnv = { DB?: D1 };

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
  const row = await db.prepare(
    `SELECT u.id, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`,
  ).bind(await sha256(token)).first();
  return row ? row as SafeUser : null;
}

async function requireAdmin(request: Request, env: AdminOpsEnv) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const user = await currentUser(request, env.DB);
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  const role = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
  ).bind(user.id).first();
  if (!role) return { user: null, response: json({ error: "Admin access required" }, { status: 403 }) };
  return { user, response: null };
}

function parseJson(value: unknown, fallback: any) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function getN8nSetting(request: Request, env: AdminOpsEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const row = await env.DB!.prepare("SELECT value, updated_at FROM app_settings WHERE key = 'n8n_webhook_url' LIMIT 1").first();
  return json({ data: row ? { value: parseJson(row.value, {}), updated_at: row.updated_at } : null });
}

async function putN8nSetting(request: Request, env: AdminOpsEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as any;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (url && !/^https:\/\/[^/]+\/(?:webhook|webhook-test)\//i.test(url)) {
    return json({ error: "Use an HTTPS n8n webhook URL" }, { status: 400 });
  }
  const now = new Date().toISOString();
  await env.DB!.prepare(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ('n8n_webhook_url', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).bind(JSON.stringify({ url }), now, auth.user!.id).run();
  return json({ data: { value: { url }, updated_at: now } });
}

async function listPromotions(request: Request, env: AdminOpsEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);
  const result = await env.DB!.prepare(
    `SELECT id, book_id, book_title, platforms, status, http_status, response, created_at
     FROM promotion_logs ORDER BY datetime(created_at) DESC LIMIT ?`,
  ).bind(limit).all();
  const data = (result.results || []).map((row: any) => ({ ...row, platforms: parseJson(row.platforms, []) }));
  return json({ data });
}

async function dispatchN8n(request: Request, env: AdminOpsEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as any;
  const bookId = typeof body?.book_id === "string" ? body.book_id : "";
  const bookTitle = typeof body?.book_title === "string" ? body.book_title.slice(0, 300) : "";
  const platforms = Array.isArray(body?.platforms) ? body.platforms.filter((p: any) => typeof p === "string").slice(0, 10) : [];
  const payload = body?.payload;
  if (!bookId || bookId.length > 64) return json({ error: "book_id required" }, { status: 400 });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "payload required" }, { status: 400 });

  const recent = await env.DB!.prepare(
    `SELECT COUNT(*) AS total FROM promotion_logs
     WHERE triggered_by = ? AND datetime(created_at) >= datetime('now', '-1 hour')`,
  ).bind(auth.user!.id).first();
  if (Number(recent?.total || 0) >= 60) return json({ error: "Too many dispatches. Try again later." }, { status: 429 });

  const setting = await env.DB!.prepare("SELECT value FROM app_settings WHERE key = 'n8n_webhook_url' LIMIT 1").first();
  const webhookUrl = parseJson(setting?.value, {})?.url;
  if (typeof webhookUrl !== "string" || !webhookUrl) return json({ error: "n8n webhook not configured in Settings" }, { status: 400 });
  if (!/^https:\/\/[^/]+\/(?:webhook|webhook-test)\//i.test(webhookUrl)) return json({ error: "Configured n8n webhook URL is invalid" }, { status: 400 });

  const logId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB!.prepare(
    `INSERT INTO promotion_logs
      (id, book_id, book_title, platforms, payload, status, triggered_by, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).bind(logId, bookId, bookTitle, JSON.stringify(platforms), JSON.stringify(payload), auth.user!.id, now).run();

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text().catch(() => "");
    await env.DB!.prepare(
      "UPDATE promotion_logs SET status = ?, http_status = ?, response = ? WHERE id = ?",
    ).bind(upstream.ok ? "success" : "failed", upstream.status, text.slice(0, 1000), logId).run();
    if (!upstream.ok) return json({ error: "n8n returned an error", status: upstream.status }, { status: 502 });
    return json({ ok: true, status: upstream.status });
  } catch (error) {
    await env.DB!.prepare("UPDATE promotion_logs SET status = 'failed', response = ? WHERE id = ?")
      .bind(String(error instanceof Error ? error.message : error).slice(0, 1000), logId).run();
    return json({ error: "Webhook request failed" }, { status: 502 });
  }
}

async function latestSeoAudit(request: Request, env: AdminOpsEnv, bookId: string) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const row = await env.DB!.prepare(
    `SELECT aeo_score, geo_score, ai_visibility_score, scoring_version, aeo_details, geo_details, updated_at
     FROM seo_audits WHERE book_id = ? ORDER BY datetime(updated_at) DESC LIMIT 1`,
  ).bind(bookId).first();
  if (!row) return json({ data: null });
  row.aeo_details = parseJson(row.aeo_details, {});
  row.geo_details = parseJson(row.geo_details, {});
  return json({ data: row });
}

const INDEXNOW_HOST = "booknomics.com";
const INDEXNOW_KEY = "b00kn0m1cs4anetwlnowind3xnowkey91";
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/IndexNow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
  "https://searchadvisor.naver.com/indexnow",
];

async function submitIndexNow(request: Request, env: AdminOpsEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as any;
  const values = Array.isArray(body?.urls) ? body.urls : [];
  if (!values.length || values.length > 10000) return json({ error: "Provide 1-10000 URLs" }, { status: 400 });

  const urls: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") continue;
      if (parsed.hostname !== INDEXNOW_HOST && parsed.hostname !== `www.${INDEXNOW_HOST}`) continue;
      urls.push(parsed.toString());
    } catch {}
  }
  if (!urls.length) return json({ error: "No URLs match Booknomics host" }, { status: 400 });

  const recent = await env.DB!.prepare(
    `SELECT COUNT(*) AS total FROM admin_access_logs
     WHERE user_id = ? AND reason = 'indexnow_submit' AND datetime(created_at) >= datetime('now', '-1 hour')`,
  ).bind(auth.user!.id).first();
  if (Number(recent?.total || 0) >= 20) return json({ error: "IndexNow hourly limit reached" }, { status: 429 });
  await env.DB!.prepare(
    `INSERT INTO admin_access_logs
      (id, attempted_email, user_id, ip_address, user_agent, outcome, reason, created_at)
     VALUES (?, ?, ?, ?, ?, 'allowed', 'indexnow_submit', ?)`,
  ).bind(
    crypto.randomUUID(),
    auth.user!.email,
    auth.user!.id,
    request.headers.get("cf-connecting-ip"),
    request.headers.get("user-agent"),
    new Date().toISOString(),
  ).run();

  const payload = JSON.stringify({
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });
  const results = await Promise.allSettled(INDEXNOW_ENDPOINTS.map(async (endpoint) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: payload,
    });
    return { endpoint, status: response.status };
  }));
  fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent("https://www.booknomics.com/sitemap.xml")}`).catch(() => {});
  return json({
    submitted: urls.length,
    results: results.map((result) => result.status === "fulfilled" ? result.value : { error: "submit failed" }),
  });
}

export async function handleAdminOpsRoute(request: Request, env: AdminOpsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/admin/settings/n8n" && request.method === "GET") return await getN8nSetting(request, env);
    if (url.pathname === "/api/admin/settings/n8n" && request.method === "PUT") return await putN8nSetting(request, env);
    if (url.pathname === "/api/admin/promotions" && request.method === "GET") return await listPromotions(request, env);
    if (url.pathname === "/api/admin/dispatch-n8n" && request.method === "POST") return await dispatchN8n(request, env);
    if (url.pathname === "/api/admin/indexnow" && request.method === "POST") return await submitIndexNow(request, env);
    const seoMatch = url.pathname.match(/^\/api\/admin\/seo-audits\/([^/]+)$/);
    if (seoMatch && request.method === "GET") return await latestSeoAudit(request, env, decodeURIComponent(seoMatch[1]));
    return null;
  } catch (error) {
    console.error("admin ops route failed", error);
    return json({ error: "Admin operation failed" }, { status: 500 });
  }
}
