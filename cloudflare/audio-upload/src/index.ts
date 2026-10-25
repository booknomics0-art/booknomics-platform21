const MAX_AUDIO_BYTES = 95 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_AUDIO_PREFIX = "r2-private:";
const PREVIEW_TTL_SECONDS = 60 * 60;
const ADMIN_EMAIL = "booknomics0@gmail.com";
const MP3_INSPECTION_BYTES = 512 * 1024;

type BookRow = { id: string; title: string; author: string; slug: string; seo_slug: string | null; language: string; audio_url: string | null };

function reply(body: object, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  // Same HttpOnly Cloudflare session as the main Worker; never trust browser-supplied identity.
  // Decode only the known session cookie, then verify its hash, expiry and D1 admin role.
  const cookie = (request.headers.get("cookie") || "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith("bn_session="));
  const token = cookie?.slice("bn_session=".length) || "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const row = await env.DB.prepare(
    `SELECT u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN user_roles r ON r.user_id = u.id AND r.role = 'admin'
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(tokenHash).first<{ email: string }>();
  return row?.email?.toLowerCase() === ADMIN_EMAIL;
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

/** Read only a bounded prefix from private R2, never return the audio or its object key. */
function inspectMp3Prefix(bytes: Uint8Array, fullSize: number) {
  let start = 0;
  let id3Bytes = 0;
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    // The high bit must be clear in all four syncsafe ID3v2 size bytes.
    if (bytes.slice(6, 10).some((byte) => byte > 0x7f)) return { format: "invalid-id3-header", id3Bytes: 0 };
    id3Bytes = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
    if (bytes[5] & 0x10) id3Bytes += 10;
    start = id3Bytes;
  }
  if (start >= bytes.length) return { format: "id3-tag-too-large-for-sample", id3Bytes };

  const rates = [44100, 48000, 32000];
  const mpeg1Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const mpeg2Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const frame = (offset: number) => {
    if (offset + 4 > bytes.length || bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null;
    const version = (bytes[offset + 1] >> 3) & 3;
    const layer = (bytes[offset + 1] >> 1) & 3;
    const rateIndex = (bytes[offset + 2] >> 2) & 3;
    const bitrateIndex = (bytes[offset + 2] >> 4) & 15;
    if (version === 1 || layer !== 1 || rateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) return null;
    const rate = Math.round(rates[rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4));
    const bitrate = (version === 3 ? mpeg1Bitrates : mpeg2Bitrates)[bitrateIndex];
    const length = Math.floor((version === 3 ? 144 : 72) * bitrate * 1000 / rate) + ((bytes[offset + 2] >> 1) & 1);
    return { length, rate, bitrate, version: version === 3 ? "MPEG-1" : version === 2 ? "MPEG-2" : "MPEG-2.5" };
  };
  for (let offset = start; offset < Math.min(bytes.length - 4, start + 8192); offset++) {
    const first = frame(offset);
    if (!first) continue;
    // Two consecutive frames strongly distinguish MP3 from random byte sequences.
    const secondOffset = offset + first.length;
    if (secondOffset + 4 <= bytes.length && frame(secondOffset)) {
      return { format: "mp3-frames-found", id3Bytes, firstFrameOffset: offset,
        codec: `${first.version} Layer III`, bitrateKbps: first.bitrate, sampleRateHz: first.rate,
        bytes: fullSize };
    }
  }
  return { format: "no-mp3-frames-in-sample", id3Bytes, bytes: fullSize };
}

async function inspect(request: Request, env: Env): Promise<Response> {
  const bookId = new URL(request.url).searchParams.get("bookId") ?? "";
  if (!UUID_PATTERN.test(bookId)) return reply({ error: "Invalid book ID" }, 400);
  const row = await env.DB.prepare("SELECT audio_url FROM book_assets WHERE book_id = ? LIMIT 1")
    .bind(bookId).first<{ audio_url: string | null }>();
  const key = row?.audio_url?.startsWith(PRIVATE_AUDIO_PREFIX) ? row.audio_url.slice(PRIVATE_AUDIO_PREFIX.length) : "";
  if (!new RegExp(`^audiobooks/${bookId}/[0-9a-f-]{36}\\.mp3$`, "i").test(key)) return reply({ error: "Private MP3 not found" }, 404);
  const head = await env.BOOK_ASSETS.head(key);
  if (!head || head.size <= 0) return reply({ error: "R2 object missing or empty" }, 404);
  const object = await env.BOOK_ASSETS.get(key, { range: { offset: 0, length: Math.min(head.size, MP3_INSPECTION_BYTES) } });
  if (!object?.body) return reply({ error: "Could not read MP3 prefix from R2" }, 502);
  const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
  return reply({ book_id: bookId, ...inspectMp3Prefix(bytes, head.size) });
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
    if (!env.DB || !env.AUDIO_PREVIEW_SIGNING_KEY) {
      return reply({ error: "Audiobook authentication is not configured" }, 503);
    }
    if (!(await isAdmin(request, env))) return reply({ error: "Cloudflare admin session required" }, 403);
    if (path === "/api/admin/audio/catalog" && request.method === "GET") return catalog(env);
    if (path === "/api/admin/audio/upload" && request.method === "POST") return upload(request, env);
    if (path === "/api/admin/audio/preview" && request.method === "GET") return preview(request, env);
    if (path === "/api/admin/audio/inspect" && request.method === "GET") return inspect(request, env);
    return reply({ error: "Not found" }, 404);
  } catch (error) {
    console.error(JSON.stringify({ event: "audio_upload_failure", message: error instanceof Error ? error.message : "Unknown failure" }));
    return reply({ error: "Audiobook request failed; no success was recorded" }, 500);
  }
}

export default {
  fetch: handleAudioAdminRequest,
} satisfies ExportedHandler<Env>;
