type D1 = any;

export type AdminContentAiEnv = {
  DB?: D1;
  GEMINI_API_KEY?: string;
  LOVABLE_API_KEY?: string;
};

type SafeUser = { id: string; email: string };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const FIELDS = [
  "tagline", "overview", "deep_summary", "key_ideas", "deep_analysis",
  "daily_application", "action_system", "practice_tracker",
  "reflection_questions", "real_life_example",
] as const;
type FieldKey = typeof FIELDS[number];

const CONTENT_SCHEMA = {
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
  required: ["hook", "overview", "deep_summary", "key_insights", "deep_analysis", "apply_today", "reflection", "action_system"],
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers },
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

async function requireAdmin(request: Request, env: AdminContentAiEnv): Promise<{ user: SafeUser | null; response: Response | null }> {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return { user: null, response: json({ error: "Auth required" }, { status: 401 }) };
  const user = await env.DB.prepare(
    `SELECT u.id, COALESCE(u.supabase_email, u.email) AS email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first() as SafeUser | null;
  if (!user) return { user: null, response: json({ error: "Not authenticated" }, { status: 401 }) };
  const role = await env.DB.prepare("SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1").bind(user.id).first();
  if (!role) return { user: null, response: json({ error: "Admin only" }, { status: 403 }) };
  return { user, response: null };
}

async function rateLimit(request: Request, env: AdminContentAiEnv, user: SafeUser, reason: string, limit: number) {
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
    crypto.randomUUID(), user.email, user.id, request.headers.get("cf-connecting-ip"),
    request.headers.get("user-agent"), reason, new Date().toISOString(),
  ).run();
  return true;
}

function buildContentPrompt(title: string, author: string, category: string, lang: "en" | "hi") {
  const langRule = lang === "hi"
    ? "Write natural, polished Hindi in Devanagari. Use culturally natural phrasing, not literal translation. Keep names and historical context accurate."
    : "Write polished modern English with clear structure, precise analysis and accessible language.";
  return `You are the senior editorial engine for Booknomics. Create an original, high-quality educational transformation of a book without reproducing long passages or imitating copyrighted text.\n\nBook: "${title}" by ${author}\nCategory: ${category}\n\n${langRule}\n\nQuality rules:\n- Be factually careful about the book's plot, arguments, characters and context.\n- Distinguish what the book depicts from your interpretation.\n- Do not invent quotations, page numbers, scenes or claims.\n- Do not copy long passages from the book.\n- Prefer concrete explanation over generic motivational filler.\n- Use Markdown headings/bullets where helpful.\n- The deep summary must be approximately 1,800–2,200 words and coherent enough to stand alone as the main Booknomics reading experience.\n\nReturn ALL sections:\n1) hook: 2–4 compelling lines that frame why the book matters.\n2) overview: 250–350 words giving the premise, setting, central conflict/argument and overall significance.\n3) deep_summary: approximately 1,800–2,200 words. For fiction, cover the story arc, major characters, turning points, social/historical context and ending significance while avoiding excessive scene-by-scene retelling. For nonfiction, explain the core thesis, major ideas, evidence, tensions and implications.\n4) key_insights: 8–12 substantial insights as Markdown bullets, each with interpretation rather than a quote.\n5) deep_analysis: 450–700 words on themes, structure, worldview, strengths, tensions, limitations and present-day relevance.\n6) apply_today: 5–8 realistic takeaways or reflection practices. For fiction, focus on perspective, empathy and social observation rather than forcing productivity advice.\n7) reflection: 6–8 thoughtful questions.\n8) action_system: a 7-day reading/reflection plan tailored to this specific book.\n\nOutput valid JSON only.`;
}

async function generateContent(request: Request, env: AdminContentAiEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.GEMINI_API_KEY) return json({ error: "AI service not configured" }, { status: 503 });

  const body = await request.json().catch(() => null) as any;
  const bookId = typeof body?.book_id === "string" ? body.book_id : "";
  const requestedLanguage = body?.language;
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "book_id required" }, { status: 400 });
  if (requestedLanguage !== undefined && requestedLanguage !== "en" && requestedLanguage !== "hi") {
    return json({ error: "language must be 'en' or 'hi'" }, { status: 400 });
  }
  if (!(await rateLimit(request, env, auth.user!, "ai:generate-content", 20))) return json({ error: "Rate limit" }, { status: 429 });

  const book = await env.DB!.prepare("SELECT title, author, category, language FROM books WHERE id = ? LIMIT 1").bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });
  const lang: "en" | "hi" = (requestedLanguage || book.language) === "hi" ? "hi" : "en";
  await env.DB!.prepare("UPDATE books SET status = 'generating' WHERE id = ?").bind(bookId).run();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const aiRes = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildContentPrompt(String(book.title), String(book.author), String(book.category), lang) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: CONTENT_SCHEMA, temperature: 0.65, maxOutputTokens: 14000 },
    }),
  });
  if (!aiRes.ok) {
    await env.DB!.prepare("UPDATE books SET status = 'failed' WHERE id = ?").bind(bookId).run();
    console.error("Gemini content error", aiRes.status, (await aiRes.text().catch(() => "")).slice(0, 400));
    return json({ error: "Content generation failed" }, { status: 502 });
  }

  const aiJson = await aiRes.json() as any;
  const text = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    await env.DB!.prepare("UPDATE books SET status = 'failed' WHERE id = ?").bind(bookId).run();
    return json({ error: "Content generation failed" }, { status: 502 });
  }
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text); }
  catch {
    await env.DB!.prepare("UPDATE books SET status = 'failed' WHERE id = ?").bind(bookId).run();
    return json({ error: "AI returned invalid JSON" }, { status: 502 });
  }
  const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : null;
  const deepSummary = str(parsed.deep_summary, 50000);
  if (!deepSummary || deepSummary.split(/\s+/).length < 1200) {
    await env.DB!.prepare("UPDATE books SET status = 'failed' WHERE id = ?").bind(bookId).run();
    return json({ error: "Generated deep summary was too short; please retry" }, { status: 502 });
  }

  await env.DB!.prepare(
    `UPDATE books SET
      tagline = ?, overview = ?, deep_summary = ?, key_ideas = ?, deep_analysis = ?,
      daily_application = ?, reflection_questions = ?, action_system = ?, language = ?,
      reading_time = 15, status = 'content_ready'
     WHERE id = ?`,
  ).bind(
    str(parsed.hook, 2000), str(parsed.overview, 20000), deepSummary,
    str(parsed.key_insights, 25000), str(parsed.deep_analysis, 25000), str(parsed.apply_today, 20000),
    str(parsed.reflection, 20000), str(parsed.action_system, 25000), lang, bookId,
  ).run();
  return json({ ok: true, language: lang, deep_summary_words: deepSummary.split(/\s+/).length });
}

