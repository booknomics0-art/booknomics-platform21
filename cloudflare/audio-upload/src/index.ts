const MAX_AUDIO_BYTES = 95 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_AUDIO_PREFIX = "r2-private:";
const PREVIEW_TTL_SECONDS = 60 * 60;
const ADMIN_EMAIL = "booknomics0@gmail.com";

type BookRow = { id: string; title: string; author: string; slug: string; seo_slug: string | null; language: string; audio_url: string | null };

function reply(body: object, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  // The admin portal signs in with Supabase Google OAuth, not Cloudflare's bn_session.
  // Never trust an email, role or user ID sent directly by the browser.
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!bearer || bearer.length > 8192 || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const base = new URL(env.SUPABASE_URL);
  if (base.protocol !== "https:" || base.pathname !== "/" || base.search || base.hash) return false;
  const authResponse = await fetch(`${base.origin}/auth/v1/user`, {
    headers: { authorization: `Bearer ${bearer}`, apikey: env.SUPABASE_ANON_KEY },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!authResponse.ok) return false;
  const user = await authResponse.json() as { id?: string; email?: string; email_confirmed_at?: string };
  if (!UUID_PATTERN.test(user.id ?? "") || user.email?.toLowerCase() !== ADMIN_EMAIL || !user.email_confirmed_at) return false;
  const role = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
  ).bind(user.id).first<{ ok: number }>();
  return Boolean(role?.ok);
}

function sameOriginMutation(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return request.headers.get("x-booknomics-audio-upload") === "1"
    && (!origin || origin === url.origin)
    && (!fetchSite || fetchSite === "same-origin" || fetchSite === "none");
}

