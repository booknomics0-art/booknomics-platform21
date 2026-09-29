import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string" },
    summary: { type: "string" },
    key_insights: { type: "string" },
    apply_today: { type: "string" },
    reflection: { type: "string" },
    action_system: { type: "string" },
    audio_script: { type: "string" },
  },
  required: ["hook", "summary", "key_insights", "apply_today", "reflection", "action_system", "audio_script"],
};

function buildPrompt(title: string, author: string, category: string, lang: "en" | "hi") {
  const langRule = lang === "hi"
    ? "Likho natural Hindi (Devanagari) me — culturally adapted, NOT translation. Storytelling + emotional + Gen Z friendly tone."
    : "Write in clear modern English — analytical, structured, Gen Z friendly tone.";
  return `You are an elite AI Book Transformation Engine. Convert this book into a structured learning system.

Book: "${title}" by ${author} (Category: ${category})

${langRule}

Generate ALL 7 sections (no fluff, deeply insightful, action-based):
- hook: emotional + curiosity + psychological trigger (2-4 lines)
- summary: deep structured explanation (200-350 words, markdown ok)
- key_insights: 8-12 powerful insights as markdown bullet list (interpretation, not quotes)
- apply_today: 5-8 real-life actionable steps as markdown bullets
- reflection: 5-7 thought-provoking self-analysis questions as markdown bullets
- action_system: 7-day transformation plan, day-by-day, markdown
- audio_script: 2-5 min storytelling voiceover, natural speaking flow with (Pause) markers, emotional tone, plain text`;
}

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const { book_id, language } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) {
      return new Response(JSON.stringify({ error: "book_id required" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    if (language !== undefined && language !== "en" && language !== "hi") {
      return new Response(JSON.stringify({ error: "language must be 'en' or 'hi'" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    // Rate limit admin AI generation.
    const rl = checkRateLimit(`gen-content:${ures.user.id}`, 30, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: book, error: be } = await admin.from("books")
      .select("title,author,category,language").eq("id", book_id).maybeSingle();
    if (be || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const lang: "en" | "hi" = (language || book.language) === "hi" ? "hi" : "en";

    await admin.from("books").update({ status: "pending" }).eq("id", book_id);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(book.title, book.author, book.category, lang) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.8,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!aiRes.ok) {
      await admin.from("books").update({ status: "failed" }).eq("id", book_id);
      console.error("Gemini error:", aiRes.status, (await aiRes.text()).slice(0, 400));
      return new Response(JSON.stringify({ error: "Content generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const text = aiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      await admin.from("books").update({ status: "failed" }).eq("id", book_id);
      console.error("Empty AI response");
      return new Response(JSON.stringify({ error: "Content generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      await admin.from("books").update({ status: "failed" }).eq("id", book_id);
      console.error("AI returned invalid JSON");
      return new Response(JSON.stringify({ error: "Content generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    // Sanitize AI output before persisting: string-typed fields, length-capped.
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
    const update: Record<string, unknown> = {
      tagline: str(parsed.hook, 2000),
      overview: str(parsed.summary, 20000),
      key_ideas: str(parsed.key_insights, 20000),
      daily_application: str(parsed.apply_today, 20000),
      reflection_questions: str(parsed.reflection, 20000),
      action_system: str(parsed.action_system, 20000),
      deep_analysis: str(parsed.audio_script, 20000),
      language: lang,
      status: "done",
    };

    const { error: ue } = await admin.from("books").update(update).eq("id", book_id);
    if (ue) {
      console.error("Book update failed:", ue.message);
      return new Response(JSON.stringify({ error: "Failed to save content" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, language: lang }), {
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
