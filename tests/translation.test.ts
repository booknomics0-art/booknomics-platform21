// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { handleTranslationRoute, translationChunks } from "../worker/translationRoute";

const bookId = "11111111-1111-4111-8111-111111111111";
const book = {
  id: bookId,
  language: "en",
  overview: "A thoughtful overview of the original book.",
  deep_summary: "Detailed summary.",
  key_ideas: "One idea.",
  deep_analysis: "Deeper analysis.",
  daily_application: "Apply today.",
  action_system: "Members-only action steps.",
  practice_tracker: "Members-only week tracker.",
  reflection_questions: "Members-only reflections.",
  real_life_example: "Members-only example.",
};

function mockDb(premium = false, cached?: { source_hash: string; content_json: string }) {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      return {
        bind(...values: unknown[]) { args = values; return this; },
        async first() {
          calls.push({ sql, args });
          if (sql.includes("FROM books")) return book;
          if (sql.includes("FROM subscriptions")) return premium ? { ok: 1 } : null;
          if (sql.includes("FROM book_translations")) return cached ?? null;
          if (sql.includes("COUNT(*)")) return { total: 0 };
          return null;
        },
        async run() { calls.push({ sql, args }); return { success: true }; },
      };
    },
  };
  return { db, calls };
}

const env = (db: unknown, key: string | undefined = "demo-key") => ({
  DB: db,
  GEMINI_API_KEY: key,
  SUPABASE_URL: "https://auth.booknomics.example",
  SUPABASE_ANON_KEY: "public-anon-key",
});

const request = (body: unknown = { bookId, targetLanguage: "hi" }, token = "valid") => new Request(
  "https://www.booknomics.com/api/translate",
  { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) },
);

let mockFetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockFetch = vi.fn(async (url: string | URL, init: RequestInit) => {
    if (String(url).includes("/auth/v1/user")) {
      if (init.headers && (init.headers as Record<string, string>).authorization === "Bearer invalid") return new Response("unauthorized", { status: 401 });
      return Response.json({ id: "user-1", email: "reader@example.com" });
    }
    const payload = JSON.parse(String(init.body));
    const prompt = payload.contents[0].parts[0].text as string;
    const source = JSON.parse(prompt.slice(prompt.indexOf("Source: ") + 8));
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ translation: `अनुवाद ${source}` }) }] } }] });
  });
  vi.stubGlobal("fetch", mockFetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("book language toggle Worker endpoint", () => {
  it("preserves source text across chunk boundaries", () => {
    const original = `${"Long paragraph. ".repeat(250)}\n\n${"Second paragraph. ".repeat(170)}`;
    const chunks = translationChunks(original);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3500)).toBe(true);
    expect(chunks.join("")).toBe(original);
  });

  it("does not claim to handle other routes", async () => {
    expect(await handleTranslationRoute(new Request("https://www.booknomics.com/api/books"), {})).toBeNull();
    const response = await handleTranslationRoute(new Request("https://www.booknomics.com/api/translate"), {});
    expect(response?.status).toBe(405);
  });

  it("refuses unverified bearer tokens", async () => {
    const { db } = mockDb();
    const response = await handleTranslationRoute(request(undefined, "invalid"), env(db));
    expect(response?.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("validates inputs and never takes the book content from the client", async () => {
    const { db } = mockDb();
    const response = await handleTranslationRoute(request({ bookId: "bad-id", targetLanguage: "hi", overview: "attacker text" }), env(db));
    expect(response?.status).toBe(400);
  });

  it("returns a clear configuration error before charging a rate-limit", async () => {
    const { db, calls } = mockDb();
    const response = await handleTranslationRoute(request(), env(db, ""));
    expect(response?.status).toBe(503);
    expect((await response?.json())?.code).toBe("PROVIDER_NOT_CONFIGURED");
    expect(calls.some(({ sql }) => sql.includes("INSERT INTO admin_access_logs"))).toBe(false);
  });

  it("translates English to Hindi for a free user without revealing premium fields", async () => {
    const { db, calls } = mockDb(false);
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(200);
    const data = await response?.json();
    expect(data.targetLanguage).toBe("hi");
    expect(Object.keys(data.sections).sort()).toEqual([
      "overview", "deep_summary", "key_ideas", "deep_analysis", "daily_application",
    ].sort());
    expect(data.sections.overview).toContain("अनुवाद");
    expect(data.sections.action_system).toBeUndefined();
    expect(calls.some(({ sql, args }) => sql.includes("INSERT INTO book_translations") && args[2] === "free")).toBe(true);
  });

  it("never leaks premium text from a pre-existing free-tier cache row", async () => {
    const freeFields = ["overview", "deep_summary", "key_ideas", "deep_analysis", "daily_application"] as const;
    const sections = Object.fromEntries(freeFields.map((field) => [field, book[field]]));
    const source_hash = createHash("sha256").update(JSON.stringify({ source: "en", sections })).digest("hex");
    const cached = { source_hash, content_json: JSON.stringify({ ...sections, action_system: book.action_system }) };
    const { db, calls } = mockDb(false, cached);
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(200);
    const data = await response?.json();
    expect(data.cached).toBe(true);
    expect(data.sections.action_system).toBeUndefined();
    expect(calls.some(({ sql, args }) => sql.includes("FROM book_translations") && args[2] === "free")).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1); // auth only; no provider call
  });

  it("can translate all nine fields for entitled users", async () => {
    const { db, calls } = mockDb(true);
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(200);
    const data = await response?.json();
    expect(Object.keys(data.sections)).toHaveLength(9);
    expect(data.sections.practice_tracker).toContain("अनुवाद");
    expect(calls.some(({ sql, args }) => sql.includes("INSERT INTO book_translations") && args[2] === "premium")).toBe(true);
  });

  it("supports Hindi-to-English reading", async () => {
    const prior = book.language;
    book.language = "hi";
    try {
      const { db } = mockDb();
      const response = await handleTranslationRoute(request({ bookId, targetLanguage: "en" }), env(db));
      expect(response?.status).toBe(200);
      expect((await response?.json())?.targetLanguage).toBe("en");
    } finally { book.language = prior; }
  });

  it("leaves the original content intact if the provider fails", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => String(url).includes("/auth/v1/user")
      ? Response.json({ id: "user-1", email: "reader@example.com" })
      : new Response("limit", { status: 429 }));
    const { db, calls } = mockDb();
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(429);
    expect((await response?.json())?.code).toBe("PROVIDER_RATE_LIMIT");
    expect(calls.some(({ sql }) => sql.includes("INSERT INTO book_translations"))).toBe(false);
  });
});
