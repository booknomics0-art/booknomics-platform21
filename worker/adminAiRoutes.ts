type D1 = any;

export type AdminAiEnv = {
  DB?: D1;
  LOVABLE_API_KEY?: string;
};

type SafeUser = { id: string; email: string };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();

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

async function requireAdmin(request: Request, env: AdminAiEnv): Promise<{ user: SafeUser | null; response: Response | null }> {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return { user: null, response: json({ error: "Login required" }, { status: 401 }) };
  const user = await env.DB.prepare(
    `SELECT u.id, COALESCE(u.supabase_email, u.email) AS email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`,
  ).bind(await sha256(token)).first() as SafeUser | null;
  if (!user) return { user: null, response: json({ error: "Session expired" }, { status: 401 }) };
  const role = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
  ).bind(user.id).first();
  if (!role) return { user: null, response: json({ error: "Admin only" }, { status: 403 }) };
  return { user, response: null };
}

async function rateLimit(request: Request, env: AdminAiEnv, user: SafeUser, reason: string, limit: number) {
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
    crypto.randomUUID(),
    user.email,
    user.id,
    request.headers.get("cf-connecting-ip"),
    request.headers.get("user-agent"),
    reason,
    new Date().toISOString(),
  ).run();
  return true;
}

async function seoMarketing(request: Request, env: AdminAiEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.LOVABLE_API_KEY) return json({ error: "AI service not configured" }, { status: 503 });

  const body = await request.json().catch(() => null) as any;
  const bookId = typeof body?.book_id === "string" ? body.book_id : "";
  const mode = body?.mode === "captions" ? "captions" : body?.mode === "seo" || body?.mode == null ? "seo" : "invalid";
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "book_id required" }, { status: 400 });
  if (mode === "invalid") return json({ error: "invalid mode" }, { status: 400 });
  if (!(await rateLimit(request, env, auth.user!, "ai:seo-marketing", 60))) {
    return json({ error: "Rate limit. Try again shortly." }, { status: 429 });
  }

  const book = await env.DB!.prepare(
    `SELECT title, author, category, language, tagline, overview, key_ideas, slug
     FROM books WHERE id = ? LIMIT 1`,
  ).bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });

  const isHi = book.language === "hi";
  const ctx = `Book: "${book.title}" by ${book.author}\nCategory: ${book.category}\nHook: ${book.tagline ?? ""}\nSummary: ${String(book.overview ?? "").slice(0, 1200)}\nKey Insights: ${String(book.key_ideas ?? "").slice(0, 800)}`;
  const prompt = mode === "seo"
    ? `You are an SEO copywriter. Write in ${isHi ? "Hindi" : "English"}.\n${ctx}\n\nGenerate 3 high-CTR meta title (max 60 chars) + meta description (max 155 chars) alternatives optimized for Google search.\nUse power words, numbers, curiosity gaps. Avoid clickbait.\n\nReturn ONLY valid JSON (no code fences):\n{ "suggestions": [ { "title": "...", "description": "...", "rationale": "one short line" }, ... ] }`
    : `You are a social media strategist. Write in ${isHi ? "Hindi (Devanagari)" : "English"}.\n${ctx}\n\nGenerate 3 distinct captions:\n1. LinkedIn — professional, insight-led, 80-120 words, ends with question.\n2. Instagram — catchy hook + 3 short lines + emojis + 5 hashtags.\n3. Twitter/X — 5-tweet thread, each numbered, max 270 chars per tweet, no fluff.\n\nReturn ONLY valid JSON (no code fences):\n{\n  "linkedin": "full caption text",\n  "instagram": "full caption text",\n  "twitter": "1/ ...\\n2/ ...\\n3/ ...\\n4/ ...\\n5/ ..."\n}`;

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
      max_tokens: 3000,
    }),
  });

  if (!aiResp.ok) {
    const text = await aiResp.text().catch(() => "");
    console.error("seo marketing AI failed", aiResp.status, text.slice(0, 400));
    if (aiResp.status === 429) return json({ error: "Rate limit. Try again shortly." }, { status: 429 });
    if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, { status: 402 });
    return json({ error: "AI gateway failed" }, { status: 502 });
  }

  const ai = await aiResp.json() as any;
  const content = ai?.choices?.[0]?.message?.content ?? "{}";
  try {
    return json(JSON.parse(content));
  } catch {
    return json({ error: "AI gateway returned invalid JSON" }, { status: 502 });
  }
}

export async function handleAdminAiRoute(request: Request, env: AdminAiEnv): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  try {
    if (pathname === "/api/admin/ai/seo-marketing" && request.method === "POST") return await seoMarketing(request, env);
    return null;
  } catch (error) {
    console.error("admin AI route failed", error);
    return json({ error: "AI request failed" }, { status: 500 });
  }
}