function buildPolishPrompt(lang: "en" | "hi", title: string, author: string, sections: Record<FieldKey, string>) {
  const langRule = lang === "hi"
    ? "Write natural Hindi in Devanagari. Reduce awkward Hinglish, but keep common English terms when clearer."
    : "Write clean modern English with active voice and natural rhythm.";
  return `You are the senior editor for Booknomics.\nBook: "${title}" by ${author}\n${langRule}\n\nImprove readability and engagement without changing facts or adding new claims.\nRules:\n- CURRENT CONTENT is the only factual source. Never invent plot points, characters, quotes, research, history, awards, influence, author intent, examples presented as fact, or new spoilers.\n- Open sections strongly; remove generic introductions, filler, repetition and vague praise.\n- Prefer concrete nouns/verbs, varied sentence rhythm and short mobile-friendly paragraphs.\n- Preserve markdown. Use bold sparingly.\n- overview: surface the central tension/question quickly.\n- deep_summary: clear progression; each paragraph must advance understanding.\n- key_ideas: distinct ideas, each with why it matters + implication.\n- deep_analysis: tensions, assumptions, trade-offs and limits already supported by the source.\n- daily_application/action_system: small specific actions; first step under 10 minutes. Do not force productivity advice onto fiction.\n- practice_tracker: seven days should deepen, not repeat; end with one carry-forward choice.\n- reflection_questions: thoughtful, non-generic, not yes/no.\n- real_life_example: if not factual in source, explicitly frame as composite/hypothetical.\n- Keep overall length roughly similar (±20%). Empty input field must remain empty.\n\nReturn ONLY JSON with exactly these keys:\n${FIELDS.join(", ")}.\n\nCURRENT CONTENT:\n${FIELDS.map((field) => `### ${field}\n${sections[field] || ""}`).join("\n\n")}`;
}

