// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleAudioAdminRequest } from "./index";

const BOOK_ID = "fba9e5f0-a129-47f1-9e78-972b5e642abb";
const SESSION = "cloudflare-admin-session-token-1234567890abcdef";

function fixture(options: { admin?: boolean; userEmail?: string; existingUrl?: string | null; bookFound?: boolean; changes?: number; headSize?: number } = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const uploads: Array<{ key: string; bytes: number; contentType: string | undefined }> = [];
  const contents = new Map<string, Uint8Array>();
  let lastUrl = options.existingUrl ?? null;
  const env = Object.assign(Object.create(null), {
    AUDIO_PREVIEW_SIGNING_KEY: "nonproduction-test-signing-key-at-least-32-bytes",
    DB: {
      prepare(sql: string) {
        return {
          bind(...params: unknown[]) {
            queries.push({ sql, params });
            return {
              async first() {
                if (sql.includes("FROM sessions s")) return options.admin === false ? null : { email: options.userEmail ?? "booknomics0@gmail.com" };
                if (sql.includes("SELECT id FROM books")) return options.bookFound === false ? null : { id: BOOK_ID };
                if (sql.includes("SELECT audio_url FROM book_assets")) return { audio_url: lastUrl };
                return null;
              },
              async run() {
                if ((options.changes ?? 1) === 1) lastUrl = params[1] as string;
                return { success: true, meta: { changes: options.changes ?? 1 } };
              },
            };
          },
          async all() { return { results: [{ id: BOOK_ID, title: "White Fang", author: "Jack London", slug: "white-fang", language: "en", audio_url: lastUrl }] }; },
        };
      },
    },
    BOOK_ASSETS: {
      async put(key: string, body: ReadableStream, options: { httpMetadata: { contentType?: string } }) {
        const content = new Uint8Array(await new Response(body).arrayBuffer());
        contents.set(key, content);
        uploads.push({ key, bytes: content.length, contentType: options.httpMetadata.contentType });
        return { key, size: content.length };
      },
      async head(key: string) {
        const saved = uploads.find((upload) => upload.key === key);
        return saved ? { size: options.headSize ?? saved.bytes } : null;
      },
      async get(key: string, { range }: { range: Headers | { offset: number; length: number } }) {
        const bytes = contents.get(key);
        if (!bytes) return null;
        const headerRange = range instanceof Headers ? range.get("range") : null;
        const start = headerRange ? Number(/^bytes=(\d+)-/.exec(headerRange)?.[1] ?? "0") : range instanceof Headers ? 0 : range.offset;
        const requested = headerRange ? /^bytes=\d+-(\d+)$/.exec(headerRange) : null;
        const length = requested ? Number(requested[1]) - start + 1 : range instanceof Headers ? bytes.length - start : range.length;
        const actualLength = Math.min(length, bytes.length - start);
        return {
          size: bytes.length,
          ...(headerRange || !(range instanceof Headers) ? { range: { offset: start, length: actualLength } } : {}),
          body: bytes.slice(start, start + actualLength),
        };
      },
    },
  }) as Env;
  return { env, queries, uploads };
}

function getCatalogRequest(session = SESSION) {
  return new Request("https://www.booknomics.com/api/admin/audio/catalog", { headers: { cookie: `bn_session=${session}` } });
}

function uploadRequest(options: { body?: Uint8Array; origin?: string; type?: string; bookId?: string; replace?: boolean; csrfHeader?: boolean } = {}) {
  const body = options.body ?? new Uint8Array([0x49, 0x44, 0x33, 0x04]);
  return new Request(`https://www.booknomics.com/api/admin/audio/upload?bookId=${options.bookId ?? BOOK_ID}&replace=${Boolean(options.replace)}`, {
    method: "POST",
    headers: {
      cookie: `bn_session=${SESSION}`,
      origin: options.origin ?? "https://www.booknomics.com",
      "content-type": options.type ?? "audio/mpeg",
      "content-length": String(body.length),
      ...(options.csrfHeader === false ? {} : { "x-booknomics-audio-upload": "1" }),
    },
    body,
  });
}

