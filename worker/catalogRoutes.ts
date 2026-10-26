type D1 = any;
export type CatalogEnv = { DB?: D1 };
type CatalogContext = { waitUntil(promise: Promise<unknown>): void };

// Unlike an origin fetch, a D1-generated response is not automatically stored
// by Cloudflare just because it has public Cache-Control headers. Cache only
// these two public endpoints; user/session/payment endpoints must stay uncached.
const CATALOG_CACHE_PARAMS: Record<string, Set<string>> = {
  "/api/catalog/books": new Set([
    "language", "category", "author", "status", "slugs", "limit", "offset",
    "sort", "view", "fields", "after_id",
  ]),
  "/api/catalog/category-directory": new Set([
    "language", "published_only", "slug", "alias", "pick_labels",
  ]),
};

type CatalogCache = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
};

function publicCacheKey(url: URL): Request {
  // Ignore tracking or unknown query parameters so they cannot force a fresh
  // D1 scan with a unique cache key on every request.
  const normalized = new URL(url.origin + url.pathname);
  const keys = CATALOG_CACHE_PARAMS[url.pathname];
  for (const [key, value] of [...url.searchParams].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv))) {
    if (keys.has(key)) normalized.searchParams.append(key, value);
  }
  return new Request(normalized.toString(), { method: "GET" });
}

async function fromPublicCache(cache: CatalogCache, key: Request): Promise<Response | undefined> {
  try {
    return await cache.match(key);
  } catch (error) {
    console.warn("catalog cache lookup failed", error);
    return undefined;
  }
}

async function savePublicCache(cache: CatalogCache, key: Request, response: Response, ctx?: CatalogContext) {
  if (!response.ok) return;
  const store = cache.put(key, response.clone()).catch(error => console.warn("catalog cache write failed", error));
  if (ctx) ctx.waitUntil(store);
  else await store;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      ...init.headers,
    },
  });

const PUBLIC_CARD_FIELDS = `
  id, slug, seo_slug, title, author, category, cover_color, cover_url, tagline,
  rating, reading_time, language, status, created_at, year, meta_title, meta_description,
  og_image, overview, seo_keywords, old_slugs
`;
const PUBLIC_META_FIELDS = "category, status, title, slug, seo_slug";
// Prerender-only public article fields: never expose premium modules or drafts.
const PRERENDER_COLUMNS = new Set([
  "id", "slug", "seo_slug", "title", "author", "category", "cover_url", "og_image", "tagline",
  "overview", "key_ideas", "deep_analysis", "daily_application", "meta_title", "meta_description",
  "reading_time", "rating", "year", "seo_keywords", "status", "language", "created_at",
]);

const safeList = (raw: string | null, max = 100) =>
  (raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, max);

const slugifyCategory = (value: string) => value.toLowerCase()
  .replace(/[\\/&]+/g, "-")
  .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

