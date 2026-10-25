// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { cachePublicApi } from "../worker/publicApiCache";
import { handleCatalogRoute } from "../worker/catalogRoutes";

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare public catalog quota protection", () => {
  it("caches only successful public GETs without using cookies in the cache key", async () => {
    const stored = new Map<string, Response>();
    const put = vi.fn(async (request: Request, response: Response) => { stored.set(request.url, response); });
    const match = vi.fn(async (request: Request) => stored.get(request.url)?.clone());
    vi.stubGlobal("caches", { default: { put, match } });

    const load = vi.fn(async () => Response.json({ data: [1] }, { headers: { "cache-control": "public, s-maxage=300" } }));
    const request = new Request("https://www.booknomics.com/api/catalog/books?limit=1", { headers: { cookie: "bn_session=private" } });
    expect((await (await cachePublicApi(request, load))?.json()).data).toEqual([1]);
    expect((await (await cachePublicApi(request, load))?.json()).data).toEqual([1]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0].headers.get("cookie")).toBeNull();
  });

  it("does not cache errors or private responses", async () => {
    const put = vi.fn();
    vi.stubGlobal("caches", { default: { put, match: async () => undefined } });
    const request = new Request("https://www.booknomics.com/api/catalog/books?limit=1");
    await cachePublicApi(request, async () => Response.json({ error: "exhausted" }, { status: 500 }));
    await cachePublicApi(request, async () => Response.json({ data: [] }, { headers: { "cache-control": "no-store" } }));
    expect(put).not.toHaveBeenCalled();
  });

  it("avoids a COUNT scan on every page of the SEO prerender catalog", async () => {
    const sql: string[] = [];
    const DB = {
      prepare(query: string) {
        sql.push(query);
        return {
          bind: () => ({ all: async () => ({ results: [{ id: "one", title: "Book" }] }), first: async () => ({ total: 1 }) }),
        };
      },
    };
    const request = new Request("https://www.booknomics.com/api/catalog/books?view=prerender&fields=id,title&status=published&sort=id&limit=1");
    const response = await handleCatalogRoute(request, { DB });
    expect(response?.status).toBe(200);
    expect((await response?.json()).count).toBeNull();
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain("SELECT id,title FROM books");
  });
});
