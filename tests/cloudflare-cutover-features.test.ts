import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCatalogRoute } from "../worker/catalogRoutes";
import { handleSubjectiveMasteryRoute } from "../worker/subjectiveMasteryRoutes";

const endpoint = "https://www.booknomics.com/api/mastery/subjective";
const bookId = "da1c6e39-c41d-4aa2-8537-f6e84a125fb7";
const longQuestion = "Explain the central conflict in this book and consider a plausible opposing interpretation?";
const makeRequest = (body: unknown, extraHeaders: Record<string, string> = {}) => new Request(endpoint, {
  method: "POST", headers: { cookie: "bn_session=valid-session", "content-type": "application/json", ...extraHeaders },
  body: JSON.stringify(body),
});

function masteryDb({ authenticated = true, quota = true, hasBook = true, contentLength = 500 } = {}) {
  const queries: string[] = [];
  return {
    queries,
    prepare(sql: string) {
      queries.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (sql.includes("FROM sessions")) return authenticated ? { id: "user-1" } : null;
            if (sql.includes("FROM books")) return hasBook ? { title: "Example", author: "Writer", language: "en", overview: "A".repeat(contentLength) } : null;
            if (sql.includes("INSERT INTO subjective_assessment_limits")) return quota ? { attempts: 1 } : null;
            return null;
          },
        }),
      };
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("subjective mastery Cloudflare route", () => {
  it("rejects anonymous, cross-origin and invalid inputs before AI invocation", async () => {
    const db = masteryDb({ authenticated: false });
    expect((await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "questions" }), { DB: db }))?.status).toBe(401);
    expect((await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "questions" }, { origin: "https://elsewhere.example" }), { DB: db }))?.status).toBe(403);
    const authed = masteryDb();
    expect((await handleSubjectiveMasteryRoute(makeRequest({ bookId: "invalid", action: "questions" }), { DB: authed }))?.status).toBe(400);
    expect((await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "grade", answer: "short" }), { DB: authed }))?.status).toBe(400);
    expect(authed.queries.some(q => q.includes("subjective_assessment_limits"))).toBe(false);
  });

  it("checks publication and the content quality gate", async () => {
    expect((await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "questions" }), { DB: masteryDb({ hasBook: false }), LOVABLE_API_KEY: "dummy" }))?.status).toBe(404);
    expect((await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "questions" }), { DB: masteryDb({ contentLength: 20 }), LOVABLE_API_KEY: "dummy" }))?.status).toBe(422);
  });

  it("enforces persisted hourly quota before contacting provider", async () => {
    const provider = vi.fn(); vi.stubGlobal("fetch", provider);
    const response = await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "questions" }), { DB: masteryDb({ quota: false }), LOVABLE_API_KEY: "dummy" });
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("3600");
    expect(provider).not.toHaveBeenCalled();
  });

  it("returns two reviewed questions and never exposes answer key", async () => {
    const provider = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ questions: [longQuestion, `${longQuestion} Explain one further character's role.`] }) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", provider);
    const response = await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "questions" }), { DB: masteryDb(), LOVABLE_API_KEY: "dummy" });
    expect(response?.status).toBe(200);
    const payload = await response?.json();
    expect(payload.questions).toHaveLength(2);
    expect(payload.ideal_answer).toBeUndefined();
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("rejects fabricated/invalid AI grades", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ score: "not-a-score", ideal_answer: "A".repeat(120) }) } }] }))));
    const response = await handleSubjectiveMasteryRoute(makeRequest({ bookId, action: "grade", question: longQuestion, answer: "my analysis" }), { DB: masteryDb(), LOVABLE_API_KEY: "dummy" });
    expect(response?.status).toBe(502);
  });
});

describe("Cloudflare category directory", () => {
  it("resolves a category, and normalized curated titles, without cross-category blocking", async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) { calls.push(sql); return {
        bind: (..._args: unknown[]) => ({ all: async () => ({ results: [{ category: "Literature", published_count: 5 }] }) }),
        all: async () => ({ results: [
          { id: "1", title: "Godaan (Novel)", seo_slug: "godaan-summary", slug: "godaan" },
          { id: "2", title: "A Letter", seo_slug: "a-letter-summary", slug: "letter" },
        ] }),
      }; },
    };
    const path = "/api/catalog/category-directory?slug=literature&alias=Literature&pick_labels=" + encodeURIComponent(JSON.stringify(["Godaan", "A Letter"]));
    const response = await handleCatalogRoute(new Request("https://www.booknomics.com" + path), { DB: db });
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ categories: ["Literature"], category: "Literature", published_count: 5, picks: { Godaan: "godaan-summary", "A Letter": "a-letter-summary" } });
    expect(calls).toHaveLength(2);
  });
});