async function catalog(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT b.id, b.title, b.author, b.slug, b.seo_slug, b.language, a.audio_url
     FROM books b LEFT JOIN book_assets a ON a.book_id = b.id
     ORDER BY b.title COLLATE NOCASE, b.id LIMIT 10000`,
  ).all<BookRow>();
  return reply({ books: result.results ?? [] });
}

async function upload(request: Request, env: Env): Promise<Response> {
  if (!sameOriginMutation(request)) return reply({ error: "Invalid upload origin" }, 403);
  if (!env.BOOK_ASSETS) return reply({ error: "R2 bucket binding is missing" }, 503);
  if (!env.AUDIO_PREVIEW_SIGNING_KEY || env.AUDIO_PREVIEW_SIGNING_KEY.length < 32) {
    return reply({ error: "Private audio preview is not configured" }, 503);
  }
  const url = new URL(request.url);
  const bookId = url.searchParams.get("bookId") ?? "";
  const replace = url.searchParams.get("replace") === "true";
  if (!UUID_PATTERN.test(bookId)) return reply({ error: "Invalid book ID" }, 400);
  if (!/^audio\/(mpeg|mp3)$/i.test(request.headers.get("content-type") ?? "")) {
    return reply({ error: "Only MP3 files are supported" }, 415);
  }
  const byteLength = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength > MAX_AUDIO_BYTES) {
    return reply({ error: "MP3 must have a known size between 1 byte and 95 MB" }, 413);
  }
  if (!request.body) return reply({ error: "MP3 file is empty" }, 400);

  const book = await env.DB.prepare("SELECT id FROM books WHERE id = ? LIMIT 1").bind(bookId).first<{ id: string }>();
  if (!book) return reply({ error: "Book was not found" }, 404);
  const existing = await env.DB.prepare("SELECT audio_url FROM book_assets WHERE book_id = ? LIMIT 1")
    .bind(bookId).first<{ audio_url: string | null }>();
  if (existing?.audio_url && !replace) return reply({ error: "This book already has an audiobook; review replacement first" }, 409);

  // An immutable, unique object key prevents accidentally overwriting any old audiobook.
  const key = `audiobooks/${bookId}/${crypto.randomUUID()}.mp3`;
  const object = await env.BOOK_ASSETS.put(key, request.body, {
    httpMetadata: { contentType: "audio/mpeg", cacheControl: "private, no-store" },
  });
  if (!object) return reply({ error: "R2 did not confirm the upload" }, 502);

  const stored = await env.BOOK_ASSETS.head(key);
  if (!stored || stored.size !== byteLength) {
    return reply({ error: "R2 object size verification failed; the book link was not changed" }, 502);
  }

  // DO NOT use /media/assets/: that existing route serves files publicly.
  // Private audio is never overlaid onto visitor pages until access rules exist.
  const audioUrl = `${PRIVATE_AUDIO_PREFIX}${key}`;
  const result = await env.DB.prepare(
    `INSERT INTO book_assets (book_id, audio_url, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET audio_url = excluded.audio_url, updated_at = excluded.updated_at
     WHERE ? = 1 OR book_assets.audio_url IS NULL OR trim(book_assets.audio_url) = ''`,
  ).bind(bookId, audioUrl, new Date().toISOString(), replace ? 1 : 0).run();
  if (!result.success || result.meta.changes !== 1) {
    // Keep the object for audit/recovery if the database write was ambiguous.
    return reply({ error: "R2 received the file, but the book link was not saved; contact admin before retrying" }, 409);
  }
  const preview_url = await issuePreview(request, env, bookId, key);
  return reply({ ok: true, book_id: bookId, audio_url: audioUrl, preview_url, bytes: stored.size });
}

async function preview(request: Request, env: Env): Promise<Response> {
  const bookId = new URL(request.url).searchParams.get("bookId") ?? "";
  if (!UUID_PATTERN.test(bookId)) return reply({ error: "Invalid book ID" }, 400);
  const row = await env.DB.prepare("SELECT audio_url FROM book_assets WHERE book_id = ? LIMIT 1")
    .bind(bookId).first<{ audio_url: string | null }>();
  const url = row?.audio_url ?? "";
  if (!url.startsWith(PRIVATE_AUDIO_PREFIX)) return reply({ error: "No private R2 audiobook for this book" }, 404);
  return reply({ preview_url: await issuePreview(request, env, bookId, url.slice(PRIVATE_AUDIO_PREFIX.length)) });
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function previewSignature(env: Env, bookId: string, key: string, expires: number): Promise<string> {
  if (!env.AUDIO_PREVIEW_SIGNING_KEY || env.AUDIO_PREVIEW_SIGNING_KEY.length < 32) {
    throw new Error("Audio preview secret is not configured");
  }
  const hmacKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.AUDIO_PREVIEW_SIGNING_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(`${bookId}:${key}:${expires}`));
  return hex(new Uint8Array(signature));
}

async function issuePreview(request: Request, env: Env, bookId: string, key: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS;
  const signature = await previewSignature(env, bookId, key, expires);
  return `/api/admin/audio/stream/${bookId}?expires=${expires}&signature=${signature}`;
}

async function streamPreview(request: Request, env: Env, bookId: string): Promise<Response> {
  if (!UUID_PATTERN.test(bookId)) return reply({ error: "Invalid book ID" }, 400);
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") ?? "";
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + PREVIEW_TTL_SECONDS || !/^[0-9a-f]{64}$/.test(signature)) {
    return reply({ error: "Preview link expired or invalid" }, 403);
  }
  const row = await env.DB.prepare("SELECT audio_url FROM book_assets WHERE book_id = ? LIMIT 1")
    .bind(bookId).first<{ audio_url: string | null }>();
  const key = row?.audio_url?.startsWith(PRIVATE_AUDIO_PREFIX) ? row.audio_url.slice(PRIVATE_AUDIO_PREFIX.length) : "";
  if (!new RegExp(`^audiobooks/${bookId}/[0-9a-f-]{36}\\.mp3$`, "i").test(key)) return reply({ error: "Audio not found" }, 404);
  const expected = await previewSignature(env, bookId, key, expires);
  // Compare HMACs without early-exit per-character timing variation.
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference !== 0) return reply({ error: "Preview signature is invalid" }, 403);
  const object = await env.BOOK_ASSETS.get(key, { range: request.headers });
  if (!object || !('body' in object) || !object.body) return reply({ error: "Audio object missing" }, 404);
  const headers = new Headers({
    "cache-control": "private, no-store", "accept-ranges": "bytes", "content-type": "audio/mpeg",
    "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
  });
  const range = object.range;
  if (range) {
    const start = "suffix" in range ? Math.max(0, object.size - range.suffix) : (range.offset ?? 0);
    const length = "suffix" in range ? object.size - start : (range.length ?? object.size - start);
    headers.set("content-range", `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
  } else {
    headers.set("content-length", String(object.size));
  }
  return new Response(request.method === "HEAD" ? null : object.body, {
    status: range ? 206 : 200, headers,
  });
}

/** A narrowly routed Worker; it intentionally does not intercept other Booknomics APIs. */
export async function handleAudioAdminRequest(request: Request, env: Env): Promise<Response> {
  try {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/admin/audio/")) return reply({ error: "Not found" }, 404);
    const streamMatch = path.match(/^\/api\/admin\/audio\/stream\/([^/]+)$/);
    if (streamMatch && (request.method === "GET" || request.method === "HEAD")) return streamPreview(request, env, streamMatch[1]);
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.AUDIO_PREVIEW_SIGNING_KEY) {
      return reply({ error: "Audiobook authentication is not configured" }, 503);
    }
    if (!(await isAdmin(request, env))) return reply({ error: "Cloudflare admin session required" }, 403);
    if (path === "/api/admin/audio/catalog" && request.method === "GET") return catalog(env);
    if (path === "/api/admin/audio/upload" && request.method === "POST") return upload(request, env);
    if (path === "/api/admin/audio/preview" && request.method === "GET") return preview(request, env);
    return reply({ error: "Not found" }, 404);
  } catch (error) {
    console.error(JSON.stringify({ event: "audio_upload_failure", message: error instanceof Error ? error.message : "Unknown failure" }));
    return reply({ error: "Audiobook request failed; no success was recorded" }, 500);
  }
}

export default {
  fetch: handleAudioAdminRequest,
} satisfies ExportedHandler<Env>;