async function polishContent(request: Request, env: AdminContentAiEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.LOVABLE_API_KEY) return json({ error: "AI service not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as any;
  const bookId = typeof body?.book_id === "string" ? body.book_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "book_id required" }, { status: 400 });
  if (!(await rateLimit(request, env, auth.user!, "ai:polish-content", 60))) return json({ error: "Rate limited" }, { status: 429 });

  const book = await env.DB!.prepare(
    `SELECT title, author, language, tagline, overview, deep_summary, key_ideas, deep_analysis,
      daily_application, action_system, practice_tracker, reflection_questions, real_life_example
     FROM books WHERE id = ? LIMIT 1`,
  ).bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });
  const lang: "en" | "hi" = book.language === "hi" ? "hi" : "en";
  const sections = Object.fromEntries(FIELDS.map((field) => [field, String(book[field] || "")])) as Record<FieldKey, string>;
  if (FIELDS.every((field) => !sections[field].trim())) return json({ skipped: true, reason: "empty" });

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.LOVABLE_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a rigorous bilingual book editor. Output strict JSON only." },
        { role: "user", content: buildPolishPrompt(lang, String(book.title), String(book.author), sections) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 16000,
    }),
  });
  if (!aiRes.ok) {
    const text = await aiRes.text().catch(() => "");
    console.error("Polish AI error", aiRes.status, text.slice(0, 400));
    if (aiRes.status === 429) return json({ error: "Rate limited" }, { status: 429 });
    if (aiRes.status === 402) return json({ error: "Add credits to Lovable AI workspace" }, { status: 402 });
    return json({ error: "Polish failed" }, { status: 502 });
  }
  const aiJson = await aiRes.json() as any;
  const content = aiJson?.choices?.[0]?.message?.content;
  if (!content) return json({ error: "Polish failed" }, { status: 502 });
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(content); }
  catch { return json({ error: "Polish failed" }, { status: 502 }); }

  const patch: Array<[FieldKey, string]> = [];
  for (const field of FIELDS) {
    const value = typeof parsed[field] === "string" ? parsed[field].trim() : "";
    if (value && sections[field].trim()) patch.push([field, value.slice(0, 30000)]);
  }
  if (!patch.length) return json({ error: "Polish failed" }, { status: 502 });
  const sql = `UPDATE books SET ${patch.map(([field]) => `${field} = ?`).join(", ")} WHERE id = ?`;
  await env.DB!.prepare(sql).bind(...patch.map(([, value]) => value), bookId).run();
  return json({ ok: true, fields: patch.map(([field]) => field) });
}

export async function handleAdminContentAiRoute(request: Request, env: AdminContentAiEnv): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  try {
    if (pathname === "/api/admin/ai/generate-content" && request.method === "POST") return await generateContent(request, env);
    if (pathname === "/api/admin/ai/polish-content" && request.method === "POST") return await polishContent(request, env);
    return null;
  } catch (error) {
    console.error("admin content AI route failed", error);
    return json({ error: "AI request failed" }, { status: 500 });
  }
}
