// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { handleAudioAdminRequest } from "./index";

const BOOK_ID = "fba9e5f0-a129-47f1-9e78-972b5e642abb";
const USER_ID = "bca45e4e-f7bc-4c27-b5ca-4431b8341f37";
const AUTH = "Bearer supabase-google-access-token";

function fixture(options: { admin?: boolean; existingUrl?: string | null; bookFound?: boolean; changes?: number; headSize?: number } = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const uploads: Array<{ key: string; bytes: number; contentType: string | undefined }> = [];
  let lastUrl = options.existingUrl ?? null;
  const env = Object.assign(Object.create(null), {
    SUPABASE_URL: "https://pbkfewrtdgiagytmcigb.supabase.co",
    SUPABASE_ANON_KEY: "test-publishable-key",
    AUDIO_PREVIEW_SIGNING_KEY: "nonproduction-test-signing-key-at-least-32-bytes",
    DB: {
      prepare(sql: string) {
        return {
          bind(...params: unknown[]) {
            queries.push({ sql, params });
            return {
              async first() {
                if (sql.includes("SELECT 1 AS ok FROM user_roles")) return options.admin === false ? null : { ok: 1 };
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
        const bytes = (await new Response(body).arrayBuffer()).byteLength;
        uploads.push({ key, bytes, contentType: options.httpMetadata.contentType });
        return { key, size: bytes };
      },
      async head(key: string) {
        const saved = uploads.find((upload) => upload.key === key);
        return saved ? { size: options.headSize ?? saved.bytes } : null;
      },
      async get(key: string, { range }: { range: Headers }) {
        if (!uploads.some((x) => x.key === key)) return null;
        if (range.get("range")) return { size: 4, range: { offset: 0, length: 2 }, body: new Uint8Array([0x49, 0x44]) };
        return { size: 4, body: new Uint8Array([0x49, 0x44, 0x33, 0x04]) };
      },
    },
  }) as Env;
  return { env, queries, uploads };
}

function getCatalogRequest(authorization = AUTH) {
  return new Request("https://www.booknomics.com/api/admin/audio/catalog", { headers: { authorization } });
}

function uploadRequest(options: { body?: Uint8Array; origin?: string; type?: string; bookId?: string; replace?: boolean; csrfHeader?: boolean } = {}) {
  const body = options.body ?? new Uint8Array([0x49, 0x44, 0x33, 0x04]);
  return new Request(`https://www.booknomics.com/api/admin/audio/upload?bookId=${options.bookId ?? BOOK_ID}&replace=${Boolean(options.replace)}`, {
    method: "POST",
    headers: {
      authorization: AUTH,
      origin: options.origin ?? "https://www.booknomics.com",
      "content-type": options.type ?? "audio/mpeg",
      "content-length": String(body.length),
      ...(options.csrfHeader === false ? {} : { "x-booknomics-audio-upload": "1" }),
    },
    body,
  });
}

let verifiedUser = { id: USER_ID, email: "booknomics0@gmail.com", email_confirmed_at: "2026-10-20T00:00:00Z" };
beforeEach(() => {
  verifiedUser = { id: USER_ID, email: "booknomics0@gmail.com", email_confirmed_at: "2026-10-20T00:00:00Z" };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe("https://pbkfewrtdgiagytmcigb.supabase.co/auth/v1/user");
    expect(new Headers(init.headers).get("authorization")).toBe(AUTH);
    return Response.json(verifiedUser);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare R2 audiobook admin API", () => {
  it("denies missing token, wrong email, unconfirmed email and non-admin catalog requests", async () => {
    const { env } = fixture();
    expect((await handleAudioAdminRequest(getCatalogRequest(""), env)).status).toBe(403);
    verifiedUser.email = "someone@example.com";
    expect((await handleAudioAdminRequest(getCatalogRequest(), env)).status).toBe(403);
    verifiedUser.email = "booknomics0@gmail.com";
    verifiedUser.email_confirmed_at = "";
    expect((await handleAudioAdminRequest(getCatalogRequest(), env)).status).toBe(403);
    verifiedUser.email_confirmed_at = "2026-10-20T00:00:00Z";
    expect((await handleAudioAdminRequest(getCatalogRequest(), fixture({ admin: false }).env)).status).toBe(403);
  });

  it("serves catalog only after Supabase JWT and D1 admin role verification", async () => {
    const { env, queries } = fixture();
    const response = await handleAudioAdminRequest(getCatalogRequest(), env);
    expect(response.status).toBe(200);
    expect((await response.json()).books[0].title).toBe("White Fang");
    expect(queries[0].params[0]).toBe(USER_ID);
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
    expect(stream.headers.get("cache-control")).toBe("private, no-store");
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
});
