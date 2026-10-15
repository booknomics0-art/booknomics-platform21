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

const safeList = (raw: string | null, max = 100) =>
  (raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, max);

export async function handleCatalogRoute(request: Request, env: CatalogEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/catalog/books" || request.method !== "GET") return null;
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });

  try {
    const language = url.searchParams.get("language")?.trim();
    const category = url.searchParams.get("category")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const slugs = safeList(url.searchParams.get("slugs"), 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const sort = url.searchParams.get("sort") || "az";
    const fields = url.searchParams.get("view") === "meta" ? PUBLIC_META_FIELDS : PUBLIC_CARD_FIELDS;

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
    if (slugs.length) {
      where.push(`slug IN (${slugs.map(() => "?").join(",")})`);
      binds.push(...slugs);
    }

    const orderBy = sort === "latest"
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

    return json({
      data: result.results || [],
      count: Number(count?.total || 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error("catalog route failed", error);
    return json({ error: "Unable to load catalog" }, { status: 500 });
  }
}
