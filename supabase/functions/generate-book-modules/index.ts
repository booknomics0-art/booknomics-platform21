import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const PART_SPEC = [
  { n: 1, key: "hook",          en: "Emotional Hook",         hi: "भावनात्मक झलक",       premium: false },
  { n: 2, key: "core_ideas",    en: "Core Ideas",             hi: "मूल विचार",            premium: false },
  { n: 3, key: "deep_insights", en: "Deep Insights",          hi: "गहन अंतर्दृष्टि",       premium: true  },
  { n: 4, key: "real_life",     en: "Real-Life Application",  hi: "असल ज़िंदगी में प्रयोग", premium: false },
  { n: 5, key: "mistakes",      en: "Mistakes & Warnings",    hi: "ग़लतियाँ और चेतावनियाँ", premium: false },
  { n: 6, key: "action_system", en: "Action System",          hi: "एक्शन सिस्टम",         premium: true  },
  { n: 7, key: "challenge",     en: "7-Day Challenge",        hi: "7-दिन चैलेंज",         premium: true  },
  { n: 8, key: "reflection",    en: "Reflection Questions",   hi: "मनन प्रश्न",           premium: true  },
  { n: 9, key: "audio_script",  en: "Audio Narration Script", hi: "ऑडियो स्क्रिप्ट",       premium: true  },
  { n: 10, key: "related",      en: "Related Books",          hi: "मिलती-जुलती किताबें",   premium: false },
];

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const { book_id, force = false } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) {
      return new Response(JSON.stringify({ error: "book_id required" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Admin-only: this function deletes & rewrites book modules and consumes AI credits.
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures.user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    // Rate limit admin AI generation.
    const rl = checkRateLimit(`gen-modules:${ures.user.id}`, 30, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: book, error: be } = await admin.from("books")
      .select("title,author,category,language,tagline,overview,key_ideas,daily_application")
      .eq("id", book_id).maybeSingle();
    if (be || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const lang = book.language === "hi" ? "hi" : "en";

    if (!force) {
      const { count } = await admin.from("book_modules")
        .select("id", { count: "exact", head: true })
        .eq("book_id", book_id).eq("language", lang);
      if ((count ?? 0) >= 10) {
        return new Response(JSON.stringify({ cached: true, count }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const langInstruction = lang === "hi"
      ? "Likho Hindi (Devanagari) me — sahitya jaisa, gehra, modern Gen Z friendly tone. Har module 150-300 shabd."
      : "Write in clear modern English with a Gen Z friendly tone. 150-300 words per module.";

    const partsList = PART_SPEC.map(p => `${p.n}. ${p.key} — ${lang === "hi" ? p.hi : p.en}`).join("\n");

    const sys = `You are a master book-summary writer. Generate 10 modular parts for a single book in ONE response. ${langInstruction}
Rules:
- Each module is short, scannable, story-driven (70%) + insight bullets (30%).
- No fluff, no plagiarism, transformative summaries only.
- Part 9 (audio_script) must be plain narration text (no markdown).
- Part 10 (related) must be 3 book recommendations with one-line reasons.
- Use markdown inside content where helpful.`;

    const user = `Book: "${book.title}" by ${book.author} (${book.category}).
Tagline: ${book.tagline ?? ""}
Existing overview hint: ${(book.overview ?? "").slice(0, 600)}

Generate all 10 parts in this order:
${partsList}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        max_tokens: 12000,
        tools: [{
          type: "function",
          function: {
            name: "save_modules",
            description: "Save all 10 modules.",
            parameters: {
              type: "object",
              properties: {
                modules: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      part_number: { type: "integer" },
                      part_key: { type: "string" },
                      title: { type: "string" },
                      content: { type: "string" },
                    },
                    required: ["part_number", "part_key", "title", "content"],
                  },
                },
              },
              required: ["modules"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_modules" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Modules AI error:", aiRes.status, t.slice(0, 400));
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Add credits to Lovable AI workspace" }), { status: 402, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Module generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "Module generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    let parsed: { modules?: unknown };
    try {
      parsed = JSON.parse(args);
    } catch {
      console.error("Modules AI returned invalid JSON");
      return new Response(JSON.stringify({ error: "Module generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const raw = parsed.modules;
    if (!Array.isArray(raw) || raw.length === 0) {
      return new Response(JSON.stringify({ error: "Module generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    // Sanitize + shape each module before persisting.
    const rows = raw.slice(0, 10).map((m: any) => {
      const spec = PART_SPEC.find(p => p.n === m.part_number) ?? PART_SPEC.find(p => p.key === m.part_key);
      const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
      return {
        book_id,
        part_number: Number.isInteger(m.part_number) ? m.part_number : (spec?.n ?? 0),
        part_key: spec?.key ?? (typeof m.part_key === "string" ? m.part_key.slice(0, 64) : "module"),
        title: str(m.title, 300),
        content: str(m.content, 10000),
        is_premium: spec?.premium ?? false,
        language: lang,
      };
    }).filter((r: any) => r.title && r.content && r.part_number > 0 && r.part_number <= 10);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "Module generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    await admin.from("book_modules").delete().eq("book_id", book_id).eq("language", lang);
    const { error: ie } = await admin.from("book_modules").insert(rows);
    if (ie) {
      console.error("Modules insert failed:", ie.message);
      return new Response(JSON.stringify({ error: "Failed to save modules" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-book-modules error:", e);
    return new Response(JSON.stringify({ error: "Module generation failed" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  }
});
