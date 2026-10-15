type D1 = any;
export type SitemapEnv = { DB?: D1 };

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      ...init.headers,
    },
  });

function parseOldSlugs(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function handleSitemapDataRoute(request: Request, env: SitemapEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/seo/sitemap-books" || request.method !== "GET") return null;
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503, headers: { "cache-control": "no-store" } });

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM books WHERE is_draft = 0 AND status = 'published'",
  ).first();
  const result = await env.DB.prepare(
    `SELECT id, slug, seo_slug, old_slugs, category, created_at, language, title, cover_url, status
     FROM books
     WHERE is_draft = 0 AND status = 'published'
     ORDER BY id ASC
     LIMIT ? OFFSET ?`,
  ).bind(limit, offset).all();

  const data = (result.results || []).map((row: any) => ({
    ...row,
    old_slugs: parseOldSlugs(row.old_slugs),
  }));
  return json({ data, count: Number(count?.total || 0), limit, offset });
}
