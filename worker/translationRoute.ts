// Same-origin bilingual reader: ONLY serve editorially reviewed translations
// already in D1. No AI provider, translation gateway or runtime generation.
type D1 = any;

type Env = {
  DB?: D1;
  // Temporary compatibility during the Supabase -> Cloudflare auth cutover.
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

const FIELDS = [
  "overview", "deep_summary", "key_ideas", "deep_analysis", "daily_application",
  "action_system", "practice_tracker", "reflection_questions", "real_life_example",
] as const;
const PREMIUM_FIELDS = new Set<Field>(["action_system", "practice_tracker", "reflection_questions", "real_life_example"]);
type Field = (typeof FIELDS)[number];
type Language = "en" | "hi";
type SafeUser = { id: string; email: string };

const MAX_CONTENT_CHARS = 100_000;
const SESSION_COOKIE = "bn_session";

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

async function digest(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request: Request, name: string) {
  const item = (request.headers.get("cookie") || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  try { return item ? decodeURIComponent(item.slice(name.length + 1)) : null; }
  catch { return null; }
}

async function authenticatedUser(request: Request, env: Env): Promise<SafeUser | null> {
  const session = cookieValue(request, SESSION_COOKIE);
  if (session && env.DB) {
    const row = await env.DB.prepare(
      `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
    ).bind(await digest(session)).first() as SafeUser | null;
    if (row) return row;
  }

  // Some current Vercel readers still use Supabase JWTs. Do not decode JWTs
  // without verifying them with the issuer, and remove this bridge after cutover.
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const authUrl = new URL("/auth/v1/user", env.SUPABASE_URL);
  if (authUrl.protocol !== "https:") return null;
  const verification = await fetch(authUrl, {
    headers: { authorization: `Bearer ${bearer}`, apikey: env.SUPABASE_ANON_KEY },
    signal: AbortSignal.timeout(10_000),
  });
  if (!verification.ok) return null;
  const user = await verification.json().catch(() => null) as { id?: unknown; email?: unknown } | null;
  return typeof user?.id === "string" && typeof user?.email === "string"
    ? { id: user.id, email: user.email } : null;
}

async function premiumAccess(db: D1, user: SafeUser) {
  const row = await db.prepare(
    `SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND status = 'active'
     AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) LIMIT 1`,
  ).bind(user.id).first();
  return !!row;
}

export async function handleTranslationRoute(request: Request, env: Env): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/api/translate") return null;
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.DB) return json({ error: "D1 binding not configured", code: "SERVER_NOT_CONFIGURED" }, 503);
  try {
    const user = await authenticatedUser(request, env);
    if (!user) return json({ error: "Sign in again to translate this book." }, 401);

    const body = await request.json().catch(() => null) as { bookId?: unknown; targetLanguage?: unknown } | null;
    if (!body || typeof body.bookId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.bookId)
      || !["en", "hi"].includes(String(body.targetLanguage))) {
      return json({ error: "Invalid book or target language." }, 400);
    }
    const target = body.targetLanguage as Language;
    const row = await env.DB.prepare(
      `SELECT id, language, ${FIELDS.join(", ")} FROM books
       WHERE id = ? AND is_draft = 0 AND status IN ('published', 'published_noindex') LIMIT 1`,
    ).bind(body.bookId).first() as (Record<Field, string | null> & { id: string; language: string }) | null;
    if (!row) return json({ error: "Published book not found." }, 404);
    const source: Language = row.language === "hi" ? "hi" : "en";
    if (source === target) return json({ error: "Choose a different target language." }, 400);
    const premium = await premiumAccess(env.DB, user);
    const accessTier = premium ? "premium" : "free";
    const sections = Object.fromEntries(FIELDS.filter((field) => (premium || !PREMIUM_FIELDS.has(field))
      && typeof row[field] === "string" && row[field]!.trim())
      .map((field) => [field, row[field]])) as Partial<Record<Field, string>>;
    const total = Object.values(sections).reduce((n, value) => n + value.length, 0);
    if (!total || total > MAX_CONTENT_CHARS) return json({ error: "Book content exceeds translation limits or is empty." }, 413);
    const sourceHash = await digest(JSON.stringify({ source, sections }));
    const cached = await env.DB.prepare(
      `SELECT source_hash, content_json FROM book_translations
       WHERE book_id = ? AND target_language = ? AND access_tier = ? AND review_status = 'approved' LIMIT 1`,
    ).bind(row.id, target, accessTier).first() as { source_hash: string; content_json: string } | null;
    if (cached?.source_hash === sourceHash) {
      try {
        const parsed = JSON.parse(cached.content_json);
        if (parsed && Object.keys(sections).every((field) => typeof parsed[field] === "string" && parsed[field].trim())) {
          // Always project the current tier's allowed fields; even a poisoned or
          // legacy cache row must not disclose premium text to a free reader.
          const safe = Object.fromEntries(Object.keys(sections).map((field) => [field, parsed[field]]));
          return json({ sections: safe, targetLanguage: target, cached: true });
        }
      } catch { /* A corrupt cache entry must never replace original text. */ }
    }

    return json({
      error: target === "hi"
        ? "इस किताब का जाँचा हुआ हिंदी अनुवाद अभी तैयार नहीं है। मूल भाषा सुरक्षित है।"
        : "The reviewed English translation of this book is not ready yet. Original text is preserved.",
      code: "TRANSLATION_NOT_READY",
    }, 409);
  } catch (error) {
    console.error("translation_route_failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "Saved translation could not be loaded. Original text is preserved." }, 502);
  }
}
