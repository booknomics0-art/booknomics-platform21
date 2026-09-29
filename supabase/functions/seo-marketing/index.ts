// SEO + Marketing copy generator powered by Lovable AI Gateway.
// Modes:
//   - "seo"     -> 3 high-CTR meta title + description suggestions
//   - "captions"-> 3 social captions (LinkedIn / Instagram / Twitter thread)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    const { book_id, mode = "seo" } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) return json(req, { error: "book_id required" }, 400);
    if (!["seo", "captions"].includes(mode)) return json(req, { error: "invalid mode" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin-only
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json(req, { error: "Login required" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures?.user) return json(req, { error: "Session expired" }, 401);
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json(req, { error: "Admin only" }, 403);

    const rl = checkRateLimit(`seo-marketing:${ures.user.id}`, 60, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: book, error: bErr } = await supabase
      .from("books")
      .select("title, author, category, language, tagline, overview, key_ideas, slug")
      .eq("id", book_id).maybeSingle();
    if (bErr || !book) return json(req, { error: "Book not found" }, 404);

    const isHi = book.language === "hi";
    const ctx = `Book: "${book.title}" by ${book.author}
Category: ${book.category}
Hook: ${book.tagline ?? ""}
Summary: ${(book.overview ?? "").slice(0, 1200)}
Key Insights: ${(book.key_ideas ?? "").slice(0, 800)}`;

    let prompt = "";
    if (mode === "seo") {
      prompt = `You are an SEO copywriter. Write in ${isHi ? "Hindi" : "English"}.
${ctx}

Generate 3 high-CTR meta title (max 60 chars) + meta description (max 155 chars) alternatives optimized for Google search.
Use power words, numbers, curiosity gaps. Avoid clickbait.

Return ONLY valid JSON (no code fences):
{ "suggestions": [ { "title": "...", "description": "...", "rationale": "one short line" }, ... ] }`;
    } else {
      prompt = `You are a social media strategist. Write in ${isHi ? "Hindi (Devanagari)" : "English"}.
${ctx}

Generate 3 distinct captions:
1. LinkedIn — professional, insight-led, 80-120 words, ends with question.
2. Instagram — catchy hook + 3 short lines + emojis + 5 hashtags.
3. Twitter/X — 5-tweet thread, each numbered, max 270 chars per tweet, no fluff.

Return ONLY valid JSON (no code fences):
{
  "linkedin": "full caption text",
  "instagram": "full caption text",
  "twitter": "1/ ...\\n2/ ...\\n3/ ...\\n4/ ...\\n5/ ..."
}`;
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 3000,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t.slice(0, 400));
      if (aiResp.status === 429) return json(req, { error: "Rate limit. Try again shortly." }, 429);
      if (aiResp.status === 402) return json(req, { error: "AI credits exhausted." }, 402);
      return json(req, { error: "AI gateway failed" }, 502);
    }

    const ai = await aiResp.json();
    const content = ai.choices?.[0]?.message?.content ?? "{}";
    try {
      return json(req, JSON.parse(content));
    } catch {
      console.error("seo-marketing: AI returned invalid JSON");
      return json(req, { error: "AI gateway failed" }, 502);
    }
  } catch (e) {
    console.error(e);
    return json(req, { error: "Something went wrong" }, 500);
  }
});
