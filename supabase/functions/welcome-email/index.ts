// Server-side proxy for the n8n "welcome email" webhook.
// Keeps the n8n workspace URL out of client code and rate-limits calls so
// arbitrary visitors can't spam the webhook with fake signups.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ures, error: uerr } = await supabase.auth.getUser();
    if (uerr || !ures?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const user = ures.user;

    // Rate limit: one welcome email per user per hour.
    const rl = checkRateLimit(`welcome:${user.id}`, 1, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const WEBHOOK_URL = Deno.env.get("N8N_WELCOME_WEBHOOK_URL");
    if (!WEBHOOK_URL) {
      console.error("N8N_WELCOME_WEBHOOK_URL not configured");
      return new Response(JSON.stringify({ error: "Service not configured" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const { email, name } = await req.json();
    // Only allow sending for the authenticated user's own email.
    const targetEmail = typeof email === "string" && email.trim() && email.toLowerCase() === user.email?.toLowerCase()
      ? email.trim()
      : user.email;
    if (!targetEmail) {
      return new Response(JSON.stringify({ error: "Email unavailable" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const payload = {
      email: targetEmail,
      name: (typeof name === "string" && name.trim() ? name.trim() : (targetEmail.split("@")[0] ?? ""))?.slice(0, 200),
      source: "booknomics-signup",
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("welcome-email upstream error:", res.status, (await res.text()).slice(0, 300));
      return new Response(JSON.stringify({ error: "Failed to send welcome email" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("welcome-email error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
