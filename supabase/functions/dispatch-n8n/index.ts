// Admin-only proxy that POSTs promotion payloads to the configured n8n webhook.
// The webhook URL lives server-side in app_settings (key: n8n_webhook_url), so
// it never has to be exposed to or fetchable from the browser, and calls are
// rate-limited so arbitrary visitors can't trigger distribution workflows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

  try {
    // Admin-only: the service role client is used for app_settings + logs.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures?.user) return json({ error: "Unauthorized" }, 401);
    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Admin only" }, 403);

    const rl = checkRateLimit(`n8n:${ures.user.id}`, 60, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const body = await req.json();
    const { book_id, book_title, platforms, payload } = body || {};
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) return json({ error: "book_id required" }, 400);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "payload required" }, 400);

    const { data: settings } = await admin.from("app_settings")
      .select("value").eq("key", "n8n_webhook_url").maybeSingle();
    const webhookUrl = (settings?.value as any)?.url;
    if (typeof webhookUrl !== "string" || !webhookUrl) {
      return json({ error: "n8n webhook not configured in Settings" }, 400);
    }
    if (!/^https:\/\/[^/]+\/webhook\//.test(webhookUrl)) {
      return json({ error: "Configured n8n webhook URL is invalid" }, 400);
    }

    // Log first (pending)
    const { data: logRow, error: logErr } = await admin.from("promotion_logs").insert({
      book_id,
      book_title: typeof book_title === "string" ? book_title.slice(0, 300) : "",
      platforms: Array.isArray(platforms) ? platforms.slice(0, 10) : null,
      payload,
      status: "pending",
    }).select("id").single();
    if (logErr || !logRow) {
      console.error("promotion log insert failed:", logErr?.message);
      return json({ error: "Failed to log promotion" }, 500);
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text().catch(() => "");
      await admin.from("promotion_logs").update({
        status: res.ok ? "success" : "failed",
        http_status: res.status,
        response: text.slice(0, 1000),
      }).eq("id", logRow.id);
      if (res.ok) return json({ ok: true, status: res.status });
      console.error("n8n upstream error:", res.status, text.slice(0, 400));
      return json({ error: "n8n returned an error", status: res.status }, 502);
    } catch (e) {
      await admin.from("promotion_logs").update({
        status: "failed",
        response: String((e as Error)?.message ?? e).slice(0, 1000),
      }).eq("id", logRow.id);
      console.error("dispatch-n8n fetch error:", e);
      return json({ error: "Webhook request failed" }, 502);
    }
  } catch (e) {
    console.error("dispatch-n8n error:", e);
    return json({ error: "Something went wrong" }, 500);
  }
});