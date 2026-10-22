import { handleTranslationRoute } from "./translationRoute";

type D1 = any;

type Env = {
  DB?: D1;
  LOVABLE_API_KEY?: string;
};

type SafeUser = { id: string; email: string };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();

const GENRE_ADDONS_EN: Record<string, string> = {
  "Self-Help": "Habit OS: cue → response → reward mapping, tiny-start plan, environment design, relapse recovery.",
  Spiritual: "Reflection System: principle → today's situation, 5-minute contemplation, values-vs-impulse worksheet.",
  Business: "Decision Toolkit: first-principles question, one small experiment, decision review, real trade-off.",
  Finance: "Money System: one rule to test, risk boundary, simple numbers, review trigger. Never invent financial claims.",
  Literature: "Insight Engine: theme → character/choice → reader reflection → one real-life observation. Do not force habit advice onto fiction.",
  "Hindi Literature": "Insight Engine: theme → character/choice → reader reflection → one real-life observation. Do not force habit advice onto fiction.",
  Philosophy: "Thinking Framework: concept → real dilemma → counterargument → personal test.",
  Motivation: "7-Day Challenge: one tiny action each day, friction audit, review and reset.",
  Science: "Concept → Observation: explain the idea, notice it in the real world, test understanding, flag uncertainty.",
  History: "Context Engine: cause → consequence → competing interpretation → today's caution. Do not invent dates or events.",
  Politics: "Context Engine: claim → evidence → counterview → present-day relevance. Avoid partisan persuasion.",
  Education: "Recall Loop: retrieval question, explain-in-your-own-words, spaced review, one transfer task.",
  Psychology: "Behavior Lab: trigger → response map, observation log, one reversible micro-experiment.",
  Productivity: "System Build: one priority, friction removal, daily check-in, weekly review.",
};

const GENRE_ADDONS_HI: Record<string, string> = {
  "Self-Help": "Habit OS: संकेत → प्रतिक्रिया → परिणाम, बहुत छोटा पहला कदम, environment design, relapse recovery।",
  Spiritual: "Reflection System: सिद्धांत → आज की स्थिति, 5 मिनट चिंतन, मूल्य बनाम आवेग worksheet।",
  "Hindi Literature": "Insight Engine: विषय → पात्र/निर्णय → पाठक का चिंतन → एक वास्तविक जीवन अवलोकन। कथा पर जबरन habit advice मत थोपो।",
  Literature: "Insight Engine: विषय → पात्र/निर्णय → पाठक का चिंतन → एक वास्तविक जीवन अवलोकन। कथा पर जबरन habit advice मत थोपो।",
  Finance: "Money System: एक नियम जिसे परखा जा सके, risk boundary, सरल संख्याएँ, review trigger। कोई वित्तीय तथ्य गढ़ना नहीं।",
  Business: "Decision Toolkit: first-principles प्रश्न, एक छोटा प्रयोग, decision review, वास्तविक trade-off।",
  Philosophy: "Thinking Framework: विचार → वास्तविक दुविधा → counterargument → personal test।",
  Motivation: "7-दिन challenge: रोज़ एक छोटा काम, friction audit, review और reset।",
  Science: "Concept → Observation: विचार समझो, दुनिया में उसे पहचानो, अपनी समझ परखो, uncertainty साफ़ लिखो।",
  Politics: "Context Engine: तर्क → evidence → counterview → आज की relevance। partisan persuasion से बचो।",
  History: "Context Engine: कारण → परिणाम → दूसरा दृष्टिकोण → आज की सावधानी। तारीख/घटना invent मत करो।",
  Education: "Recall Loop: retrieval question, अपने शब्दों में समझाओ, spaced review, transfer task।",
  Psychology: "Behavior Lab: trigger → response map, observation log, एक reversible micro-experiment।",
  Productivity: "System Build: एक priority, friction कम करना, daily check-in, weekly review।",
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const cookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) result.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return result;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

