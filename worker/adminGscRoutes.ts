type D1 = any;

export type AdminGscEnv = {
  DB?: D1;
  LOVABLE_API_KEY?: string;
  GOOGLE_SEARCH_CONSOLE_API_KEY?: string;
};

type SafeUser = { id: string; email: string };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

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
    `SELECT u.id, COALESCE(u.supabase_email, u.email) AS email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first();
  return row ? row as SafeUser : null;
}

async function requireAdmin(request: Request, env: AdminGscEnv) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const user = await currentUser(request, env.DB);
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  const role = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
  ).bind(user.id).first();
  if (!role) return { user: null, response: json({ error: "Admin access required" }, { status: 403 }) };
  return { user, response: null };
}

async function enforceRateLimit(request: Request, env: AdminGscEnv, user: SafeUser) {
  const recent = await env.DB!.prepare(
    `SELECT COUNT(*) AS total FROM admin_access_logs
     WHERE user_id = ? AND reason = 'gsc_proxy'
       AND datetime(created_at) >= datetime('now', '-1 hour')`,
  ).bind(user.id).first();
  if (Number(recent?.total || 0) >= 120) {
    return json({ error: "GSC hourly limit reached" }, { status: 429, headers: { "retry-after": "3600" } });
  }
  await env.DB!.prepare(
    `INSERT INTO admin_access_logs
      (id, attempted_email, user_id, ip_address, user_agent, outcome, reason, created_at)
     VALUES (?, ?, ?, ?, ?, 'allowed', 'gsc_proxy', ?)`,
  ).bind(
    crypto.randomUUID(), user.email, user.id,
    request.headers.get("cf-connecting-ip"),
    request.headers.get("user-agent"),
    new Date().toISOString(),
  ).run();
  return null;
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function safeBooknomicsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "booknomics.com" && host !== "www.booknomics.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeSiteProperty(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "sc-domain:booknomics.com") return trimmed;
  return safeBooknomicsUrl(trimmed);
}

async function persistPageMetrics(env: AdminGscEnv, siteUrl: string, startDate: string, endDate: string, rows: any[]) {
  if (!env.DB || !rows.length) return false;
  try {
    await env.DB.prepare(
      "DELETE FROM gsc_page_metrics WHERE site_url = ? AND start_date = ? AND end_date = ?",
    ).bind(siteUrl, startDate, endDate).run();

    const capturedAt = new Date().toISOString();
    const normalized = rows
      .filter((row: any) => typeof row?.keys?.[0] === "string")
      .slice(0, 5000)
      .map((row: any) => ({
        id: crypto.randomUUID(),
        url: String(row.keys[0]),
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
      }));

    for (let i = 0; i < normalized.length; i += 100) {
      const batch = normalized.slice(i, i + 100).map((row) => env.DB!.prepare(
        `INSERT INTO gsc_page_metrics
          (id, site_url, start_date, end_date, url, clicks, impressions, ctr, position, captured_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        row.id, siteUrl, startDate, endDate, row.url,
        row.clicks, row.impressions, row.ctr, row.position, capturedAt,
      ));
      await env.DB.batch(batch);
    }
    return true;
  } catch (error) {
    console.error("GSC D1 persistence error", error);
    return false;
  }
}

export async function handleAdminGscRoute(request: Request, env: AdminGscEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/admin/gsc" || request.method !== "POST") return null;

  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const user = auth.user!;

    if (!env.LOVABLE_API_KEY || !env.GOOGLE_SEARCH_CONSOLE_API_KEY) {
      return json({ error: "GSC connector not linked" }, { status: 503 });
    }

    const limited = await enforceRateLimit(request, env, user);
    if (limited) return limited;

    const body = await request.json().catch(() => null) as any;
    const action = typeof body?.action === "string" ? body.action : "";
    const siteUrl = safeSiteProperty(body?.siteUrl);
    const pageUrl = safeBooknomicsUrl(body?.pageUrl);
    const startDate = body?.startDate;
    const endDate = body?.endDate;

    const gw = async (path: string, init: RequestInit = {}) => {
      const response = await fetch(`${GATEWAY}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${env.LOVABLE_API_KEY}`,
          "x-connection-api-key": env.GOOGLE_SEARCH_CONSOLE_API_KEY!,
          "content-type": "application/json",
          ...(init.headers || {}),
        },
      });
      const text = await response.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!response.ok) {
        console.error("GSC gateway error", response.status, parsed?.error?.message || parsed?.error || text.slice(0, 400));
        throw new Error("GSC request failed");
      }
      return parsed;
    };

    if (action === "list_sites") {
      return json(await gw("/webmasters/v3/sites"));
    }

    if (action === "site_data") {
      if (!siteUrl || !isDate(startDate) || !isDate(endDate)) {
        return json({ error: "Valid Booknomics siteUrl/startDate/endDate required" }, { status: 400 });
      }
      const enc = encodeURIComponent(siteUrl);
      const [totals, pages, queries] = await Promise.all([
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, {
          method: "POST", body: JSON.stringify({ startDate, endDate, rowLimit: 1 }),
        }),
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, {
          method: "POST", body: JSON.stringify({ startDate, endDate, dimensions: ["page"], rowLimit: 25000 }),
        }),
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, {
          method: "POST", body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: 1000 }),
        }),
      ]);
      const pageRows = Array.isArray(pages.rows) ? pages.rows : [];
      const persisted = await persistPageMetrics(env, siteUrl, startDate, endDate, pageRows);
      return json({
        totals: totals.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        pages: pageRows,
        queries: queries.rows || [],
        persisted,
      });
    }

    if (action === "page_data") {
      if (!pageUrl || !isDate(startDate) || !isDate(endDate)) {
        return json({ error: "Valid Booknomics pageUrl/startDate/endDate required" }, { status: 400 });
      }
      const inferredSite = siteUrl || `${new URL(pageUrl).origin}/`;
      const enc = encodeURIComponent(inferredSite);
      const filter = { dimension: "page", operator: "equals", expression: pageUrl };
      const requestBody = (extra: any) => JSON.stringify({
        startDate, endDate, dimensionFilterGroups: [{ filters: [filter] }], ...extra,
      });
      const [totals, queries] = await Promise.all([
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, { method: "POST", body: requestBody({ rowLimit: 1 }) }),
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, { method: "POST", body: requestBody({ dimensions: ["query"], rowLimit: 25 }) }),
      ]);
      return json({
        totals: totals.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        queries: queries.rows || [],
      });
    }

    if (action === "inspect_url") {
      if (!siteUrl || !pageUrl) return json({ error: "Valid Booknomics siteUrl/pageUrl required" }, { status: 400 });
      return json(await gw("/v1/urlInspection/index:inspect", {
        method: "POST",
        body: JSON.stringify({ inspectionUrl: pageUrl, siteUrl }),
      }));
    }

    return json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("admin GSC route failed", error);
    return json({ error: "GSC request failed" }, { status: 502 });
  }
}
