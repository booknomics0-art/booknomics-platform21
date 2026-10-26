import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCatalogRoute } from "../worker/catalogRoutes";

afterEach(() => vi.unstubAllGlobals());

function fakeDatabase() {
  const first = vi.fn(async () => ({ total: 1 }));
  const all = vi.fn(async () => ({ results: [{ id: "public-book", title: "Godan" }] }));
  const prepare = vi.fn(() => ({ bind: () => ({ first, all }) }));
  return { prepare, first, all };
}

function fakeCache() {
  const stored = new Map<string, Response>();
  const match = vi.fn(async (key: Request) => stored.get(key.url)?.clone());
  const put = vi.fn(async (key: Request, response: Response) => { stored.set(key.url, response.clone()); });
  vi.stubGlobal("caches", { default: { match, put } });
  return { match, put };
}

describe("Cloudflare public catalog D1 cache", () => {
  it("reuses the same successful response despite reordered or tracking query parameters", async () => {
    const db = fakeDatabase();
    const cache = fakeCache();
    const first = await handleCatalogRoute(new Request("https://www.booknomics.com/api/catalog/books?limit=1&language=hi&utm_source=a"), { DB: db });
    const second = await handleCatalogRoute(new Request("https://www.booknomics.com/api/catalog/books?utm_source=b&language=hi&limit=1"), { DB: db });
    expect(first?.status).toBe(200);
    expect(await second?.json()).toMatchObject({ count: 1, data: [{ id: "public-book" }] });
    expect(db.prepare).toHaveBeenCalledTimes(2); // one COUNT and one SELECT, not four
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(cache.match).toHaveBeenCalledTimes(2);
  });

  it("keeps different public catalog filters isolated", async () => {
    const db = fakeDatabase();
    fakeCache();
    await handleCatalogRoute(new Request("https://www.booknomics.com/api/catalog/books?language=hi"), { DB: db });
    await handleCatalogRoute(new Request("https://www.booknomics.com/api/catalog/books?language=en"), { DB: db });
    expect(db.prepare).toHaveBeenCalledTimes(4);
  });

  it("does not store invalid responses or errors", async () => {
    const db = fakeDatabase();
    const cache = fakeCache();
    const invalid = await handleCatalogRoute(new Request("https://www.booknomics.com/api/catalog/books?view=prerender&fields=action_system"), { DB: db });
    expect(invalid?.status).toBe(400);
    const broken = { prepare: vi.fn(() => { throw new Error("D1 limit exceeded"); }) };
    const errored = await handleCatalogRoute(new Request("https://www.booknomics.com/api/catalog/books?limit=10"), { DB: broken });
    expect(errored?.status).toBe(500);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("never intercepts authenticated or payment endpoint paths", async () => {
    const db = fakeDatabase();
    const cache = fakeCache();
    expect(await handleCatalogRoute(new Request("https://www.booknomics.com/api/auth/google/start"), { DB: db })).toBeNull();
    expect(await handleCatalogRoute(new Request("https://www.booknomics.com/api/payments/razorpay/subscription"), { DB: db })).toBeNull();
    expect(cache.match).not.toHaveBeenCalled();
    expect(db.prepare).not.toHaveBeenCalled();
  });
});
