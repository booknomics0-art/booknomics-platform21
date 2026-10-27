type D1 = any;
export type CatalogEnv = { DB?: D1 };

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

export async function handleCatalogRoute(request: Request, env: CatalogEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/catalog/books" && url.pathname !== "/api/catalog/category-directory") return null;
  if (request.method !== "GET") return json({ error: "Method not allowed" }, { status: 405 });
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });

  try {
    // Only public catalog data is cached. Build a URL-only key so that the
    // frontend's Supabase bearer header never creates a user-specific variant.
    const workerCache: Cache | undefined = (globalThis as any).caches?.default;
    const cacheKey = new Request(url.toString());
    if (workerCache) {
      const cached = await workerCache.match(cacheKey).catch(() => undefined);
      if (cached) return cached;
    }
    if (url.pathname === "/api/catalog/category-directory") {
      const response = await categoryDirectory(url, env);
      if (response.ok && workerCache) await workerCache.put(cacheKey, response.clone()).catch(() => {});
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
    // SEO prerender's keyset client consumes only the data array, never count.
    // Scanning thousands of rows for COUNT once per 100-row page consumed a
    // large portion of D1's free-tier daily row-read quota during builds.
    const count = view === "prerender" ? null
      : await env.DB.prepare(`SELECT COUNT(*) AS total FROM books ${whereSql}`).bind(...binds).first();
    const result = await env.DB.prepare(
      `SELECT ${fields} FROM books ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    ).bind(...binds, limit, offset).all();

    const response = json({
      data: result.results || [],
      count: view === "prerender" ? null : Number(count?.total || 0),
      limit,
      offset,
    });
    if (workerCache) await workerCache.put(cacheKey, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    console.error("catalog route failed", error);
    return json({ error: "Unable to load catalog" }, { status: 500 });
  }
}
