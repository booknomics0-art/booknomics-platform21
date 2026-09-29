import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

// Hindi calm storyteller (Matilda) & EN modern narrator (Brian)
const VOICE_HI = "XrExE9yKIg1WjnnlVkGX";
const VOICE_EN = "nPczCjzI2devNBz1zQrb";

// Char limits ≈ words * 6. 150 wpm storytelling → 60s≈900, 240s≈3600
const FREE_CHARS = 900;
const PREMIUM_CHARS = 3600;

function buildScript(book: any, lang: "hi" | "en"): string {
  const parts = [book.tagline, book.overview, book.key_ideas, book.daily_application].filter(Boolean);
  let text = parts.join("\n\n").replace(/[#*_`>\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (lang === "hi") text = `${book.title} — ${book.author}. ${text}`;
  else text = `${book.title}, by ${book.author}. ${text}`;
  return text;
}

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

    const { book_id, lang = "en" } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) {
      return new Response(JSON.stringify({ error: "book_id required" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, serviceKey);

    // Require authentication — TTS calls are billable per character.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supaUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Rate limit: TTS is billable per character — cap per user.
    const rl = checkRateLimit(`book-audio:${user.id}`, 10, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: subData } = await admin.rpc("has_active_subscription", { _user_id: user.id });
    const isPremium = !!subData;

    const { data: book, error: be } = await admin.from("books").select("title,author,tagline,overview,key_ideas,daily_application,language").eq("id", book_id).eq("is_draft", false).maybeSingle();
    if (be || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const useLang: "hi" | "en" = book.language === "hi" ? "hi" : (lang === "hi" ? "hi" : "en");
    const limit = isPremium ? PREMIUM_CHARS : FREE_CHARS;
    const script = buildScript(book, useLang).slice(0, limit);
    const voiceId = useLang === "hi" ? VOICE_HI : VOICE_EN;

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: useLang === "hi" ? 0.95 : 1.0 },
        }),
      }
    );
    if (!ttsRes.ok) {
      console.error("TTS error:", ttsRes.status, (await ttsRes.text()).slice(0, 300));
      return new Response(JSON.stringify({ error: "Audio generation failed" }), { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const audio = await ttsRes.arrayBuffer();
    return new Response(audio, {
      headers: { ...corsHeaders(req), "Content-Type": "audio/mpeg", "X-Premium": String(isPremium), "X-Duration-Tier": isPremium ? "premium" : "free" },
    });
  } catch (e) {
    console.error("book-audio error:", e);
    return new Response(JSON.stringify({ error: "Audio generation failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
