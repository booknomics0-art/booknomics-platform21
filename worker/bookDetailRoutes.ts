type D1 = any;
type Env = { DB?: D1 };

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Editorial updates from the admin portal must be visible on the next load.
      // Catalog and static assets can still use their separate caching policies.
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const PUBLIC_BOOK_FIELDS = `
  id,slug,seo_slug,title,author,category,cover_color,tagline,overview,deep_summary,key_ideas,
  deep_analysis,daily_application,reading_time,rating,year,created_at,cover_url,language,
  affiliate_link,is_draft,status,meta_title,meta_description,og_image,seo_keywords,old_slugs,alternate_book_id
`;

async function findBook(db: D1, slug: string) {
  let row = await db.prepare(
    `SELECT ${PUBLIC_BOOK_FIELDS} FROM books
     WHERE slug = ? AND is_draft = 0 AND status IN ('published','published_noindex') LIMIT 1`,
  ).bind(slug).first();
  if (row) return { row, match: "slug" as const };

  row = await db.prepare(
    `SELECT ${PUBLIC_BOOK_FIELDS} FROM books
     WHERE seo_slug = ? AND is_draft = 0 AND status IN ('published','published_noindex') LIMIT 1`,
  ).bind(slug).first();
  if (row) return { row, match: "seo_slug" as const };

  row = await db.prepare(
    `SELECT ${PUBLIC_BOOK_FIELDS} FROM books b
     WHERE b.is_draft = 0 AND b.status IN ('published','published_noindex')
       AND EXISTS (
         SELECT 1 FROM json_each(CASE WHEN json_valid(b.old_slugs) THEN b.old_slugs ELSE '[]' END)
         WHERE value = ?
       )
     LIMIT 1`,
  ).bind(slug).first();
  return row ? { row, match: "old_slugs" as const } : null;
}

export async function handleBookDetailRoute(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const prefix = "/api/book-detail-data/";
  if (!url.pathname.startsWith(prefix) || request.method !== "GET") return null;
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });

  try {
    const slug = decodeURIComponent(url.pathname.slice(prefix.length)).trim();
    if (!slug || slug.length > 240) return json({ error: "Bad book slug" }, { status: 400 });
    const found = await findBook(env.DB, slug);
    if (!found) return json({ error: "Book not found" }, { status: 404 });
    const book = found.row as any;
    const bookId = String(book.id);
    const category = String(book.category || "");
    const language = String(book.language || "");

    const [related, sameLang, reviews, linkTargets] = await Promise.all([
      category
        ? env.DB.prepare(
            `SELECT id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time
             FROM books WHERE is_draft = 0 AND status IN ('published','published_noindex')
               AND category = ? AND id <> ? LIMIT 6`,
          ).bind(category, bookId).all()
        : Promise.resolve({ results: [] }),
      language
        ? env.DB.prepare(
            `SELECT id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time
             FROM books WHERE is_draft = 0 AND status IN ('published','published_noindex')
               AND language = ? AND id <> ? AND (? = '' OR category <> ?) LIMIT 4`,
          ).bind(language, bookId, category, category).all()
        : Promise.resolve({ results: [] }),
      env.DB.prepare(
        `SELECT rating,content,created_at FROM book_reviews
         WHERE book_id = ? ORDER BY upvote_count DESC, datetime(created_at) DESC LIMIT 50`,
      ).bind(bookId).all(),
      language
        ? env.DB.prepare(
            `SELECT title,slug,seo_slug FROM books
             WHERE is_draft = 0 AND status IN ('published','published_noindex')
               AND language = ? AND id <> ? LIMIT 120`,
          ).bind(language, bookId).all()
        : Promise.resolve({ results: [] }),
    ]);

    let counterpart: any = null;
    if (book.alternate_book_id && /^[0-9a-f-]{36}$/i.test(String(book.alternate_book_id))) {
      counterpart = await env.DB.prepare(
        `SELECT id,slug,seo_slug,language FROM books
         WHERE id = ? AND is_draft = 0 AND status IN ('published','published_noindex') LIMIT 1`,
      ).bind(String(book.alternate_book_id)).first();
    }

    return json({
      book,
      match: found.match,
      canonical_slug: book.seo_slug || book.slug,
      related: related.results || [],
      sameLang: sameLang.results || [],
      reviews: reviews.results || [],
      linkTargets: linkTargets.results || [],
      counterpart,
    });
  } catch (error) {
    console.error("book detail route failed", error);
    return json({ error: "Unable to load book" }, { status: 500 });
  }
}
