/**
 * Cache only explicitly public GET APIs. Worker-generated JSON is not
 * automatically stored at the edge just because it has Cache-Control headers.
 * Cache API entries are per Cloudflare data center and expire according to
 * the response's existing s-maxage. Admin and authenticated APIs never call this.
 */
type PublicCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

function publicCache(): PublicCache | undefined {
  return (globalThis as unknown as { caches?: { default?: PublicCache } }).caches?.default;
}

export async function cachePublicApi(
  request: Request,
  getResponse: () => Promise<Response | null>,
): Promise<Response | null> {
  if (request.method !== "GET") return getResponse();

  // Never allow request cookies or authorization headers into the cache key.
  const key = new Request(request.url, { method: "GET" });
  const cache = publicCache();
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch (error) {
      console.warn("Public API cache lookup unavailable", error);
    }
  }

  const response = await getResponse();
  if (response?.ok && response.headers.get("cache-control")?.includes("public") && cache) {
    try {
      await cache.put(key, response.clone());
    } catch (error) {
      // A cache outage must not prevent live D1 content from being served.
      console.warn("Public API cache store unavailable", error);
    }
  }
  return response;
}
