import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(key: string, body: unknown) {
  const r = await fetch(LOVABLE_AI, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("mastery AI error:", r.status, t.slice(0, 400));
    if (r.status === 429) throw new Error("Rate limit — try again in a minute");
    if (r.status === 402) throw new Error("AI credits exhausted — top up workspace credits");
    throw new Error("AI gateway failed");
  }
  return r.json();
}

function stripJson(s: string) {
  return s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  try {
    const { book_id, action, count, difficulty, source_text } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64 || !action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "book_id and action required" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    if (!["quiz", "flashcards", "mindmap"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid action" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin check
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures.user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const rl = checkRateLimit(`mastery:${ures.user.id}`, 60, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { data: book, error: bErr } = await admin.from("books")
      .select("title,author,category,overview,key_ideas,deep_analysis,action_system")
      .eq("id", book_id).maybeSingle();
    if (bErr || !book) return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const baseContext = source_text?.trim()
      ? source_text.slice(0, 18000)
      : [book.overview, book.key_ideas, book.deep_analysis, book.action_system]
          .filter(Boolean).join("\n\n").slice(0, 18000);

    if (action === "quiz") {
      const n = Math.min(Math.max(Number(count) || 10, 3), 20);
      const diff = ["Easy", "Medium", "Hard"].includes(difficulty) ? difficulty : "Medium";
      const prompt = `Create EXACTLY ${n} multiple-choice questions (${diff} difficulty) from this book "${book.title}" by ${book.author}.
Each: question (max 25 words), 4 plausible options, correct_option (0-3 index), explanation (max 40 words).
Cover different aspects/chapters. Output ONLY valid JSON array. No markdown.

Source:
${baseContext}

Format: [{"question":"...","options":["A","B","C","D"],"correct_option":0,"explanation":"..."}]`;

      const res = await callAI(KEY, {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });
      const txt = stripJson(res.choices?.[0]?.message?.content ?? "[]");
      let arr: any[] = [];
      try { const p = JSON.parse(txt); arr = Array.isArray(p) ? p : (p.questions || p.quiz || []); } catch { throw new Error("AI returned invalid JSON"); }
      const quiz = arr.slice(0, n).map((q) => ({
        id: uid(),
        question: String(q.question || "").trim(),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o: any) => String(o)) : [],
        correct_option: Math.max(0, Math.min(3, Number(q.correct_option ?? q.correctAnswer ?? 0))),
        explanation: String(q.explanation || "").trim(),
      })).filter((q) => q.question && q.options.length >= 2);
      return new Response(JSON.stringify({ ok: true, quiz }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    if (action === "flashcards") {
      const n = Math.min(Math.max(Number(count) || 12, 4), 30);
      const prompt = `Create EXACTLY ${n} flashcards from this book "${book.title}" by ${book.author}.
Each: front (concept/question, max 15 words), back (key insight/answer, max 60 words).
Cover different concepts. Output ONLY valid JSON array. No markdown.

Source:
${baseContext}

Format: [{"front":"...","back":"..."}]`;

      const res = await callAI(KEY, {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });
      const txt = stripJson(res.choices?.[0]?.message?.content ?? "[]");
      let arr: any[] = [];
      try { const p = JSON.parse(txt); arr = Array.isArray(p) ? p : (p.flashcards || p.cards || []); } catch { throw new Error("AI returned invalid JSON"); }
      const cards = arr.slice(0, n).map((c) => ({
        id: uid(),
        front: String(c.front || c.question || "").trim(),
        back: String(c.back || c.answer || "").trim(),
      })).filter((c) => c.front && c.back);
      return new Response(JSON.stringify({ ok: true, flashcards: cards }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    if (action === "mindmap") {
      const prompt = `Create a beautiful hierarchical mind map diagram for the book "${book.title}" by ${book.author}.
Central node: the book title in bold. Around it, 5-7 main branches representing the core themes/concepts of this book.
Each main branch has 2-4 sub-nodes with brief labels (1-4 words).
Style: clean modern editorial design, warm color palette (gold #B8860B, deep navy #1B2A5C, teal #2A7F8A, rust #B5651D, plum #6B4A6B), white background, elegant serif typography, connecting curves, generous spacing, premium book-club aesthetic.
Format: landscape 16:9, high contrast, no clutter.

Themes to include (extract from source):
${baseContext.slice(0, 4000)}`;

      const res = await callAI(KEY, {
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      });
      const imgUrl: string | undefined = res.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imgUrl?.startsWith("data:")) throw new Error("AI did not return image");
      const [meta, b64] = imgUrl.split(",");
      const mime = meta.match(/data:(.+?);base64/)?.[1] || "image/png";
      const ext = mime.split("/")[1] || "png";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${book_id}/mindmap-${Date.now()}.${ext}`;
      const { error: ue } = await admin.storage.from("book-assets").upload(path, bytes, {
        contentType: mime, upsert: true, cacheControl: "31536000",
      });
      if (ue) {
        console.error("mastery upload failed:", ue.message);
        return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      }
      const { data: pub } = admin.storage.from("book-assets").getPublicUrl(path);
      return new Response(JSON.stringify({ ok: true, mindmap_url: pub.publicUrl }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("generate-mastery-assets error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});