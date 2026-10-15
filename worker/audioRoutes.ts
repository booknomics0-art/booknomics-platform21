type D1 = any;
export type AudioEnv = { DB?: D1; ELEVENLABS_API_KEY?: string };

type SafeUser = { id: string; email: string };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const VOICE_HI = "XrExE9yKIg1WjnnlVkGX";
const VOICE_EN = "nPczCjzI2devNBz1zQrb";
const FREE_CHARS = 900;
const PREMIUM_CHARS = 3600;

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

async function currentUser(request: Request, db: D1): Promise<SafeUser | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first();
  return row ? row as SafeUser : null;
}

const buildScript = (book: any, lang: "hi" | "en") => {
  const parts = [book.tagline, book.overview, book.key_ideas, book.daily_application].filter(Boolean);
  const text = parts.join("\n\n").replace(/[#*_`>\-]+/g, " ").replace(/\s+/g, " ").trim();
  return lang === "hi"
    ? `${book.title} — ${book.author}. ${text}`
    : `${book.title}, by ${book.author}. ${text}`;
};

async function underRateLimit(request: Request, env: AudioEnv, user: SafeUser) {
  const reason = "user-audio:tts";
  const row = await env.DB!.prepare(
    `SELECT COUNT(*) AS total FROM admin_access_logs
     WHERE user_id = ? AND reason = ? AND datetime(created_at) >= datetime('now', '-1 hour')`,
  ).bind(user.id, reason).first();
  if (Number(row?.total || 0) >= 10) return false;
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

export async function handleAudioRoute(request: Request, env: AudioEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/book-audio" || request.method !== "POST") return null;
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  if (!env.ELEVENLABS_API_KEY) return json({ error: "Audio service not configured" }, { status: 503 });

  try {
    const user = await currentUser(request, env.DB);
    if (!user) return json({ error: "Authentication required" }, { status: 401 });
    if (!(await underRateLimit(request, env, user))) {
      return json({ error: "Audio rate limit reached. Try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => null) as { book_id?: unknown; lang?: unknown } | null;
    const bookId = typeof body?.book_id === "string" ? body.book_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "book_id required" }, { status: 400 });
    const requestedLang = body?.lang === "hi" ? "hi" : "en";

    const subscription = await env.DB.prepare(
      `SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND status = 'active'
       AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) LIMIT 1`,
    ).bind(user.id).first();
    const isPremium = Boolean(subscription);

    const book = await env.DB.prepare(
      `SELECT title,author,tagline,overview,key_ideas,daily_application,language
       FROM books WHERE id = ? AND is_draft = 0 AND status IN ('published','published_noindex') LIMIT 1`,
    ).bind(bookId).first();
    if (!book) return json({ error: "Book not found" }, { status: 404 });

    const useLang: "hi" | "en" = book.language === "hi" ? "hi" : requestedLang;
    const script = buildScript(book, useLang).slice(0, isPremium ? PREMIUM_CHARS : FREE_CHARS);
    if (!script.trim()) return json({ error: "Audio source text is unavailable" }, { status: 422 });
    const voiceId = useLang === "hi" ? VOICE_HI : VOICE_EN;

    const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
          speed: useLang === "hi" ? 0.95 : 1.0,
        },
      }),
    });

    if (!tts.ok) {
      const detail = await tts.text().catch(() => "");
      console.error("ElevenLabs TTS failed", tts.status, detail.slice(0, 300));
      return json({ error: "Audio generation failed" }, { status: 502 });
    }

    return new Response(await tts.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
        "x-premium": String(isPremium),
        "x-duration-tier": isPremium ? "premium" : "free",
      },
    });
  } catch (error) {
    console.error("book audio route failed", error);
    return json({ error: "Audio generation failed. Please try again." }, { status: 500 });
  }
}
