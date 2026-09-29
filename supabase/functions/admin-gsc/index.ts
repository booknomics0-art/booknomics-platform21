// Admin-only Google Search Console proxy via Lovable connector gateway.
// Actions: list_sites, site_data, page_data, inspect_url
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GSC_KEY = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
    if (!LOVABLE_API_KEY || !GSC_KEY) return json({ error: "GSC connector not linked" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Auth required" }, 401);
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: allowed, error: roleError } = await user.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
    if (roleError || !allowed) return json({ error: "Admin only" }, 403);

    const rl = checkRateLimit(`gsc:${u.user.id}`, 120, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const body = await req.json();
    const { action, siteUrl, pageUrl, startDate, endDate } = body || {};
    const gw = async (path: string, init: RequestInit = {}) => {
      const r = await fetch(`${GATEWAY}${path}`, {
        ...init,
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GSC_KEY,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
      });
      const t = await r.text();
      let parsed: any; try { parsed = JSON.parse(t); } catch { parsed = { raw: t }; }
      if (!r.ok) {
        console.error("GSC gateway error:", r.status, parsed?.error?.message || parsed?.error || t.slice(0, 400));
        throw new Error("GSC request failed");
      }
      return parsed;
    };

    if (action === "list_sites") {
      const d = await gw("/webmasters/v3/sites");
      return json(d);
    }

    if (action === "site_data") {
      if (!siteUrl || !startDate || !endDate) return json({ error: "siteUrl/startDate/endDate required" }, 400);
      const enc = encodeURIComponent(siteUrl);
      const [totals, pages, queries] = await Promise.all([
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, {
          method: "POST",
          body: JSON.stringify({ startDate, endDate, rowLimit: 1 }),
        }),
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, {
          method: "POST",
          body: JSON.stringify({ startDate, endDate, dimensions: ["page"], rowLimit: 100 }),
        }),
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, {
          method: "POST",
          body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: 50 }),
        }),
      ]);
      return json({
        totals: totals.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        pages: pages.rows || [],
        queries: queries.rows || [],
      });
    }

    if (action === "page_data") {
      if (!pageUrl || !startDate || !endDate) return json({ error: "pageUrl/startDate/endDate required" }, 400);
      const inferredSite = siteUrl || (new URL(pageUrl).origin + "/");
      const enc = encodeURIComponent(inferredSite);
      const filter = { dimension: "page", operator: "equals", expression: pageUrl };
      const body = (extra: any) => JSON.stringify({
        startDate, endDate, dimensionFilterGroups: [{ filters: [filter] }], ...extra,
      });
      const [totals, queries] = await Promise.all([
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, { method: "POST", body: body({ rowLimit: 1 }) }),
        gw(`/webmasters/v3/sites/${enc}/searchAnalytics/query`, { method: "POST", body: body({ dimensions: ["query"], rowLimit: 25 }) }),
      ]);
      return json({
        totals: totals.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        queries: queries.rows || [],
      });
    }

    if (action === "inspect_url") {
      if (!siteUrl || !pageUrl) return json({ error: "siteUrl/pageUrl required" }, 400);
      const d = await gw(`/v1/urlInspection/index:inspect`, {
        method: "POST",
        body: JSON.stringify({ inspectionUrl: pageUrl, siteUrl }),
      });
      return json(d);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-gsc error:", e);
    return json({ error: "Something went wrong" }, 500);
  }
});
