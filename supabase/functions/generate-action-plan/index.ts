import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const GENRE_ADDONS_EN: Record<string, string> = {
  "Self-Help": "Habit OS: cue → response → reward mapping, tiny-start plan, environment design, relapse recovery.",
  "Spiritual": "Reflection System: principle → today's situation, 5-minute contemplation, values-vs-impulse worksheet.",
  "Business": "Decision Toolkit: first-principles question, one small experiment, decision review, real trade-off.",
  "Finance": "Money System: one rule to test, risk boundary, simple numbers, review trigger. Never invent financial claims.",
  "Literature": "Insight Engine: theme → character/choice → reader reflection → one real-life observation. Do not force habit advice onto fiction.",
  "Hindi Literature": "Insight Engine: theme → character/choice → reader reflection → one real-life observation. Do not force habit advice onto fiction.",
  "Philosophy": "Thinking Framework: concept → real dilemma → counterargument → personal test.",
  "Motivation": "7-Day Challenge: one tiny action each day, friction audit, review and reset.",
  "Science": "Concept → Observation: explain the idea, notice it in the real world, test understanding, flag uncertainty.",
  "History": "Context Engine: cause → consequence → competing interpretation → today's caution. Do not invent dates or events.",
  "Politics": "Context Engine: claim → evidence → counterview → present-day relevance. Avoid partisan persuasion.",
  "Education": "Recall Loop: retrieval question, explain-in-your-own-words, spaced review, one transfer task.",
  "Psychology": "Behavior Lab: trigger → response map, observation log, one reversible micro-experiment.",
  "Productivity": "System Build: one priority, friction removal, daily check-in, weekly review.",
};

const GENRE_ADDONS_HI: Record<string, string> = {
  "Self-Help": "Habit OS: संकेत → प्रतिक्रिया → परिणाम, बहुत छोटा पहला कदम, environment design, relapse recovery।",
  "Spiritual": "Reflection System: सिद्धांत → आज की स्थिति, 5 मिनट चिंतन, मूल्य बनाम आवेग worksheet।",
  "Hindi Literature": "Insight Engine: विषय → पात्र/निर्णय → पाठक का चिंतन → एक वास्तविक जीवन अवलोकन। कथा पर जबरन habit advice मत थोपो।",
  "Literature": "Insight Engine: विषय → पात्र/निर्णय → पाठक का चिंतन → एक वास्तविक जीवन अवलोकन। कथा पर जबरन habit advice मत थोपो।",
  "Finance": "Money System: एक नियम जिसे परखा जा सके, risk boundary, सरल संख्याएँ, review trigger। कोई वित्तीय तथ्य गढ़ना नहीं।",
  "Business": "Decision Toolkit: first-principles प्रश्न, एक छोटा प्रयोग, decision review, वास्तविक trade-off।",
  "Philosophy": "Thinking Framework: विचार → वास्तविक दुविधा → counterargument → personal test।",
  "Motivation": "7-दिन challenge: रोज़ एक छोटा काम, friction audit, review और reset।",
  "Science": "Concept → Observation: विचार समझो, दुनिया में उसे पहचानो, अपनी समझ परखो, uncertainty साफ़ लिखो।",
  "Politics": "Context Engine: तर्क → evidence → counterview → आज की relevance। partisan persuasion से बचो।",
  "History": "Context Engine: कारण → परिणाम → दूसरा दृष्टिकोण → आज की सावधानी। तारीख/घटना invent मत करो।",
  "Education": "Recall Loop: retrieval question, अपने शब्दों में समझाओ, spaced review, transfer task।",
  "Psychology": "Behavior Lab: trigger → response map, observation log, एक reversible micro-experiment।",
  "Productivity": "System Build: एक priority, friction कम करना, daily check-in, weekly review।",
};