describe("Cloudflare R2 audiobook admin API", () => {
  it("denies missing or invalid session, wrong email and non-admin catalog requests", async () => {
    const { env } = fixture();
    expect((await handleAudioAdminRequest(getCatalogRequest(""), env)).status).toBe(403);
    expect((await handleAudioAdminRequest(getCatalogRequest("too-short"), env)).status).toBe(403);
    expect((await handleAudioAdminRequest(getCatalogRequest(), fixture({ userEmail: "someone@example.com" }).env)).status).toBe(403);
    expect((await handleAudioAdminRequest(getCatalogRequest(), fixture({ admin: false }).env)).status).toBe(403);
  });

  it("serves catalog only after Cloudflare cookie and D1 admin role verification", async () => {
    const { env, queries } = fixture();
    const response = await handleAudioAdminRequest(getCatalogRequest(), env);
    expect(response.status).toBe(200);
    expect((await response.json()).books[0].title).toBe("White Fang");
    expect(queries[0].sql).toContain("FROM sessions s");
    expect(queries[0].params[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores forged bearer tokens when the Cloudflare session cookie is missing", async () => {
    const forged = new Request("https://www.booknomics.com/api/admin/audio/catalog", {
      headers: { authorization: "Bearer fake-admin-token" },
    });
    expect((await handleAudioAdminRequest(forged, fixture().env)).status).toBe(403);
  });

  it("rejects cross-origin uploads and missing CSRF header", async () => {
    const { env, uploads } = fixture();
    expect((await handleAudioAdminRequest(uploadRequest({ origin: "https://evil.example" }), env)).status).toBe(403);
    expect((await handleAudioAdminRequest(uploadRequest({ csrfHeader: false }), env)).status).toBe(403);
    expect(uploads).toHaveLength(0);
  });

  it("rejects invalid MP3s and unknown books", async () => {
    const { env, uploads } = fixture();
    expect((await handleAudioAdminRequest(uploadRequest({ type: "text/plain" }), env)).status).toBe(415);
    expect((await handleAudioAdminRequest(uploadRequest({ bookId: "nope" }), env)).status).toBe(400);
    expect((await handleAudioAdminRequest(uploadRequest(), fixture({ bookFound: false }).env)).status).toBe(404);
    expect(uploads).toHaveLength(0);
  });

  it("never overwrites existing audio without explicit replacement", async () => {
    const f = fixture({ existingUrl: "https://example.com/old.mp3" });
    expect((await handleAudioAdminRequest(uploadRequest(), f.env)).status).toBe(409);
    expect(f.uploads).toHaveLength(0);
    expect((await handleAudioAdminRequest(uploadRequest({ replace: true }), f.env)).status).toBe(200);
  });

  it("streams the file to R2, records its link in D1 and verifies object size", async () => {
    const f = fixture();
    const result = await handleAudioAdminRequest(uploadRequest(), f.env);
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.audio_url).toMatch(/^r2-private:audiobooks\/fba9e5f0-.+\.mp3$/);
    expect(data.preview_url).toMatch(/^\/api\/admin\/audio\/stream\//);
    expect(f.uploads).toHaveLength(1);
    expect(f.uploads[0]).toMatchObject({ bytes: 4, contentType: "audio/mpeg" });
    expect(f.queries.some(({ sql, params }) => sql.includes("INSERT INTO book_assets") && params[1] === data.audio_url)).toBe(true);
    const stream = await handleAudioAdminRequest(new Request(`https://www.booknomics.com${data.preview_url}`, { headers: { range: "bytes=0-1" } }), f.env);
    expect(stream.status).toBe(206);
    expect(stream.headers.get("content-range")).toBe("bytes 0-1/4");
    expect(new Uint8Array(await stream.arrayBuffer())).toEqual(new Uint8Array([0x49, 0x44]));
    expect(stream.headers.get("cache-control")).toBe("private, no-store");
    const openEnded = await handleAudioAdminRequest(new Request(`https://www.booknomics.com${data.preview_url}`, { headers: { range: "bytes=0-" } }), f.env);
    expect(openEnded.status).toBe(206);
    expect(openEnded.headers.get("content-range")).toBe("bytes 0-3/4");
    expect(new Uint8Array(await openEnded.arrayBuffer())).toEqual(new Uint8Array([0x49, 0x44, 0x33, 0x04]));
    const bad = new URL(`https://www.booknomics.com${data.preview_url}`);
    bad.searchParams.set("signature", "a".repeat(64));
    expect((await handleAudioAdminRequest(new Request(bad), f.env)).status).toBe(403);
    bad.searchParams.set("expires", "1");
    expect((await handleAudioAdminRequest(new Request(bad), f.env)).status).toBe(403);
  });

  it("reports unsuccessful link or object verification instead of claiming success", async () => {
    expect((await handleAudioAdminRequest(uploadRequest(), fixture({ changes: 0 }).env)).status).toBe(409);
    expect((await handleAudioAdminRequest(uploadRequest(), fixture({ headSize: 3 }).env)).status).toBe(502);
  });

  it("inspects stored audio header without exposing private R2 object keys", async () => {
    const f = fixture();
    const mp3 = new Uint8Array(834);
    mp3.set([0xff, 0xfb, 0x90, 0x00], 0);
    mp3.set([0xff, 0xfb, 0x90, 0x00], 417);
    expect((await handleAudioAdminRequest(uploadRequest({ body: mp3 }), f.env)).status).toBe(200);
    const response = await handleAudioAdminRequest(new Request(`https://www.booknomics.com/api/admin/audio/inspect?bookId=${BOOK_ID}`, {
      headers: { cookie: `bn_session=${SESSION}` },
    }), f.env);
    expect(response.status).toBe(200);
    const inspected = await response.json() as Record<string, unknown>;
    expect(inspected).toMatchObject({ format: "mp3-frames-found", codec: "MPEG-1 Layer III", sampleRateHz: 44100, bitrateKbps: 128 });
    expect(JSON.stringify(inspected)).not.toContain("r2-private:");
    expect(JSON.stringify(inspected)).not.toContain("audiobooks/");
  });
});