async function requireUser(request: Request, env: Env): Promise<{ user: SafeUser | null; response: Response | null }> {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  const user = await env.DB.prepare(
    `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first() as SafeUser | null;
  if (!user) return { user: null, response: json({ error: "Session expired" }, { status: 401 }) };
  return { user, response: null };
}

async function rateLimit(request: Request, env: Env, user: SafeUser, reason: string, limit: number) {
  const recent = await env.DB!.prepare(
    `SELECT COUNT(*) AS total FROM admin_access_logs
     WHERE user_id = ? AND reason = ? AND datetime(created_at) >= datetime('now', '-1 hour')`,
  ).bind(user.id, reason).first();
  if (Number(recent?.total || 0) >= limit) return false;
  await env.DB!.prepare(
    `INSERT INTO admin_access_logs
      (id, attempted_email, user_id, ip_address, user_agent, outcome, reason, created_at)
     VALUES (?, ?, ?, ?, ?, 'allowed', ?, ?)`,
  ).bind(
    crypto.randomUUID(), user.email, user.id,
    request.headers.get("cf-connecting-ip"), request.headers.get("user-agent"),
    reason, new Date().toISOString(),
  ).run();
  return true;
}

async function callJsonAi(env: Env, prompt: string, maxTokens: number) {
  if (!env.LOVABLE_API_KEY) return { response: json({ error: "AI service not configured" }, { status: 503 }), data: null };
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.LOVABLE_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
    }),
  });
  if (!aiResp.ok) {
    const text = await aiResp.text().catch(() => "");
    console.error("book AI upstream failed", aiResp.status, text.slice(0, 400));
    if (aiResp.status === 429) return { response: json({ error: "Rate limit. Try again shortly." }, { status: 429 }), data: null };
    if (aiResp.status === 402) return { response: json({ error: "AI credits exhausted." }, { status: 402 }), data: null };
    return { response: json({ error: "AI gateway failed" }, { status: 502 }), data: null };
  }
  const payload = await aiResp.json().catch(() => null) as any;
  try {
    return { response: null, data: JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown> };
  } catch {
    return { response: json({ error: "AI gateway returned invalid JSON" }, { status: 502 }), data: null };
  }
}

const compact = (value: unknown, limit: number) =>
  typeof value === "string" ? value.replace(/\\n/g, "\n").trim().slice(0, limit) : "";

async function generateActionPlan(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const user = auth.user!;
  const body = await request.json().catch(() => null) as { book_id?: unknown; force?: unknown } | null;
  const bookId = typeof body?.book_id === "string" ? body.book_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "book_id required" }, { status: 400 });
  if (!(await rateLimit(request, env, user, "user-ai:action-plan", 10))) {
    return json({ error: "Rate limit. Try again shortly." }, { status: 429 });
  }

  const role = await env.DB!.prepare("SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1")
    .bind(user.id).first();
  const isAdmin = Boolean(role);
  const sub = await env.DB!.prepare(
    `SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND status = 'active'
     AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) LIMIT 1`,
  ).bind(user.id).first();
  if (!isAdmin && !sub) return json({ error: "Premium subscription required" }, { status: 403 });

  const book = await env.DB!.prepare(
    `SELECT id,title,author,category,language,overview,deep_summary,key_ideas,deep_analysis,daily_application,
            action_system,practice_tracker,reflection_questions,real_life_example
     FROM books WHERE id = ? AND is_draft = 0 LIMIT 1`,
  ).bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });

  const isHindi = book.language === "hi";
  const force = body?.force === true;
  if (!force && book.action_system && book.practice_tracker && book.reflection_questions && (!isHindi || book.real_life_example)) {
    return json({
      cached: true,
      action_system: book.action_system,
      practice_tracker: book.practice_tracker,
      reflection_questions: book.reflection_questions,
      real_life_example: book.real_life_example,
    });
  }

  const addon = (isHindi ? GENRE_ADDONS_HI : GENRE_ADDONS_EN)[String(book.category || "")] || (isHindi
    ? "किताब की प्रकृति के अनुसार एक छोटा, यथार्थवादी और मापने योग्य अभ्यास बनाओ।"
    : "Create one small, realistic, measurable practice that fits the nature of this book.");
  const sourceContext = [
    compact(book.overview, 3500) && `OVERVIEW:\n${compact(book.overview, 3500)}`,
    compact(book.key_ideas, 3500) && `KEY IDEAS:\n${compact(book.key_ideas, 3500)}`,
    compact(book.deep_summary, 6000) && `DEEP SUMMARY:\n${compact(book.deep_summary, 6000)}`,
    compact(book.deep_analysis, 5000) && `ANALYSIS:\n${compact(book.deep_analysis, 5000)}`,
    compact(book.daily_application, 2500) && `EXISTING APPLICATION:\n${compact(book.daily_application, 2500)}`,
  ].filter(Boolean).join("\n\n");

  const prompt = isHindi
    ? `तुम Booknomics के senior learning designer, editor और behavioral coach हो।\n\nकिताब: "${book.title}" — ${book.author}\nGenre: ${book.category}\n\nनीचे SOURCE CONTEXT ही factual आधार है। जो तथ्य SOURCE में नहीं है उसे गढ़ो मत।\n\nSOURCE CONTEXT:\n${sourceContext || "केवल title/author/category उपलब्ध हैं; कोई book-specific fact invent मत करो।"}\n\nGenre direction: ${addon}\n\nपहला action 10 मिनट से कम हो। fiction/literature पर productivity advice मत थोपो। fake quotes/research/examples नहीं।\n\nकेवल valid JSON लौटाओ:\n{\n"action_system":"Markdown 450–650 शब्द; ## आज के 10 मिनट, ## इस हफ्ते का प्रयोग, ## friction हटाएँ, ## कब रुककर सोचें, ## 7वें दिन review",\n"practice_tracker":"Markdown 250–400 शब्द; 7-day table Day | Tiny practice | 2-minute reflection | Done; अंत में ## Carry Forward",\n"reflection_questions":"Markdown में exactly 7 book-specific प्रश्न: notice → connect → challenge → counterview → personal pattern → action → one-sentence takeaway",\n"real_life_example":"Markdown 150–220 शब्द; साफ़ label Composite example; everyday scene, factual case-study का दावा नहीं"\n}`
    : `You are Booknomics' senior learning designer, editor, and behavioral coach.\n\nBook: "${book.title}" by ${book.author}\nGenre: ${book.category}\n\nTreat SOURCE CONTEXT as the factual boundary. Do not invent characters, scenes, claims, research, quotations, historical facts, or author intent.\n\nSOURCE CONTEXT:\n${sourceContext || "Only title/author/category are available; do not invent book-specific facts."}\n\nGenre direction: ${addon}\n\nThe first action must take under 10 minutes. For fiction/literature do not force productivity habits. No fake quotes, invented studies, or inflated promises.\n\nReturn ONLY valid JSON:\n{\n"action_system":"Markdown 450–650 words; ## Start in 10 minutes, ## This week's experiment, ## Remove the friction, ## When to pause and question it, ## Day-7 review",\n"practice_tracker":"Markdown 250–400 words; 7-day table Day | Tiny practice | 2-minute reflection | Done; end with ## Carry Forward",\n"reflection_questions":"Markdown with exactly 7 book-specific questions ordered notice → connect → challenge → counterview → personal pattern → action → one-sentence takeaway",\n"real_life_example":"Markdown 150–220 words; explicitly label Composite example; everyday scene, not a factual case study"\n}`;

  const result = await callJsonAi(env, prompt, 5200);
  if (result.response) return result.response;
  const update = {
    action_system: typeof result.data?.action_system === "string" ? result.data.action_system.slice(0, 20000) : null,
    practice_tracker: typeof result.data?.practice_tracker === "string" ? result.data.practice_tracker.slice(0, 20000) : null,
    reflection_questions: typeof result.data?.reflection_questions === "string" ? result.data.reflection_questions.slice(0, 20000) : null,
    real_life_example: typeof result.data?.real_life_example === "string" ? result.data.real_life_example.slice(0, 20000) : null,
  };

  if (isAdmin) {
    await env.DB!.prepare(
      `UPDATE books SET action_system = ?, practice_tracker = ?, reflection_questions = ?, real_life_example = ? WHERE id = ?`,
    ).bind(update.action_system, update.practice_tracker, update.reflection_questions, update.real_life_example, bookId).run();
  }
  return json({ cached: false, ...update });
}

export async function handleBookAiRoute(request: Request, env: Env): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  try {
    const translation = await handleTranslationRoute(request, env);
    if (translation) return translation;
    if (pathname === "/api/book-ai/translate-to-hindi") return json({
      code: "LEGACY_TRANSLATION_DISABLED",
      error: "Live translation providers are disabled. Use approved saved translations via /api/translate.",
    }, { status: 410 });
    if (pathname === "/api/book-ai/generate-action-plan" && request.method === "POST") return await generateActionPlan(request, env);
    return null;
  } catch (error) {
    console.error("book AI route failed", error);
    return json({ error: "AI request failed" }, { status: 500 });
  }
}
