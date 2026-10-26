type D1 = any;
type R2 = any;

export type AdminMediaAiEnv = {
  DB?: D1;
  BOOK_COVERS?: R2;
  BOOK_ASSETS?: R2;
  XAI_API_KEY?: string;
  LOVABLE_API_KEY?: string;
};

type SafeUser = { id: string; email: string };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

async function requireAdmin(request: Request, env: AdminMediaAiEnv): Promise<{ user: SafeUser | null; response: Response | null }> {
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

async function rateLimit(request: Request, env: AdminMediaAiEnv, user: SafeUser, reason: string, limit: number) {
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

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function mediaPath(kind: "covers" | "assets", key: string) {
  return `/media/${kind}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function generateCover(request: Request, env: AdminMediaAiEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.XAI_API_KEY || !env.BOOK_COVERS) return json({ error: "Image service not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as any;
  const bookId = typeof body?.book_id === "string" ? body.book_id : "";
  const customPrompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "book_id required" }, { status: 400 });
  if (!(await rateLimit(request, env, auth.user!, "ai:generate-cover", 30))) return json({ error: "Rate limit" }, { status: 429 });

  const book = await env.DB!.prepare("SELECT id, title, author, category, tagline FROM books WHERE id = ? LIMIT 1").bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });
  const prompt = customPrompt || `Premium minimalist book cover for "${book.title}" by ${book.author}. Category: ${book.category}. ${book.tagline ?? ""}. Editorial typography, elegant gradient, no text artifacts, vertical 2:3 portrait composition, high quality, abstract symbolic illustration.`;

  const genRes = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${env.XAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "grok-2-image", prompt, n: 1, response_format: "b64_json" }),
  });
  const genData = await genRes.json().catch(() => ({})) as any;
  if (!genRes.ok) {
    console.error("Grok image error", genRes.status, JSON.stringify(genData).slice(0, 400));
    return json({ error: "Image generation failed" }, { status: 502 });
  }
  const b64 = genData?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) return json({ error: "No image returned" }, { status: 502 });

  const bytes = decodeBase64(b64);
  const key = `${bookId}/${Date.now()}.png`;
  await env.BOOK_COVERS.put(key, bytes, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
  });
  const coverUrl = mediaPath("covers", key);
  await env.DB!.prepare("UPDATE books SET cover_url = ? WHERE id = ?").bind(coverUrl, bookId).run();
  return json({ cover_url: coverUrl });
}

async function callLovable(key: string, body: unknown) {
  const response = await fetch(LOVABLE_AI, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("mastery AI error", response.status, text.slice(0, 400));
    if (response.status === 429) throw new Error("Rate limit — try again in a minute");
    if (response.status === 402) throw new Error("AI credits exhausted — top up workspace credits");
    throw new Error("AI gateway failed");
  }
  return response.json() as Promise<any>;
}

function stripJson(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function uid() {
  return crypto.randomUUID().slice(0, 8);
}

async function generateMastery(request: Request, env: AdminMediaAiEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.LOVABLE_API_KEY) return json({ error: "AI service not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as any;
  const bookId = typeof body?.book_id === "string" ? body.book_id : "";
  const action = typeof body?.action === "string" ? body.action : "";
  if (!/^[0-9a-f-]{36}$/i.test(bookId) || !["quiz", "flashcards", "mindmap"].includes(action)) {
    return json({ error: "book_id and valid action required" }, { status: 400 });
  }
  if (!(await rateLimit(request, env, auth.user!, "ai:mastery", 60))) return json({ error: "Rate limit" }, { status: 429 });

  const book = await env.DB!.prepare(
    `SELECT title, author, category, overview, key_ideas, deep_analysis, action_system
     FROM books WHERE id = ? LIMIT 1`,
  ).bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });
  const sourceText = typeof body?.source_text === "string" ? body.source_text.trim() : "";
  const baseContext = sourceText
    ? sourceText.slice(0, 18000)
    : [book.overview, book.key_ideas, book.deep_analysis, book.action_system].filter(Boolean).join("\n\n").slice(0, 18000);

  if (action === "quiz") {
    const n = Math.min(Math.max(Number(body?.count) || 10, 3), 20);
    const diff = ["Easy", "Medium", "Hard"].includes(body?.difficulty) ? body.difficulty : "Medium";
    const prompt = `Create EXACTLY ${n} multiple-choice questions (${diff} difficulty) from this book "${book.title}" by ${book.author}.\nEach: question (max 25 words), 4 plausible options, correct_option (0-3 index), explanation (max 40 words).\nCover different aspects/chapters. Output ONLY valid JSON array. No markdown.\n\nSource:\n${baseContext}\n\nFormat: [{"question":"...","options":["A","B","C","D"],"correct_option":0,"explanation":"..."}]`;
    const result = await callLovable(env.LOVABLE_API_KEY, {
      model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }, max_tokens: 3000,
    });
    const text = stripJson(result?.choices?.[0]?.message?.content ?? "[]");
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return json({ error: "AI returned invalid JSON" }, { status: 502 }); }
    const source = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.quiz || []);
    const quiz = source.slice(0, n).map((q: any) => ({
      id: uid(), question: String(q.question || "").trim(),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map((option: any) => String(option)) : [],
      correct_option: Math.max(0, Math.min(3, Number(q.correct_option ?? q.correctAnswer ?? 0))),
      explanation: String(q.explanation || "").trim(),
    })).filter((q: any) => q.question && q.options.length >= 2);
    return json({ ok: true, quiz });
  }

  if (action === "flashcards") {
    const n = Math.min(Math.max(Number(body?.count) || 12, 4), 30);
    const prompt = `Create EXACTLY ${n} flashcards from this book "${book.title}" by ${book.author}.\nEach: front (concept/question, max 15 words), back (key insight/answer, max 60 words).\nCover different concepts. Output ONLY valid JSON array. No markdown.\n\nSource:\n${baseContext}\n\nFormat: [{"front":"...","back":"..."}]`;
    const result = await callLovable(env.LOVABLE_API_KEY, {
      model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }, max_tokens: 4000,
    });
    const text = stripJson(result?.choices?.[0]?.message?.content ?? "[]");
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return json({ error: "AI returned invalid JSON" }, { status: 502 }); }
    const source = Array.isArray(parsed) ? parsed : (parsed.flashcards || parsed.cards || []);
    const flashcards = source.slice(0, n).map((card: any) => ({
      id: uid(), front: String(card.front || card.question || "").trim(), back: String(card.back || card.answer || "").trim(),
    })).filter((card: any) => card.front && card.back);
    return json({ ok: true, flashcards });
  }

  if (!env.BOOK_ASSETS) return json({ error: "R2 asset binding not configured" }, { status: 503 });
  const prompt = `Create a beautiful hierarchical mind map diagram for the book "${book.title}" by ${book.author}.\nCentral node: the book title in bold. Around it, 5-7 main branches representing the core themes/concepts of this book.\nEach main branch has 2-4 sub-nodes with brief labels (1-4 words).\nStyle: clean modern editorial design, warm color palette, white background, elegant serif typography, connecting curves, generous spacing, premium book-club aesthetic.\nFormat: landscape 16:9, high contrast, no clutter.\n\nThemes to include (extract from source):\n${baseContext.slice(0, 4000)}`;
  const result = await callLovable(env.LOVABLE_API_KEY, {
    model: "google/gemini-2.5-flash-image-preview", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"],
  });
  const imageUrl: string | undefined = result?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl?.startsWith("data:")) return json({ error: "AI did not return image" }, { status: 502 });
  const [meta, b64] = imageUrl.split(",");
  const mime = meta.match(/data:(.+?);base64/)?.[1] || "image/png";
  const extension = mime === "image/jpeg" ? "jpg" : mime === "image/svg+xml" ? "svg" : "png";
  const bytes = decodeBase64(b64);
  const key = `${bookId}/mindmap-${Date.now()}.${extension}`;
  await env.BOOK_ASSETS.put(key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" },
  });
  return json({ ok: true, mindmap_url: mediaPath("assets", key) });
}

export async function handleAdminMediaAiRoute(request: Request, env: AdminMediaAiEnv): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  try {
    if (pathname === "/api/admin/ai/generate-cover" && request.method === "POST") return await generateCover(request, env);
    if (pathname === "/api/admin/ai/mastery" && request.method === "POST") return await generateMastery(request, env);
    return null;
  } catch (error) {
    console.error("admin media AI route failed", error);
    return json({ error: error instanceof Error ? error.message : "AI request failed" }, { status: 500 });
  }
}
