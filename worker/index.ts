type D1 = any;
type R2 = any;

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1;
  BOOK_COVERS?: R2;
  BOOK_ASSETS?: R2;
  BOOKNOMICS_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

type SafeUser = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

const SESSION_COOKIE = "bn_session";
const OAUTH_COOKIE = "bn_oauth_state";
const encoder = new TextEncoder();

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

const cookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) result.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return result;
};

const randomToken = (bytes = 32) => {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

const safeReturnTo = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value.slice(0, 500);
};

async function currentUser(request: Request, db: D1): Promise<SafeUser | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.avatar_url
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first();
  return row ? (row as SafeUser) : null;
}

function authCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function handleGoogleStart(request: Request, env: Env) {
  if (!env.DB || !env.GOOGLE_CLIENT_ID) return json({ error: "Google OAuth is not configured" }, { status: 503 });
  const url = new URL(request.url);
  const state = randomToken(32);
  const stateHash = await sha256(state);
  const returnTo = safeReturnTo(url.searchParams.get("return_to"));
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();
  await env.DB.prepare("DELETE FROM oauth_states WHERE datetime(expires_at) <= datetime('now')").run();
  await env.DB.prepare("INSERT INTO oauth_states (state_hash, return_to, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(stateHash, returnTo, expires, new Date().toISOString())
    .run();

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");

  const response = Response.redirect(google.toString(), 302);
  response.headers.append("set-cookie", `${OAUTH_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return response;
}

async function handleGoogleCallback(request: Request, env: Env) {
  if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "Google OAuth is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = cookies(request).get(OAUTH_COOKIE);
  if (!code || !state || !cookieState || state !== cookieState) return json({ error: "Invalid OAuth state" }, { status: 400 });

  const stateHash = await sha256(state);
  const stateRow = await env.DB.prepare(
    "SELECT return_to FROM oauth_states WHERE state_hash = ? AND datetime(expires_at) > datetime('now') LIMIT 1",
  )
    .bind(stateHash)
    .first();
  if (!stateRow) return json({ error: "OAuth state expired" }, { status: 400 });
  await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ?").bind(stateHash).run();

  const tokenBody = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${url.origin}/api/auth/google/callback`,
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenResponse.ok) return json({ error: "Google token exchange failed" }, { status: 502 });
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) return json({ error: "Google access token missing" }, { status: 502 });

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileResponse.ok) return json({ error: "Google profile request failed" }, { status: 502 });
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    return json({ error: "Verified Google email is required" }, { status: 403 });
  }

  const now = new Date().toISOString();
  let user = await env.DB.prepare("SELECT id, email, display_name, avatar_url FROM users WHERE google_sub = ? OR lower(email) = lower(?) LIMIT 1")
    .bind(profile.sub, profile.email)
    .first();

  if (user) {
    await env.DB.prepare(
      `UPDATE users SET google_sub = ?, display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url),
       email_verified = 1, provider = 'google', last_sign_in_at = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(profile.sub, profile.name || null, profile.picture || null, now, now, user.id)
      .run();
  } else {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_verified, provider, created_at, updated_at, google_sub, display_name, avatar_url, last_sign_in_at)
       VALUES (?, ?, 1, 'google', ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, profile.email, now, now, profile.sub, profile.name || null, profile.picture || null, now)
      .run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO profiles (id, display_name, avatar_url, created_at, streak_count, daily_goal_minutes)
       VALUES (?, ?, ?, ?, 0, 15)`,
    )
      .bind(id, profile.name || null, profile.picture || null, now)
      .run();
    user = { id, email: profile.email, display_name: profile.name || null, avatar_url: profile.picture || null };
  }

  const sessionToken = randomToken(48);
  const tokenHash = await sha256(sessionToken);
  const sessionId = crypto.randomUUID();
  const maxAge = 60 * 60 * 24 * 30;
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(sessionId, user.id, tokenHash, expiresAt, now)
    .run();

  const destination = new URL(safeReturnTo(String(stateRow.return_to || "/")), url.origin);
  const response = Response.redirect(destination.toString(), 302);
  response.headers.append("set-cookie", authCookie(sessionToken, maxAge));
  response.headers.append("set-cookie", `${OAUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return response;
}

async function serveR2(request: Request, bucket: R2, key: string) {
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
  if (object.httpEtag || object.etag) headers.set("etag", object.httpEtag || object.etag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("accept-ranges", "bytes");

  if (range && object.range) {
    const offset = object.range.offset ?? range.offset;
    const length = object.range.length ?? range.length ?? object.size;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
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
        googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      },
    });
  }

  if (url.pathname === "/api/auth/google/start" && request.method === "GET") return handleGoogleStart(request, env);
  if (url.pathname === "/api/auth/google/callback" && request.method === "GET") return handleGoogleCallback(request, env);

  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });

  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    return json({ user: await currentUser(request, env.DB) });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = cookies(request).get(SESSION_COOKIE);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json(
      { ok: true },
      { headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } },
    );
  }

  if (url.pathname === "/api/me/tier" && request.method === "GET") {
    const user = await currentUser(request, env.DB);
    if (!user) return json({ tier: "free" });
    const sub = await env.DB.prepare(
      `SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active'
       AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
       ORDER BY datetime(created_at) DESC LIMIT 1`,
    )
      .bind(user.id)
      .first();
    return json({ tier: sub?.plan || "free" });
  }

  if (url.pathname === "/api/me/admin" && request.method === "GET") {
    const user = await currentUser(request, env.DB);
    if (!user) return json({ isAdmin: false });
    const role = await env.DB.prepare("SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1")
      .bind(user.id)
      .first();
    return json({ isAdmin: Boolean(role) });
  }

  if (url.pathname === "/api/categories" && request.method === "GET") {
    const result = await env.DB.prepare(
      `SELECT DISTINCT category FROM books
       WHERE is_draft = 0 AND status IN ('published','published_noindex') AND category IS NOT NULL
       ORDER BY category ASC`,
    ).all();
    return json(
      { data: (result.results || []).map((row: any) => row.category).filter(Boolean) },
      { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } },
    );
  }

  if (url.pathname === "/api/books" && request.method === "GET") {
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 24), 1), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const language = url.searchParams.get("language")?.trim();
    const category = url.searchParams.get("category")?.trim();
    const query = url.searchParams.get("q")?.trim().slice(0, 80);
    const sort = url.searchParams.get("sort") || "az";

    let where = " WHERE is_draft = 0 AND status IN ('published','published_noindex')";
    const params: unknown[] = [];
    if (language && language !== "all") {
      where += " AND language = ?";
      params.push(language);
    }
    if (category && category !== "All") {
      where += " AND category = ?";
      params.push(category);
    }
    if (query) {
      where += " AND (title LIKE ? OR author LIKE ? OR category LIKE ? OR slug LIKE ? OR seo_slug LIKE ?)";
      const like = `%${query}%`;
      params.push(like, like, like, like, like);
    }

    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM books${where}`).bind(...params).first();
    const orderBy =
      sort === "latest"
        ? "created_at DESC"
        : sort === "za"
          ? "title DESC"
          : sort === "category"
            ? "category ASC, title ASC"
            : "title ASC";
    const result = await env.DB.prepare(
      `SELECT id, slug, seo_slug, title, author, category, cover_color, cover_url, tagline, rating, reading_time, language, created_at, year, meta_title, meta_description
       FROM books${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all();
    return json(
      { data: result.results || [], count: Number(count?.total || 0), limit, offset },
      { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
    );
  }

  if (url.pathname.startsWith("/api/books/") && request.method === "GET") {
    const slug = decodeURIComponent(url.pathname.slice("/api/books/".length));
    const book = await env.DB.prepare(
      `SELECT * FROM books WHERE (slug = ? OR seo_slug = ?) AND is_draft = 0
       AND status IN ('published','published_noindex') LIMIT 1`,
    )
      .bind(slug, slug)
      .first();
    if (!book) return json({ error: "Book not found" }, { status: 404 });
    return json({ data: book }, { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } });
  }

  if (url.pathname.startsWith("/api/book-assets/") && request.method === "GET") {
    const bookId = decodeURIComponent(url.pathname.slice("/api/book-assets/".length));
    if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
    const row = await env.DB.prepare(
      "SELECT mindmap_url, audio_url, quiz_data, flashcard_data, chapter_markers, status FROM book_assets WHERE book_id = ? LIMIT 1",
    )
      .bind(bookId)
      .first();
    if (!row) return json({ data: null });
    for (const field of ["quiz_data", "flashcard_data", "chapter_markers"]) {
      if (typeof row[field] === "string") {
        try {
          row[field] = JSON.parse(row[field]);
        } catch {
          row[field] = [];
        }
      }
    }
    return json({ data: row }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
  }

  if (url.pathname.startsWith("/api/covers/") && request.method === "GET") {
    const id = decodeURIComponent(url.pathname.slice("/api/covers/".length).replace(/\.svg$/, ""));
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad id", { status: 400 });
    const book = await env.DB.prepare(
      `SELECT id, title, author, category FROM books WHERE id = ? AND is_draft = 0
       AND status IN ('published','published_noindex') LIMIT 1`,
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
