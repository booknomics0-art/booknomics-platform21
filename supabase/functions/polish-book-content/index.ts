// Polish a single book's narrative + learning sections without changing facts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const FIELDS = [
  "tagline", "overview", "deep_summary", "key_ideas", "deep_analysis",
  "daily_application", "action_system", "practice_tracker",
  "reflection_questions", "real_life_example",
] as const;

type FieldKey = typeof FIELDS[number];

function buildPrompt(lang: "en" | "hi", title: string, author: string, sections: Record<FieldKey, string>) {
  const langRule = lang === "hi"
    ? "Write natural Hindi in Devanagari. Reduce awkward Hinglish, but keep common English terms when clearer."
    : "Write clean modern English with active voice and natural rhythm.";

  return `You are the senior editor for Booknomics.
Book: "${title}" by ${author}
${langRule}

Improve readability and engagement without changing facts or adding new claims.
Rules:
- CURRENT CONTENT is the only factual source. Never invent plot points, characters, quotes, research, history, awards, influence, author intent, examples presented as fact, or new spoilers.
- Open sections strongly; remove generic introductions, filler, repetition and vague praise.
- Prefer concrete nouns/verbs, varied sentence rhythm and short mobile-friendly paragraphs.
- Preserve markdown. Use bold sparingly.
- overview: surface the central tension/question quickly.
- deep_summary: clear progression; each paragraph must advance understanding.
- key_ideas: distinct ideas, each with why it matters + implication.
- deep_analysis: tensions, assumptions, trade-offs and limits already supported by the source.
- daily_application/action_system: small specific actions; first step under 10 minutes. Do not force productivity advice onto fiction.
- practice_tracker: seven days should deepen, not repeat; end with one carry-forward choice.
- reflection_questions: thoughtful, non-generic, not yes/no.
- real_life_example: if not factual in source, explicitly frame as composite/hypothetical.
- Keep overall length roughly similar (±20%). Empty input field must remain empty.

Return ONLY JSON with exactly these keys:
${FIELDS.join(", ")}.

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
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
      .select("title,author,language,tagline,overview,deep_summary,key_ideas,deep_analysis,daily_application,action_system,practice_tracker,reflection_questions,real_life_example")
      .eq("id", book_id).maybeSingle();
    if (be || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const lang: "en" | "hi" = book.language === "hi" ? "hi" : "en";
    const sections = Object.fromEntries(FIELDS.map(f => [f, (book as any)[f] || ""])) as Record<FieldKey, string>;
    if (FIELDS.every(f => !sections[f].trim())) {
      return new Response(JSON.stringify({ skipped: true, reason: "empty" }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a rigorous bilingual book editor. Output strict JSON only." },
          { role: "user", content: buildPrompt(lang, book.title, book.author, sections) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 16000,
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
    if (!content) return new Response(JSON.stringify({ error: "Polish failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(content); }
    catch { return new Response(JSON.stringify({ error: "Polish failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }); }

    const patch: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = typeof parsed[f] === "string" ? parsed[f].trim() : "";
      if (v && sections[f].trim()) patch[f] = v.slice(0, 30000);
    }
    if (!Object.keys(patch).length) return new Response(JSON.stringify({ error: "Polish failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const { error: ue } = await admin.from("books").update(patch).eq("id", book_id);
    if (ue) return new Response(JSON.stringify({ error: "Failed to save polished content" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, fields: Object.keys(patch) }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("polish-book-content error:", e);
    return new Response(JSON.stringify({ error: "Polish failed" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  }
});