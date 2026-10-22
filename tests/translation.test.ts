// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { handleTranslationRoute } from "../worker/translationRoute";
import { handleBookAiRoute } from "../worker/bookAiRoutes";

const bookId = "11111111-1111-4111-8111-111111111111";
const book = {
  id: bookId, language: "en",
  overview: "The book's story and central themes.", deep_summary: "A close reading of the work.",
  key_ideas: "An important idea.", deep_analysis: "An analysis of the source.",
  daily_application: "A book-specific daily practice.",
  action_system: "Premium action plan.", practice_tracker: "Premium seven-day tracker.",
  reflection_questions: "Premium reflections.", real_life_example: "Premium example.",
};
const freeFields = ["overview", "deep_summary", "key_ideas", "deep_analysis", "daily_application"] as const;
const premiumFields = ["action_system", "practice_tracker", "reflection_questions", "real_life_example"] as const;

function reviewedTranslation(premium = false, source = "en", overrides: Record<string, unknown> = {}) {
  const fields = premium ? [...freeFields, ...premiumFields] : [...freeFields];
  const originals = Object.fromEntries(fields.map((key) => [key, book[key]]));
  const translated = Object.fromEntries(fields.map((key) => [key, `हिंदी में लिखा: ${book[key]}`]));
  return {
    source_hash: createHash("sha256").update(JSON.stringify({ source, sections: originals })).digest("hex"),
    content_json: JSON.stringify({ ...translated, ...overrides }),
  };
}

function mockDb(premium = false, reviewed: { source_hash: string; content_json: string } | null = null) {
  const queries: Array<{ sql: string; args: unknown[]; method: string }> = [];
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      return {
        bind(...values: unknown[]) { args = values; return this; },
        async first() {
          queries.push({ sql, args, method: "first" });
          if (sql.includes("FROM books")) return book;
          if (sql.includes("FROM subscriptions")) return premium ? { ok: 1 } : null;
          if (sql.includes("FROM book_translations")) return reviewed;
          return null;
        },
        async run() { queries.push({ sql, args, method: "run" }); return { success: true }; },
      };
    },
  };
  return { db, queries };
}

const env = (db: unknown) => ({
  DB: db, SUPABASE_URL: "https://auth.booknomics.example", SUPABASE_ANON_KEY: "public-anon-key",
});
const request = (body: unknown = { bookId, targetLanguage: "hi" }, token = "valid") => new Request(
  "https://www.booknomics.com/api/translate",
  { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) },
);

let authFetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  authFetch = vi.fn(async (url: URL | string, init: RequestInit) => {
    if (!String(url).endsWith("/auth/v1/user")) throw new Error("Translation API is forbidden");
    const authorization = (init.headers as Record<string, string>)?.authorization;
    if (authorization === "Bearer invalid") return new Response("unauthorized", { status: 401 });
    return Response.json({ id: "user-1", email: "reader@example.com" });
  });
  vi.stubGlobal("fetch", authFetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("API-free book language toggle", () => {
  it("disables the legacy Lovable translation provider endpoint", async () => {
    const response = await handleBookAiRoute(
      new Request("https://www.booknomics.com/api/book-ai/translate-to-hindi", { method: "POST" }), {},
    );
    expect(response?.status).toBe(410);
    expect((await response?.json())?.code).toBe("LEGACY_TRANSLATION_DISABLED");
    expect(authFetch).not.toHaveBeenCalled();
  });
  it("handles only the agreed route and method", async () => {
    expect(await handleTranslationRoute(new Request("https://www.booknomics.com/api/books"), {})).toBeNull();
    expect((await handleTranslationRoute(new Request("https://www.booknomics.com/api/translate"), {}))?.status).toBe(405);
  });

  it("rejects unverified tokens and invalid book IDs", async () => {
    const { db } = mockDb();
    expect((await handleTranslationRoute(request(undefined, "invalid"), env(db)))?.status).toBe(401);
    expect((await handleTranslationRoute(request({ bookId: "invalid", targetLanguage: "hi" }), env(db)))?.status).toBe(400);
  });

  it("serves exactly the approved five free fields from D1, without provider requests or writes", async () => {
    const { db, queries } = mockDb(false, reviewedTranslation(false, "en", { action_system: "Private leaked value" }));
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(200);
    const data = await response?.json();
    expect(data.cached).toBe(true);
    expect(data.sections.overview).toContain("हिंदी में लिखा");
    expect(Object.keys(data.sections).sort()).toEqual([...freeFields].sort());
    expect(data.sections.action_system).toBeUndefined();
    expect(queries.some((q) => q.sql.includes("review_status = 'approved'") && q.args[2] === "free")).toBe(true);
    expect(queries.some((q) => q.method === "run")).toBe(false);
    expect(authFetch).toHaveBeenCalledTimes(1); // Auth check; zero translation API calls.
  });

  it("serves all nine approved fields only to a subscribed reader", async () => {
    const { db, queries } = mockDb(true, reviewedTranslation(true));
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(200);
    const data = await response?.json();
    expect(Object.keys(data.sections)).toHaveLength(9);
    expect(data.sections.practice_tracker).toContain("हिंदी में लिखा");
    expect(queries.some((q) => q.sql.includes("FROM book_translations") && q.args[2] === "premium")).toBe(true);
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it("does not fabricate Hindi when an approved translation is missing", async () => {
    const { db, queries } = mockDb();
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(409);
    expect((await response?.json())?.code).toBe("TRANSLATION_NOT_READY");
    expect(queries.some((q) => q.method === "run")).toBe(false);
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects stale translations after the English source changes", async () => {
    const { db } = mockDb(false, { source_hash: "old-hash", content_json: reviewedTranslation().content_json });
    const response = await handleTranslationRoute(request(), env(db));
    expect(response?.status).toBe(409);
  });

  it("rejects incomplete prewritten translations", async () => {
    const incomplete = reviewedTranslation();
    incomplete.content_json = JSON.stringify({ overview: "हिंदी अवलोकन" });
    const { db } = mockDb(false, incomplete);
    expect((await handleTranslationRoute(request(), env(db)))?.status).toBe(409);
  });

  it("handles Hindi to English without changing originals or contacting a translation provider", async () => {
    const oldLanguage = book.language;
    book.language = "hi";
    try {
      const { db } = mockDb(false, reviewedTranslation(false, "hi"));
      const response = await handleTranslationRoute(request({ bookId, targetLanguage: "en" }), env(db));
      expect(response?.status).toBe(200);
      expect((await response?.json())?.targetLanguage).toBe("en");
      expect(authFetch).toHaveBeenCalledTimes(1);
    } finally { book.language = oldLanguage; }
  });
});