const compact = (value: unknown, limit: number) =>
  typeof value === "string" ? value.replace(/\\n/g, "\n").trim().slice(0, limit) : "";

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

    const rl = checkRateLimit(`action-plan:${userId}`, 10, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: role } = await supabase
      .from("user_roles")
      .select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!role;
    const { data: tier, error: tierError } = await userClient.rpc("my_active_tier");
    if (!isAdmin && (tierError || !tier || tier === "free")) {
      return new Response(JSON.stringify({ error: "Premium subscription required" }), {
        status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: book, error: bookErr } = await supabase
      .from("books")
      .select("id,title,author,category,language,overview,deep_summary,key_ideas,deep_analysis,daily_application,action_system,practice_tracker,reflection_questions,real_life_example")
      .eq("id", book_id)
      .eq("is_draft", false)
      .maybeSingle();

    if (bookErr || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const isHindi = book.language === "hi";

    if (!force && book.action_system && book.practice_tracker && book.reflection_questions && (!isHindi || book.real_life_example)) {
      return new Response(JSON.stringify({
        cached: true,
        action_system: book.action_system,
        practice_tracker: book.practice_tracker,
        reflection_questions: book.reflection_questions,
        real_life_example: book.real_life_example,
      }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const addon = (isHindi ? GENRE_ADDONS_HI : GENRE_ADDONS_EN)[book.category] || (isHindi
      ? "किताब की प्रकृति के अनुसार एक छोटा, यथार्थवादी और मापने योग्य अभ्यास बनाओ।"
      : "Create one small, realistic, measurable practice that fits the nature of this book.");

    const sourceContext = [
      compact(book.overview, 3500) && `OVERVIEW:\n${compact(book.overview, 3500)}`,
      compact(book.key_ideas, 3500) && `KEY IDEAS:\n${compact(book.key_ideas, 3500)}`,
      compact(book.deep_summary, 6000) && `DEEP SUMMARY:\n${compact(book.deep_summary, 6000)}`,
      compact(book.deep_analysis, 5000) && `ANALYSIS:\n${compact(book.deep_analysis, 5000)}`,
      compact(book.daily_application, 2500) && `EXISTING APPLICATION:\n${compact(book.daily_application, 2500)}`,
    ].filter(Boolean).join("\n\n");

    let prompt: string;
    if (isHindi) {
      prompt = `तुम Booknomics के senior learning designer, editor और behavioral coach हो।

किताब: "${book.title}" — ${book.author}
Genre: ${book.category}

नीचे दिया गया SOURCE CONTEXT ही factual आधार है। इसी से काम करो। SOURCE में जो तथ्य, पात्र, घटना, सिद्धांत या दावा नहीं है, उसे गढ़ो मत। अगर किसी detail पर भरोसा नहीं है तो उसे general रखो।

SOURCE CONTEXT:
${sourceContext || "केवल title/author/category उपलब्ध हैं; इसलिए कोई book-specific fact invent मत करो।"}

लक्ष्य: reader को guilt, hype या fake motivation से नहीं, clarity + curiosity + छोटे wins से आगे बढ़ाना। Output इतना उपयोगी हो कि reader पढ़ते ही पहला कदम लेना चाहे। भाषा स्वाभाविक Hindi (Devanagari) हो; जरूरत पड़ने पर आम English terms रख सकते हो, लेकिन Hinglish overload नहीं।

Genre direction: ${addon}

QUALITY RULES:
- generic self-help filler नहीं। हर step को SOURCE के किसी idea/theme से जोड़ो।
- fiction/literature में productivity advice मत थोपो; observation, empathy, character-choice, theme reflection और discussion प्रयोग करो।
- पहला action 10 मिनट से कम का हो।
- हर section में concrete verb, clear outcome और friction-removal हो।
- moral preaching, exaggerated claims, fake quotes, invented research, invented examples नहीं।
- real-life example को "composite example" की तरह लिखो; किसी वास्तविक व्यक्ति/घटना का झूठा दावा मत करो।
- headings छोटी और memorable हों।

केवल valid JSON लौटाओ, exact schema:
{
  "action_system": "Markdown 450–650 शब्द. शुरुआत एक 2-line hook से: 'सिर्फ पढ़ें नहीं—इसे आज़माएँ।' फिर ## आज के 10 मिनट, ## इस हफ्ते का प्रयोग, ## friction हटाएँ, ## कब रुककर सोचें, ## 7वें दिन review. Numbered steps + checkboxes जहाँ उपयोगी हों।",
  "practice_tracker": "Markdown 250–400 शब्द. पहले 'इस हफ्ते का एक लक्ष्य' और 'success का छोटा माप' लिखो। फिर 7-day markdown table: Day | Tiny practice | 2-minute reflection | Done. Tasks धीरे-धीरे deepen हों, repeat filler नहीं। अंत में ## Carry Forward में अगले हफ्ते के लिए सिर्फ 1 चीज़ चुनवाओ।",
  "reflection_questions": "Markdown. Exactly 7 प्रश्न. क्रम: notice → connect → challenge → counterview → personal pattern → action → one-sentence takeaway. प्रश्न book-specific हों।",
  "real_life_example": "Markdown 150–220 शब्द. साफ़ label: 'Composite example'. भारतीय या सार्वभौमिक everyday context में एक छोटी scene-based कहानी; SOURCE के core idea को दिखाए, sermon न बने।"
}`;
    } else {
      prompt = `You are Booknomics' senior learning designer, editor, and behavioral coach.

Book: "${book.title}" by ${book.author}
Genre: ${book.category}

Treat the SOURCE CONTEXT below as the factual boundary. Do not invent characters, scenes, claims, research, quotations, historical facts, or author intent that are not supported by it. If context is thin, stay general rather than guessing.

SOURCE CONTEXT:
${sourceContext || "Only title/author/category are available; do not invent book-specific facts."}

Goal: create momentum through clarity, curiosity, and small wins — not hype, guilt, streak anxiety, or manipulative copy. The reader should immediately know what to try next.

Genre direction: ${addon}

QUALITY RULES:
- No generic self-help filler. Tie each step to a specific idea/theme present in SOURCE.
- For fiction/literature, do not force productivity habits; use observation, empathy, character choices, theme reflection, and discussion experiments.
- The first action must take under 10 minutes.
- Every section needs a concrete verb, a visible outcome, and reduced friction.
- No moralizing, fake quotes, invented studies, invented facts, or inflated promises.
- Any story must be clearly framed as a composite example, not a factual case study.
- Keep headings short and memorable.

Return ONLY valid JSON, exact schema:
{
  "action_system": "Markdown 450–650 words. Open with a 2-line hook: 'Don't just read it — test it.' Then use ## Start in 10 minutes, ## This week's experiment, ## Remove the friction, ## When to pause and question it, ## Day-7 review. Use numbered steps and checkboxes where useful.",
  "practice_tracker": "Markdown 250–400 words. Start with 'One goal for this week' and a tiny success measure. Then a 7-day markdown table: Day | Tiny practice | 2-minute reflection | Done. Tasks should deepen gradually, not repeat. End with ## Carry Forward and choose only one thing for next week.",
  "reflection_questions": "Markdown. Exactly 7 questions ordered: notice → connect → challenge → counterview → personal pattern → action → one-sentence takeaway. Make them book-specific.",
  "real_life_example": "Markdown 150–220 words. Explicitly label it 'Composite example'. Use a short scene from everyday life that makes the SOURCE idea concrete without pretending it is a true case study."
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
        max_tokens: 5200,
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