const normalizeTitle = (value: string) => value.toLowerCase()
  .replace(/[’']/g, "")
  .replace(/\([^)]*\)/g, " ")
  .replace(/[^a-z0-9\u0900-\u097F]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

async function categoryDirectory(url: URL, env: CatalogEnv): Promise<Response> {
  const language = url.searchParams.get("language")?.trim() || null;
  const publishedOnly = url.searchParams.get("published_only") === "true";
  const slug = url.searchParams.get("slug")?.trim().toLowerCase() || null;
  const alias = url.searchParams.get("alias")?.trim() || null;
  let labels: unknown;
  try { labels = JSON.parse(url.searchParams.get("pick_labels") || "[]"); }
  catch { return json({ error: "Invalid curated labels" }, { status: 400 }); }
  if (!Array.isArray(labels) || labels.length > 30 || labels.some((x) => typeof x !== "string" || x.length > 160)) {
    return json({ error: "Invalid curated labels" }, { status: 400 });
  }
  const where = ["is_draft = 0", publishedOnly ? "status = 'published'" : "status IN ('published','published_noindex')", "category IS NOT NULL", "category <> ''"];
  const binds: unknown[] = [];
  if (language) { where.push("language = ?"); binds.push(language); }
  const groups = await env.DB.prepare(
    `SELECT category, SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published_count
     FROM books WHERE ${where.join(" AND ")} GROUP BY category ORDER BY category ASC`,
  ).bind(...binds).all();
  const categories = (groups.results || []).map((r: any) => String(r.category));
  const matching = slug ? (groups.results || []).find((r: any) => r.category === alias)
    || (groups.results || []).find((r: any) => slugifyCategory(String(r.category)) === slug) : null;
  const picks: Record<string, string> = {};
  if (matching) {
    const result = (labels as string[]).length ? await env.DB.prepare(
      `SELECT title, seo_slug, slug FROM books WHERE is_draft=0 AND status='published'
       AND title IS NOT NULL AND COALESCE(seo_slug,slug) IS NOT NULL ORDER BY id ASC`,
    ).all() : { results: [] };
    const indexed = (result.results || []).map((r: any) => ({ ...r, normalized: normalizeTitle(String(r.title || "")) }));
    for (const label of labels as string[]) {
      const normalized = normalizeTitle(label);
      if (!normalized) continue;
      const matches = indexed.filter((r: any) => r.normalized === normalized || r.normalized.startsWith(`${normalized} `));
      matches.sort((a: any, b: any) => Number(a.normalized !== normalized) - Number(b.normalized !== normalized));
      const target = matches[0]?.seo_slug || matches[0]?.slug;
      if (target) picks[label] = String(target);
    }
  }
  return json({ categories, category: matching?.category || null, published_count: Number(matching?.published_count || 0), picks });
}

export async function handleCatalogRoute(request: Request, env: CatalogEnv, ctx?: CatalogContext): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/catalog/books" && url.pathname !== "/api/catalog/category-directory") return null;
  if (request.method !== "GET") return json({ error: "Method not allowed" }, { status: 405 });
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });

  const cache = (globalThis as typeof globalThis & { caches?: { default?: CatalogCache } }).caches?.default;
  const cacheKey = cache ? publicCacheKey(url) : undefined;
  if (cache && cacheKey) {
    const cached = await fromPublicCache(cache, cacheKey);
    if (cached) return cached;
  }

  try {
    if (url.pathname === "/api/catalog/category-directory") {
      const response = await categoryDirectory(url, env);
      if (cache && cacheKey) await savePublicCache(cache, cacheKey, response, ctx);
      return response;
    }
    const language = url.searchParams.get("language")?.trim();
    const category = url.searchParams.get("category")?.trim();
    const author = url.searchParams.get("author")?.trim().slice(0, 200);
    const status = url.searchParams.get("status")?.trim();
    const slugs = safeList(url.searchParams.get("slugs"), 100);
    const requestedLimit = Number(url.searchParams.get("limit") || 100);
    const requestedOffset = Number(url.searchParams.get("offset") || 0);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500) : 100;
    const offset = Number.isFinite(requestedOffset) ? Math.max(Math.floor(requestedOffset), 0) : 0;
    const sort = url.searchParams.get("sort") || "az";
    const view = url.searchParams.get("view");
    const requestedFields = safeList(url.searchParams.get("fields"), 30);
    if (view === "prerender" && (!requestedFields.length || requestedFields.some(field => !PRERENDER_COLUMNS.has(field)))) {
      return json({ error: "Invalid public prerender fields" }, { status: 400 });
    }
    const fields = view === "prerender" ? requestedFields.join(",") : view === "meta" ? PUBLIC_META_FIELDS : PUBLIC_CARD_FIELDS;

    const where = ["is_draft = 0"];
    const binds: unknown[] = [];

    if (status === "published" || status === "published_noindex") {
      where.push("status = ?");
      binds.push(status);
    } else {
      where.push("status IN ('published','published_noindex')");
    }

    if (language && language !== "all") {
      where.push("language = ?");
      binds.push(language);
    }
    if (category && category !== "All") {
      where.push("category = ?");
      binds.push(category);
    }
    if (author) {
      where.push("author = ?");
      binds.push(author);
    }
    const afterId = url.searchParams.get("after_id");
    if (afterId && sort === "id") {
      where.push("id > ?");
      binds.push(afterId);
    }
    if (slugs.length) {
      where.push(`slug IN (${slugs.map(() => "?").join(",")})`);
      binds.push(...slugs);
    }

    const orderBy = sort === "id" ? "id ASC" : sort === "latest"
      ? "datetime(created_at) DESC"
      : sort === "za"
        ? "title DESC"
        : sort === "category"
          ? "category ASC, title ASC"
          : "title ASC";
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM books ${whereSql}`).bind(...binds).first();
    const result = await env.DB.prepare(
      `SELECT ${fields} FROM books ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    ).bind(...binds, limit, offset).all();

    const response = json({
      data: result.results || [],
      count: Number(count?.total || 0),
      limit,
      offset,
    });
    if (cache && cacheKey) await savePublicCache(cache, cacheKey, response, ctx);
    return response;
  } catch (error) {
    console.error("catalog route failed", error);
    return json({ error: "Unable to load catalog" }, { status: 500 });
  }
}
