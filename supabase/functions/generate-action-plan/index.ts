import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const GENRE_ADDONS_EN: Record<string, string> = {
  "Self-Help": "Habit OS: Cue–Craving–Response–Reward mapping, 2-Minute Rule plan, Environment Design checklist.",
  "Spiritual": "Reflection System: principle → today's situation, 5-min daily contemplation, Dharma vs Desire worksheet.",
  "Business": "Decision Toolkit: SWOT / First Principles, 2 mini case scenarios, startup action checklist.",
  "Finance": "Money System: rule of thumb (50-30-20), risk scenarios, simple calculator steps.",
  "Literature": "Insight Engine: theme → modern society link, character → behavior lessons, discussion prompts.",
  "Hindi Literature": "Insight Engine: theme → modern society link, character → behavior lessons, discussion prompts.",
  "Philosophy": "Thinking Framework: concept → real dilemma, If–Then reasoning map, pros/cons of viewpoint.",
  "Motivation": "7-Day Challenge: day-wise micro tasks, progress checklist.",
  "Science": "Concept → Application: simple explanation, real-world use cases, common misconceptions.",
  "History": "Context Engine: 3–5 timeline points, cause → effect map, today's relevance.",
  "Politics": "Context Engine: 3–5 timeline points, cause → effect map, today's relevance.",
  "Education": "Exam Booster: 5 PYQ-style questions, revision bullets, memory hooks.",
  "Psychology": "Behavior Lab: trigger → response map, weekly self-observation log, 1 micro-experiment.",
  "Productivity": "System Build: daily routine template, weekly review checklist, focus blockers list.",
};

