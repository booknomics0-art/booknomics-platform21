import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    // verify admin
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (roleErr || !roleRow) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const rl = checkRateLimit(`cover:${user.id}`, 30, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { book_id, prompt: customPrompt } = await req.json();
    if (!book_id || typeof book_id !== "string" || book_id.length > 64) return new Response(JSON.stringify({ error: "book_id required" }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: book, error: bErr } = await admin.from("books").select("id,title,author,category,tagline").eq("id", book_id).maybeSingle();
    if (bErr || !book) return new Response(JSON.stringify({ error: "Book not found" }), { status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    const prompt = customPrompt?.trim() ||
      `Premium minimalist book cover for "${book.title}" by ${book.author}. Category: ${book.category}. ${book.tagline ?? ""}. Editorial typography, elegant gradient, no text artifacts, vertical 2:3 portrait composition, high quality, abstract symbolic illustration.`;

    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) return new Response(JSON.stringify({ error: "Image service not configured" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

    // Grok image generation
    const genRes = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "grok-2-image", prompt, n: 1, response_format: "b64_json" }),
    });
    const genData = await genRes.json();
    if (!genRes.ok) {
      console.error("Grok image error:", genData);
      return new Response(JSON.stringify({ error: "Image generation failed" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const b64 = genData?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("Grok returned no image:", genData);
      return new Response(JSON.stringify({ error: "No image returned" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }

    // upload to storage
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${book.id}-${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from("book-covers").upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) {
      console.error("cover upload failed:", upErr.message);
      return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
    }
    const { data: pub } = admin.storage.from("book-covers").getPublicUrl(path);
    const cover_url = pub.publicUrl;

    await admin.from("books").update({ cover_url }).eq("id", book.id);

    return new Response(JSON.stringify({ cover_url }), { headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-book-cover error:", e);
    return new Response(JSON.stringify({ error: "Cover generation failed. Please try again." }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  }
});
