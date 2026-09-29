// Submits URLs to IndexNow (Bing, Yandex, Seznam, Naver) and pings Google sitemap.
// Admin-only. We don't expose the key privately — the IndexNow key is, by design,
// a public file at the site root. The function itself must still be admin-gated
// so arbitrary visitors can't trigger network submissions on our behalf.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const INDEXNOW_KEY = "b00kn0m1cs4anetwlnowind3xnowkey91";
const HOST = "booknomics.com";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const SITEMAP = `https://${HOST}/sitemap.xml`;

const BodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10000),
});

const ENDPOINTS = [
  "https://api.indexnow.org/IndexNow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
  "https://searchadvisor.naver.com/indexnow",
];

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    // Admin-only: verify the caller is a signed-in admin before doing anything.
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
    const { data: role } = await supabase
      .from("user_roles")
      .select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const rl = checkRateLimit(`indexnow:${ures.user.id}`, 20, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const urlList = parsed.data.urls.filter((u) => u.includes(HOST));
    if (urlList.length === 0) {
      return new Response(JSON.stringify({ error: "no urls match host" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList,
    });

    const results = await Promise.allSettled(
      ENDPOINTS.map((u) =>
        fetch(u, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: payload })
          .then((r) => ({ endpoint: u, status: r.status }))
      ),
    );

    // Best-effort Google sitemap ping (deprecated but harmless).
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`).catch(() => {});

    return new Response(
      JSON.stringify({
        submitted: urlList.length,
        results: results.map((r) => r.status === "fulfilled" ? r.value : { error: "submit failed" }),
      }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("indexnow-submit error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
