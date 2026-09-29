// Polish a single book's narrative sections: grammar, syntax, flow.
// Keeps meaning, language, length, and tags intact.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const FIELDS = [
  "tagline",            // #HOOK
  "overview",           // #SUMMARY
  "key_ideas",          // #KEY_INSIGHTS
  "daily_application",  // #APPLY_TODAY
  "reflection_questions", // #REFLECTION
  "action_system",      // #ACTION_SYSTEM
  "deep_analysis",      // #AUDIO_SCRIPT
] as const;

type FieldKey = typeof FIELDS[number];

function buildPrompt(lang: "en" | "hi", title: string, author: string, sections: Record<FieldKey, string>) {
  const langRule = lang === "hi"
    ? "Output language: Hindi (Devanagari). Use shuddh, saral Hindi. Fix matra, ling, vachan, kaarak. Warm, readable tone. DO NOT translate to English."
    : "Output language: clean, natural modern English. Active voice. Warm, professional, Gen-Z friendly tone. DO NOT translate to Hindi.";

  return `You are a senior editor polishing book-summary content for booknomics.com.

Book: "${title}" by ${author}
${langRule}

POLISH RULES (apply to every section):
- Fix grammar, spelling, punctuation, sentence structure.
- Break run-ons; merge choppy fragments; smooth transitions.
- Remove redundancy and awkward word order.
- Keep parallel structure in bullet lists.
- Keep #ACTION_SYSTEM numbered 1,2,3...
- Preserve markdown (bullets, numbering, headings).
- Keep approximate length similar (±15%).
- DO NOT change meaning, facts, characters, or author intent.
- DO NOT add new ideas or spoilers.
- Return EXACTLY the same set of sections. If a section is empty, return empty string.

Return ONLY a JSON object with keys: tagline, overview, key_ideas, daily_application, reflection_questions, action_system, deep_analysis.

CURRENT CONTENT:
${FIELDS.map(f => `### ${f}\n${sections[f] || ""}`).join("\n\n")}`;
}

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const { book_id } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) {
      return new Response(JSON.stringify({ error: "book_id required" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Admin-only
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures.user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const rl = checkRateLimit(`polish:${ures.user.id}`, 60, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: book, error: be } = await admin.from("books")
      .select("title,author,language,tagline,overview,key_ideas,daily_application,reflection_questions,action_system,deep_analysis")
      .eq("id", book_id).maybeSingle();
    if (be || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const lang: "en" | "hi" = book.language === "hi" ? "hi" : "en";
    const sections = Object.fromEntries(FIELDS.map(f => [f, (book as any)[f] || ""])) as Record<FieldKey, string>;

    // Skip if all empty
    if (FIELDS.every(f => !sections[f].trim())) {
      return new Response(JSON.stringify({ skipped: true, reason: "empty" }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a senior bilingual (English/Hindi) editor. Output strict JSON only." },
          { role: "user", content: buildPrompt(lang, book.title, book.author, sections) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 12000,
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Polish AI error:", aiRes.status, t.slice(0, 400));
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Add credits to Lovable AI workspace" }), { status: 402, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Polish failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "Polish failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Polish AI returned invalid JSON");
      return new Response(JSON.stringify({ error: "Polish failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    // Build patch — only update fields that came back non-empty AND were non-empty originally
    const patch: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = typeof parsed[f] === "string" ? parsed[f].trim() : "";
      if (v && sections[f].trim()) patch[f] = v.slice(0, 20000);
    }
    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ error: "Polish failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const { error: ue } = await admin.from("books").update(patch).eq("id", book_id);
    if (ue) {
      console.error("Polish save failed:", ue.message);
      return new Response(JSON.stringify({ error: "Failed to save polished content" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, fields: Object.keys(patch) }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("polish-book-content error:", e);
    return new Response(JSON.stringify({ error: "Polish failed" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