const GENRE_ADDONS_HI: Record<string, string> = {
  "Self-Help": "Habit Tracker जोड़ें: cue → craving → response → reward, 2-minute rule, environment design checklist।",
  "Spiritual": "Daily reflection जोड़ें: सिद्धांत → आज की स्थिति, 5 मिनट का चिंतन, धर्म vs इच्छा वर्कशीट।",
  "Hindi Literature": "Character lessons: पात्रों से सीख, theme → आज के समाज से जोड़, चर्चा प्रश्न।",
  "Finance": "Money rules + examples: 50-30-20 नियम, risk scenarios, सरल calculation steps।",
  "Business": "Decision toolkit: SWOT / first principles, 2 case scenarios, startup checklist।",
  "Philosophy": "Thinking framework: सिद्धांत → real dilemma, If-Then reasoning map, pros/cons।",
  "Motivation": "7-दिन का challenge: हर दिन micro task, progress checklist।",
  "Science": "Concept → Application: सरल व्याख्या, real-world use, आम ग़लतफ़हमियाँ।",
  "Politics": "Context engine: 3-5 timeline points, cause → effect map, आज की प्रासंगिकता।",
  "Education": "Exam booster: 5 PYQ-style प्रश्न, revision bullets, memory hooks।",
};

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    const { book_id, force } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) {
      return new Response(JSON.stringify({ error: "book_id required" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Require authenticated user (any signed-in user can generate / load cache)
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Please log in to generate your action plan." }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures?.user) {
      return new Response(JSON.stringify({ error: "Your session has expired. Please log in again." }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const userId = ures.user.id;

    // Rate limit: AI generation is costly — cap per user.
    const rl = checkRateLimit(`action-plan:${userId}`, 10, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    // Determine whether the caller may persist to the shared book row.
    // Only admins may write shared book content. Everyone else can still
    // generate/read, but nothing is persisted to the shared `books` table.
    const { data: role } = await supabase
      .from("user_roles")
      .select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!role;
    const { data: tier, error: tierError } = await userClient.rpc('my_active_tier');
    if (!isAdmin && (tierError || !tier || tier === 'free')) {
      return new Response(JSON.stringify({ error: 'Premium subscription required' }), {
        status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const { data: book, error: bookErr } = await supabase
      .from("books")
      .select("id, title, author, category, language, action_system, practice_tracker, reflection_questions, real_life_example")
      .eq("id", book_id)
      .eq("is_draft", false)
      .maybeSingle();

    if (bookErr || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const isHindi = book.language === "hi";

    // Cache hit (skip if force=true). Non-admins only ever see cached content.
    if (!force && book.action_system && book.practice_tracker && book.reflection_questions && (!isHindi || book.real_life_example)) {
      return new Response(JSON.stringify({
        cached: true,
        action_system: book.action_system,
        practice_tracker: book.practice_tracker,
        reflection_questions: book.reflection_questions,
        real_life_example: book.real_life_example,
      }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const addon = (isHindi ? GENRE_ADDONS_HI : GENRE_ADDONS_EN)[book.category] || (isHindi ? "इस किताब की genre के अनुसार practical action steps।" : "Practical action steps tailored to this book's genre.");

    let prompt: string;
    if (isHindi) {
      prompt = `तुम एक expert educator और behavioral coach हो।

किताब: "${book.title}" — लेखक: ${book.author}
Genre: ${book.category}

Task: इस किताब की professional, engaging और actionable Hindi summary बनाओ। भाषा सरल और साफ हो, कोई fluff नहीं, practical examples दो, user तुरंत action ले सके।

Genre-विशेष add-on: ${addon}

केवल valid JSON लौटाओ (no code fences, no extra prose), exact schema:
{
  "action_system": "Markdown text (300–500 शब्द) — एक concrete step-by-step Action Plan जिसे reader आज से शुरू कर सके। ## headings और numbered steps use करो।",
  "practice_tracker": "Markdown text (200–350 शब्द) — 7 दिन का Practice Plan, हर दिन का छोटा task। एक markdown table बनाओ columns: Day | Task | Status (- [ ])।",
  "reflection_questions": "Markdown text — exactly 5–7 numbered reflection questions जो self-thinking trigger करें।",
  "real_life_example": "Markdown text (120–180 शब्द) — एक relatable Indian context की real-life example/कहानी जो book के idea को जीवंत करे।"
}`;
    } else {
      prompt = `You are an expert educator and behavioral designer.

Book: "${book.title}" by ${book.author}
Genre: ${book.category}
Language: English

Produce a HIGH-VALUE actionable summary. Practical, no fluff, simple language, real-life examples.
Genre-specific add-on: ${addon}

Return ONLY valid JSON matching this exact schema (no code fences):
{
  "action_system": "Markdown (300–500 words) — concrete step-by-step Action System the reader can start TODAY. Use ## headings and numbered steps.",
  "practice_tracker": "Markdown (200–350 words) — a 7-day Practice & Tracker plan as a markdown table with columns: Day | Task | Status (- [ ]).",
  "reflection_questions": "Markdown — exactly 5–7 numbered reflection questions.",
  "real_life_example": "Markdown (120–180 words) — one relatable real-life story or example that brings the book's core idea to life."
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
        max_tokens: 4000,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t.slice(0, 500));
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const ai = await aiResp.json();
    const content = ai.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("AI returned invalid JSON");
      return new Response(JSON.stringify({ error: "AI gateway failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const update = {
      action_system: typeof parsed.action_system === "string" ? parsed.action_system.slice(0, 20000) : null,
      practice_tracker: typeof parsed.practice_tracker === "string" ? parsed.practice_tracker.slice(0, 20000) : null,
      reflection_questions: typeof parsed.reflection_questions === "string" ? parsed.reflection_questions.slice(0, 20000) : null,
      real_life_example: typeof parsed.real_life_example === "string" ? parsed.real_life_example.slice(0, 20000) : null,
    };

    // Persist to the shared book row ONLY for admins.
    if (isAdmin) {
      const { error: upErr } = await supabase.from("books").update(update).eq("id", book.id);
      if (upErr) {
        console.error("Action plan persist failed", upErr.message);
        return new Response(JSON.stringify({ error: "Failed to save action plan" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ cached: false, ...update }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
