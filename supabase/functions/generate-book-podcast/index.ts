import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const VOICE_HI = "XrExE9yKIg1WjnnlVkGX";
const VOICE_EN = "nPczCjzI2devNBz1zQrb";
const CHUNK_CHARS = 3400;

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[#*_`>]+/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function splitForTts(text: string, maxChars = CHUNK_CHARS): string[] {
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    const next = (current + " " + sentence).trim();
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= maxChars) {
      current = sentence.trim();
    } else {
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function synthesize(apiKey: string, voiceId: string, text: string, lang: "hi" | "en") {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
          speed: lang === "hi" ? 0.95 : 1.0,
        },
      }),
    },
  );
  if (!response.ok) {
    console.error("ElevenLabs error:", response.status, (await response.text()).slice(0, 300));
    throw new Error("Audio generation failed");
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function buildPodcastScript(
  geminiKey: string,
  book: any,
  lang: "hi" | "en",
  durationMinutes: number,
): Promise<string> {
  const targetWords = Math.round(durationMinutes * 130);
  const context = [
    cleanText(book.tagline),
    cleanText(book.overview),
    cleanText(book.deep_summary),
    cleanText(book.key_ideas),
    cleanText(book.deep_analysis),
    cleanText(book.daily_application),
  ].filter(Boolean).join("\n\n").slice(0, 50000);

  const languageRule = lang === "hi"
    ? "Write natural spoken Hindi in Devanagari. Sound warm, intelligent and conversational."
    : "Write natural spoken English. Sound warm, intelligent and conversational.";

  const prompt = `Create a single-host Booknomics podcast script about "${book.title}" by ${book.author}.
Target duration: approximately ${durationMinutes} minutes (around ${targetWords} words).
${languageRule}

Use the Booknomics editorial material below as source context. Do not reproduce long passages from the original book. Do not invent quotations, page numbers, scenes or claims. Explain the premise, story arc or core arguments, key themes, deeper interpretation, present-day relevance and a concise closing takeaway. Make it sound like a polished podcast, not an article being read aloud. No markdown, timestamps, stage directions or speaker labels.

SOURCE MATERIAL:
${context}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: 7000 },
      }),
    },
  );
  if (!response.ok) {
    console.error("Gemini podcast error:", response.status, (await response.text()).slice(0, 300));
    throw new Error("Podcast script generation failed");
  }

  const json = await response.json();
  const script = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!script) throw new Error("Podcast script generation failed");
  return script;
}

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { book_id, language, duration_minutes = 15 } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) {
      return new Response(JSON.stringify({ error: "book_id required" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (language !== undefined && language !== "hi" && language !== "en") {
      return new Response(JSON.stringify({ error: "language must be 'hi' or 'en'" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const duration = Math.min(Math.max(Number(duration_minutes) || 15, 8), 20);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const elevenKey = Deno.env.get("ELEVENLABS_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!elevenKey || !geminiKey) {
      return new Response(JSON.stringify({ error: "Podcast services not configured" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const rl = checkRateLimit(`generate-podcast:${user.id}`, 8, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: book, error: bookError } = await admin.from("books")
      .select("id,title,author,tagline,overview,deep_summary,key_ideas,deep_analysis,daily_application,language")
      .eq("id", book_id).maybeSingle();
    if (bookError || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), {
        status: 404,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (!book.overview && !book.deep_summary) {
      return new Response(JSON.stringify({ error: "Generate book content before creating the podcast" }), {
        status: 409,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const lang: "hi" | "en" = (language || book.language) === "hi" ? "hi" : "en";
    const script = await buildPodcastScript(geminiKey, book, lang, duration);
    const chunks = splitForTts(script);
    const voiceId = lang === "hi" ? VOICE_HI : VOICE_EN;
    const audioParts: Uint8Array[] = [];
    for (const chunk of chunks) {
      audioParts.push(await synthesize(elevenKey, voiceId, chunk, lang));
    }

    const audio = concatBytes(audioParts);
    const path = `${book.id}/podcast-${lang}-${Date.now()}.mp3`;
    const { error: uploadError } = await admin.storage.from("book-assets")
      .upload(path, audio, { contentType: "audio/mpeg", upsert: false });
    if (uploadError) {
      console.error("Podcast upload error:", uploadError.message);
      return new Response(JSON.stringify({ error: "Podcast upload failed" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: publicUrl } = admin.storage.from("book-assets").getPublicUrl(path);
    const audio_url = publicUrl.publicUrl;
    const { error: saveError } = await admin.from("book_assets").upsert(
      { book_id: book.id, audio_url, status: "published" },
      { onConflict: "book_id" },
    );
    if (saveError) {
      console.error("Podcast metadata error:", saveError.message);
      return new Response(JSON.stringify({ error: "Podcast metadata save failed" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      audio_url,
      language: lang,
      target_duration_minutes: duration,
      script_words: script.split(/\s+/).length,
      chunks: chunks.length,
    }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-book-podcast error:", error);
    return new Response(JSON.stringify({ error: "Podcast generation failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
