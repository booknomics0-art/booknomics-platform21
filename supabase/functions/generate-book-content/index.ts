import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string" },
    overview: { type: "string" },
    deep_summary: { type: "string" },
    key_insights: { type: "string" },
    deep_analysis: { type: "string" },
    apply_today: { type: "string" },
    reflection: { type: "string" },
    action_system: { type: "string" },
  },
  required: [
    "hook",
    "overview",
    "deep_summary",
    "key_insights",
    "deep_analysis",
    "apply_today",
    "reflection",
    "action_system",
  ],
};

function buildPrompt(title: string, author: string, category: string, lang: "en" | "hi") {
  const langRule = lang === "hi"
    ? "Write natural, polished Hindi in Devanagari. Use culturally natural phrasing, not literal translation. Keep names and historical context accurate."
    : "Write polished modern English with clear structure, precise analysis and accessible language.";

  return `You are the senior editorial engine for Booknomics. Create an original, high-quality educational transformation of a book without reproducing long passages or imitating copyrighted text.

Book: "${title}" by ${author}
Category: ${category}

${langRule}

Quality rules:
- Be factually careful about the book's plot, arguments, characters and context.
- Distinguish what the book depicts from your interpretation.
- Do not invent quotations, page numbers, scenes or claims.
- Do not copy long passages from the book.
- Prefer concrete explanation over generic motivational filler.
- Use Markdown headings/bullets where helpful.
- The deep summary must be approximately 1,800–2,200 words and coherent enough to stand alone as the main Booknomics reading experience.

Return ALL sections:
1) hook: 2–4 compelling lines that frame why the book matters.
2) overview: 250–350 words giving the premise, setting, central conflict/argument and overall significance.
3) deep_summary: approximately 1,800–2,200 words. For fiction, cover the story arc, major characters, turning points, social/historical context and ending significance while avoiding excessive scene-by-scene retelling. For nonfiction, explain the core thesis, major ideas, evidence, tensions and implications.
4) key_insights: 8–12 substantial insights as Markdown bullets, each with interpretation rather than a quote.
5) deep_analysis: 450–700 words on themes, structure, worldview, strengths, tensions, limitations and present-day relevance.
6) apply_today: 5–8 realistic takeaways or reflection practices. For fiction, focus on perspective, empathy and social observation rather than forcing productivity advice.
7) reflection: 6–8 thoughtful questions.
8) action_system: a 7-day reading/reflection plan tailored to this specific book.

Output valid JSON only.`;
}

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    const { book_id, language } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) {
      return new Response(JSON.stringify({ error: "book_id required" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (language !== undefined && language !== "en" && language !== "hi") {
      return new Response(JSON.stringify({ error: "language must be 'en' or 'hi'" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const rl = checkRateLimit(`gen-content:${ures.user.id}`, 20, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: book, error: be } = await admin.from("books")
      .select("title,author,category,language").eq("id", book_id).maybeSingle();
    if (be || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), {
        status: 404,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const lang: "en" | "hi" = (language || book.language) === "hi" ? "hi" : "en";
    await admin.from("books").update({ status: "generating" }).eq("id", book_id);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(book.title, book.author, book.category, lang) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.65,
          maxOutputTokens: 14000,
        },
      }),
    });

    if (!aiRes.ok) {
      await admin.from("books").update({ status: "failed" }).eq("id", book_id);
      console.error("Gemini error:", aiRes.status, (await aiRes.text()).slice(0, 400));
      return new Response(JSON.stringify({ error: "Content generation failed" }), {
        status: 502,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const text = aiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      await admin.from("books").update({ status: "failed" }).eq("id", book_id);
      return new Response(JSON.stringify({ error: "Content generation failed" }), {
        status: 502,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      await admin.from("books").update({ status: "failed" }).eq("id", book_id);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null);
    const deepSummary = str(parsed.deep_summary, 50000);
    if (!deepSummary || deepSummary.split(/\s+/).length < 1200) {
      await admin.from("books").update({ status: "failed" }).eq("id", book_id);
      return new Response(JSON.stringify({ error: "Generated deep summary was too short; please retry" }), {
        status: 502,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = {
      tagline: str(parsed.hook, 2000),
      overview: str(parsed.overview, 20000),
      deep_summary: deepSummary,
      key_ideas: str(parsed.key_insights, 25000),
      deep_analysis: str(parsed.deep_analysis, 25000),
      daily_application: str(parsed.apply_today, 20000),
      reflection_questions: str(parsed.reflection, 20000),
      action_system: str(parsed.action_system, 25000),
      language: lang,
      reading_time: 15,
      status: "content_ready",
    };

    const { error: ue } = await admin.from("books").update(update).eq("id", book_id);
    if (ue) {
      console.error("Book update failed:", ue.message);
      return new Response(JSON.stringify({ error: "Failed to save content" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      language: lang,
      deep_summary_words: deepSummary.split(/\s+/).length,
    }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-book-content error:", e);
    return new Response(JSON.stringify({ error: "Content generation failed" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
