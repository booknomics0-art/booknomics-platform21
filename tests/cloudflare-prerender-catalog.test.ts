import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare SEO prerender catalog bridge", () => {
  it("rejects a missing configured Worker origin instead of using stale Supabase data", async () => {
    vi.stubEnv("PRERENDER_CATALOG_API", "");
    vi.stubEnv("VITE_API_BASE", "");
    vi.resetModules();
    const { fetchCloudflarePrerenderBooks } = await import("../scripts/lib/cloudflare-prerender-catalog.mjs");
    await expect(fetchCloudflarePrerenderBooks("books?select=id&is_draft=eq.false&status=eq.published")).rejects.toThrow("PRERENDER_CATALOG_API");
  });

  it("maps safe Supabase-style catalog filters to the Cloudflare D1 endpoint", async () => {
    vi.stubEnv("PRERENDER_CATALOG_API", "https://worker.example");
    vi.stubEnv("VITE_DATA_BACKEND", "cloudflare");
    vi.resetModules();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "a" }] })));
    vi.stubGlobal("fetch", fetcher);
    const { fetchCloudflarePrerenderBooks } = await import("../scripts/lib/cloudflare-prerender-catalog.mjs");
    const rows = await fetchCloudflarePrerenderBooks("books?select=id,title&is_draft=eq.false&status=in.(published,published_noindex)&language=eq.en&order=id.asc&limit=100&id=gt.da1c6e39-c41d-4aa2-8537-f6e84a125fb7");
    expect(rows).toHaveLength(1);
    const calledUrl = new URL(fetcher.mock.calls[0][0] as string);
    expect(calledUrl.hostname).toBe("worker.example");
    expect(calledUrl.pathname).toBe("/api/catalog/books");
    expect(calledUrl.searchParams.get("status")).toBe("all");
    expect(calledUrl.searchParams.get("after_id")).toBe("da1c6e39-c41d-4aa2-8537-f6e84a125fb7");
    expect(calledUrl.searchParams.get("fields")).toBe("id,title");
  });

  it("never accepts draft-inclusive or unsupported catalog queries", async () => {
    vi.stubEnv("PRERENDER_CATALOG_API", "https://worker.example");
    vi.resetModules();
    const { fetchCloudflarePrerenderBooks } = await import("../scripts/lib/cloudflare-prerender-catalog.mjs");
    await expect(fetchCloudflarePrerenderBooks("books?select=id&status=eq.published")).rejects.toThrow("exclude drafts");
    await expect(fetchCloudflarePrerenderBooks("books?select=id&is_draft=eq.false&status=eq.draft")).rejects.toThrow("Unsupported prerender statuses");
  });
});
