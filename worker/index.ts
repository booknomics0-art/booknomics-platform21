type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: any;
  BOOK_COVERS?: any;
  BOOK_ASSETS?: any;
  BOOKNOMICS_ENV?: string;
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const wrap = (text: string, max = 24) => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = `${line ? `${line} ` : ""}${word}`;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
};

const hashHue = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % 360;
};

function fallbackCover(book: { id: string; title: string; author?: string; category?: string }) {
  const hue = hashHue(book.id);
  const hue2 = (hue + 42) % 360;
  const lines = wrap(book.title, 26);
  const titleY = 300 - (lines.length - 1) * 30;
  const title = lines
    .map(
      (line, index) =>
        `<text x="300" y="${titleY + index * 60}" text-anchor="middle" font-family="Georgia,serif" font-size="42" font-weight="700" fill="#fff">${esc(line)}</text>`,
    )
    .join("");
  const author = esc(book.author || "Booknomics");
  const category = esc(book.category || "Book Summary");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900" role="img" aria-label="${esc(book.title)} by ${author}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 54% 26%)"/><stop offset="1" stop-color="hsl(${hue2} 62% 14%)"/></linearGradient><radialGradient id="r"><stop offset="0" stop-color="rgba(255,255,255,.18)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><rect width="600" height="900" rx="8" fill="url(#g)"/><circle cx="460" cy="160" r="220" fill="url(#r)"/><circle cx="120" cy="740" r="260" fill="url(#r)"/><path d="M90 180h420M90 720h420" stroke="rgba(255,255,255,.28)" stroke-width="2"/><text x="300" y="125" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" letter-spacing="4" fill="rgba(255,255,255,.78)">${category.toUpperCase()}</text>${title}<text x="300" y="640" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="rgba(255,255,255,.88)">${author}</text><text x="300" y="820" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="5" fill="rgba(255,255,255,.72)">BOOKNOMICS</text></svg>`;
}

async function serveR2(request: Request, bucket: any, key: string) {
  if (!bucket) return json({ error: "R2 binding not configured" }, { status: 503 });

  const rangeHeader = request.headers.get("range");
  let range: { offset: number; length?: number } | undefined;
  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (match) {
      const offset = Number(match[1]);
      const end = match[2] ? Number(match[2]) : undefined;
      range = { offset, ...(end !== undefined ? { length: end - offset + 1 } : {}) };
    }
  }

  const object = await bucket.get(key, range ? { range } : undefined);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  headers.set("etag", object.httpEtag || object.etag || "");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("accept-ranges", "bytes");

  if (range && object.range) {
    const offset = object.range.offset ?? 0;
    const length = object.range.length ?? object.size;
    const total = object.size ?? offset + length;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${total}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  return new Response(object.body, { headers });
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    return json({
      ok: true,
      platform: "cloudflare",
      environment: env.BOOKNOMICS_ENV || "unknown",
      bindings: {
        d1: Boolean(env.DB),
        coversR2: Boolean(env.BOOK_COVERS),
        assetsR2: Boolean(env.BOOK_ASSETS),
      },
    });
  }

  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });

  if (url.pathname === "/api/books" && request.method === "GET") {
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 24), 1), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const language = url.searchParams.get("language")?.trim();
    const query = url.searchParams.get("q")?.trim();

    let sql = `SELECT id, slug, title, author, category, cover_color, cover_url, tagline, rating, reading_time, language, year, meta_title, meta_description
      FROM books WHERE is_draft = 0 AND status = 'published'`;
    const params: unknown[] = [];
    if (language) {
      sql += " AND language = ?";
      params.push(language);
    }
    if (query) {
      sql += " AND (title LIKE ? OR author LIKE ? OR slug LIKE ?)";
      const like = `%${query}%`;
      params.push(like, like, like);
    }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const result = await env.DB.prepare(sql).bind(...params).all();
    return json({ data: result.results || [], limit, offset }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
  }

  if (url.pathname.startsWith("/api/books/") && request.method === "GET") {
    const slug = decodeURIComponent(url.pathname.slice("/api/books/".length));
    const book = await env.DB.prepare(
      `SELECT * FROM books WHERE (slug = ? OR seo_slug = ?) AND is_draft = 0 AND status = 'published' LIMIT 1`,
    )
      .bind(slug, slug)
      .first();
    if (!book) return json({ error: "Book not found" }, { status: 404 });
    return json({ data: book }, { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } });
  }

  if (url.pathname.startsWith("/api/covers/") && request.method === "GET") {
    const id = decodeURIComponent(url.pathname.slice("/api/covers/".length).replace(/\.svg$/, ""));
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad id", { status: 400 });
    const book = await env.DB.prepare(
      `SELECT id, title, author, category FROM books WHERE id = ? AND is_draft = 0 AND status = 'published' LIMIT 1`,
    )
      .bind(id)
      .first();
    if (!book) return new Response("Not found", { status: 404 });
    return new Response(fallbackCover(book as any), {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) return handleApi(request, env);

    if (url.pathname.startsWith("/media/covers/")) {
      return serveR2(request, env.BOOK_COVERS, decodeURIComponent(url.pathname.slice("/media/covers/".length)));
    }

    if (url.pathname.startsWith("/media/assets/")) {
      return serveR2(request, env.BOOK_ASSETS, decodeURIComponent(url.pathname.slice("/media/assets/".length)));
    }

    return env.ASSETS.fetch(request);
  },
};
