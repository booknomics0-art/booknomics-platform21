type D1 = any;
type R2 = any;

export type AdminEnv = {
  DB?: D1;
  BOOK_COVERS?: R2;
  BOOK_ASSETS?: R2;
};

type SafeUser = { id: string; email: string };

const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const BOOK_ID_RE = /^[0-9a-f-]{36}$/i;
const SAFE_OBJECT_KEY_RE = /^[A-Za-z0-9._/-]{1,300}$/;

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const cookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) result.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return result;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

async function currentUser(request: Request, db: D1): Promise<SafeUser | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id, COALESCE(u.supabase_email, u.email) AS email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`,
  ).bind(await sha256(token)).first();
  return row ? row as SafeUser : null;
}

async function requireAdmin(request: Request, env: AdminEnv) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const user = await currentUser(request, env.DB);
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  const role = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
  ).bind(user.id).first();
  if (!role) return { user: null, response: json({ error: "Admin access required" }, { status: 403 }) };
  return { user, response: null };
}

const asBool = (value: unknown) => value === true || value === 1 || value === "1";

const BOOK_MUTABLE_COLUMNS = [
  "slug", "title", "author", "category", "cover_color", "tagline", "overview", "key_ideas",
  "deep_analysis", "daily_application", "reading_time", "rating", "year", "cover_url", "language",
  "action_system", "practice_tracker", "reflection_questions", "real_life_example", "affiliate_link",
  "is_draft", "status", "meta_title", "meta_description", "og_image", "deep_summary", "seo_slug",
  "seo_keywords", "old_slugs", "alternate_book_id",
] as const;

type BookMutableColumn = typeof BOOK_MUTABLE_COLUMNS[number];
const BOOK_MUTABLE_SET = new Set<string>(BOOK_MUTABLE_COLUMNS);

function normalizeBookValue(column: BookMutableColumn, value: unknown) {
  if (column === "is_draft") return asBool(value) ? 1 : 0;
  if (column === "reading_time" || column === "year") {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (column === "rating") {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value == null ? null : String(value);
}

function publicBookRow(row: any) {
  if (!row) return row;
  return {
    ...row,
    is_draft: Boolean(row.is_draft),
    has_overview: row.has_overview == null ? undefined : Boolean(row.has_overview),
    has_key_ideas: row.has_key_ideas == null ? undefined : Boolean(row.has_key_ideas),
    has_deep_analysis: row.has_deep_analysis == null ? undefined : Boolean(row.has_deep_analysis),
    has_meta_title: row.has_meta_title == null ? undefined : Boolean(row.has_meta_title),
    has_meta_description: row.has_meta_description == null ? undefined : Boolean(row.has_meta_description),
    audio_ready: row.audio_ready == null ? undefined : Boolean(row.audio_ready),
  };
}

async function listAdminBooks(request: Request, env: AdminEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "full" ? "full" : "catalog";
  const id = url.searchParams.get("id") || "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const status = url.searchParams.get("status");
  const draft = url.searchParams.get("is_draft");

  const where: string[] = [];
  const binds: any[] = [];
  if (id) {
    if (!BOOK_ID_RE.test(id)) return json({ error: "Bad book id" }, { status: 400 });
    where.push("b.id = ?");
    binds.push(id);
  }
  if (status) {
    where.push("b.status = ?");
    binds.push(status);
  }
  if (draft === "true" || draft === "false") {
    where.push("b.is_draft = ?");
    binds.push(draft === "true" ? 1 : 0);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const fields = view === "full"
    ? `b.*,
       CASE WHEN ba.audio_url IS NOT NULL AND trim(ba.audio_url) <> '' THEN 1 ELSE 0 END AS audio_ready`
    : `b.id, b.title, b.author, b.category, b.language, b.is_draft, b.cover_url, b.status, b.slug,
       b.affiliate_link, b.meta_title, b.meta_description, b.seo_slug, b.created_at,
       CASE WHEN trim(COALESCE(b.overview, '')) <> '' THEN 1 ELSE 0 END AS has_overview,
       CASE WHEN trim(COALESCE(b.key_ideas, '')) <> '' THEN 1 ELSE 0 END AS has_key_ideas,
       CASE WHEN trim(COALESCE(b.deep_analysis, '')) <> '' THEN 1 ELSE 0 END AS has_deep_analysis,
       CASE WHEN trim(COALESCE(b.meta_title, '')) <> '' THEN 1 ELSE 0 END AS has_meta_title,
       CASE WHEN trim(COALESCE(b.meta_description, '')) <> '' THEN 1 ELSE 0 END AS has_meta_description,
       CASE WHEN ba.audio_url IS NOT NULL AND trim(ba.audio_url) <> '' THEN 1 ELSE 0 END AS audio_ready`;

  const result = await env.DB!.prepare(
    `SELECT ${fields}
     FROM books b LEFT JOIN book_assets ba ON ba.book_id = b.id
     ${whereSql}
     ORDER BY datetime(b.created_at) DESC
     LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all();

  return json({ data: (result.results || []).map(publicBookRow) });
}

async function createAdminBooks(request: Request, env: AdminEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as any;
  const rows = Array.isArray(body) ? body : body ? [body] : [];
  if (!rows.length || rows.length > 500) return json({ error: "Provide 1-500 books" }, { status: 400 });

  const now = new Date().toISOString();
  const inserted: any[] = [];
  const statements: any[] = [];
  for (const raw of rows) {
    const title = typeof raw?.title === "string" ? raw.title.trim() : "";
    const author = typeof raw?.author === "string" ? raw.author.trim() : "";
    const slug = typeof raw?.slug === "string" ? raw.slug.trim() : "";
    const category = typeof raw?.category === "string" ? raw.category.trim() : "";
    const language = typeof raw?.language === "string" ? raw.language.trim() : "";
    if (!title || !author || !slug || !category || !language) {
      return json({ error: "Each book requires title, author, slug, category, and language" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const values: Record<string, any> = {
      ...raw,
      slug,
      title,
      author,
      category,
      language,
      cover_color: raw.cover_color || "amber",
      is_draft: raw.is_draft == null ? 1 : (asBool(raw.is_draft) ? 1 : 0),
      status: raw.status || "draft",
    };
    const columns = BOOK_MUTABLE_COLUMNS.filter((column) => values[column] !== undefined);
    const sql = `INSERT INTO books (id, created_at, ${columns.join(", ")}) VALUES (?, ?, ${columns.map(() => "?").join(", ")})`;
    statements.push(env.DB!.prepare(sql).bind(
      id,
      now,
      ...columns.map((column) => normalizeBookValue(column, values[column])),
    ));
    inserted.push({ id, slug, title });
  }

  if (typeof env.DB!.batch === "function") await env.DB!.batch(statements);
  else for (const statement of statements) await statement.run();
  return json({ data: inserted }, { status: 201 });
}

async function updateAdminBook(request: Request, env: AdminEnv, bookId: string) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!BOOK_ID_RE.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body)) return json({ error: "Invalid update" }, { status: 400 });

  const entries = Object.entries(body).filter(([key, value]) => BOOK_MUTABLE_SET.has(key) && value !== undefined);
  if (!entries.length) return json({ error: "No mutable fields supplied" }, { status: 400 });
  const sql = `UPDATE books SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`;
  const result = await env.DB!.prepare(sql).bind(
    ...entries.map(([key, value]) => normalizeBookValue(key as BookMutableColumn, value)),
    bookId,
  ).run();
  if (!result?.meta?.changes) return json({ error: "Book not found" }, { status: 404 });
  const row = await env.DB!.prepare("SELECT * FROM books WHERE id = ? LIMIT 1").bind(bookId).first();
  return json({ data: publicBookRow(row) });
}

async function deleteAdminBook(request: Request, env: AdminEnv, bookId: string) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!BOOK_ID_RE.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const result = await env.DB!.prepare("DELETE FROM books WHERE id = ?").bind(bookId).run();
  if (!result?.meta?.changes) return json({ error: "Book not found" }, { status: 404 });
  return json({ ok: true });
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function publicAssetRow(row: any) {
  if (!row) return null;
  return {
    ...row,
    quiz_data: parseJsonArray(row.quiz_data),
    flashcard_data: parseJsonArray(row.flashcard_data),
    chapter_markers: parseJsonArray(row.chapter_markers),
  };
}

async function getBookAssets(request: Request, env: AdminEnv, bookId: string) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!BOOK_ID_RE.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const row = await env.DB!.prepare("SELECT * FROM book_assets WHERE book_id = ? LIMIT 1").bind(bookId).first();
  return json({ data: publicAssetRow(row) });
}

async function writeBookAssets(request: Request, env: AdminEnv, bookId: string, supplied?: any) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!BOOK_ID_RE.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const body = supplied ?? await request.json().catch(() => null) as any;
  if (!body || Array.isArray(body)) return json({ error: "Invalid asset payload" }, { status: 400 });
  const book = await env.DB!.prepare("SELECT 1 AS ok FROM books WHERE id = ? LIMIT 1").bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });

  const now = new Date().toISOString();
  const existing = await env.DB!.prepare("SELECT * FROM book_assets WHERE book_id = ? LIMIT 1").bind(bookId).first();
  const mindmapUrl = body.mindmap_url !== undefined ? body.mindmap_url : existing?.mindmap_url ?? null;
  const audioUrl = body.audio_url !== undefined ? body.audio_url : existing?.audio_url ?? null;
  const quizData = body.quiz_data !== undefined ? body.quiz_data : parseJsonArray(existing?.quiz_data);
  const flashcardData = body.flashcard_data !== undefined ? body.flashcard_data : parseJsonArray(existing?.flashcard_data);
  const chapterMarkers = body.chapter_markers !== undefined ? body.chapter_markers : parseJsonArray(existing?.chapter_markers);
  const status = typeof body.status === "string" ? body.status : String(existing?.status || "draft");

  await env.DB!.prepare(
    `INSERT INTO book_assets (book_id, mindmap_url, audio_url, quiz_data, flashcard_data, status, updated_at, chapter_markers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET
       mindmap_url = excluded.mindmap_url,
       audio_url = excluded.audio_url,
       quiz_data = excluded.quiz_data,
       flashcard_data = excluded.flashcard_data,
       status = excluded.status,
       updated_at = excluded.updated_at,
       chapter_markers = excluded.chapter_markers`,
  ).bind(
    bookId,
    mindmapUrl == null || mindmapUrl === "" ? null : String(mindmapUrl),
    audioUrl == null || audioUrl === "" ? null : String(audioUrl),
    JSON.stringify(Array.isArray(quizData) ? quizData : []),
    JSON.stringify(Array.isArray(flashcardData) ? flashcardData : []),
    status,
    now,
    JSON.stringify(Array.isArray(chapterMarkers) ? chapterMarkers : []),
  ).run();
  const row = await env.DB!.prepare("SELECT * FROM book_assets WHERE book_id = ? LIMIT 1").bind(bookId).first();
  return json({ data: publicAssetRow(row) });
}

async function writeBookAssetsBulk(request: Request, env: AdminEnv) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as any;
  const rows = Array.isArray(body) ? body : body ? [body] : [];
  if (!rows.length || rows.length > 500) return json({ error: "Provide 1-500 asset rows" }, { status: 400 });
  const results: any[] = [];
  for (const row of rows) {
    const bookId = typeof row?.book_id === "string" ? row.book_id : "";
    const response = await writeBookAssets(request, env, bookId, row);
    if (!response.ok) return response;
    const payload = await response.json() as any;
    results.push(payload.data);
  }
  return json({ data: results });
}

const mediaUrl = (request: Request, bucket: "covers" | "assets", key: string) =>
  `${new URL(request.url).origin}/media/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

async function uploadAdminObject(request: Request, env: AdminEnv, bucketName: "covers" | "assets") {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const bucket = bucketName === "covers" ? env.BOOK_COVERS : env.BOOK_ASSETS;
  if (!bucket) return json({ error: "R2 binding not configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "Invalid multipart body" }, { status: 400 });
  const pathValue = form.get("path");
  const fileValue = form.get("file");
  const key = typeof pathValue === "string" ? pathValue.trim() : "";
  if (!key || !SAFE_OBJECT_KEY_RE.test(key) || key.startsWith("/") || key.includes("..")) {
    return json({ error: "Invalid object path" }, { status: 400 });
  }
  const bookId = key.split("/")[0] || "";
  if (!BOOK_ID_RE.test(bookId)) return json({ error: "Object path must start with a book id" }, { status: 400 });
  const book = await env.DB!.prepare("SELECT 1 AS ok FROM books WHERE id = ? LIMIT 1").bind(bookId).first();
  if (!book) return json({ error: "Book not found" }, { status: 404 });
  if (!(fileValue instanceof File)) return json({ error: "File is required" }, { status: 400 });

  const contentType = fileValue.type || "application/octet-stream";
  if (bucketName === "covers") {
    if (!contentType.startsWith("image/")) return json({ error: "Cover must be an image" }, { status: 400 });
    if (fileValue.size > 8 * 1024 * 1024) return json({ error: "Cover must be under 8MB" }, { status: 413 });
  } else {
    const lower = fileValue.name.toLowerCase();
    const isAudio = key.includes("/audio-");
    const isMindmap = key.includes("/mindmap-");
    if (isAudio) {
      if (!(contentType === "audio/mpeg" || lower.endsWith(".mp3"))) return json({ error: "Audio must be MP3" }, { status: 400 });
      if (fileValue.size > 100 * 1024 * 1024) return json({ error: "MP3 must be under 100MB" }, { status: 413 });
    } else if (isMindmap) {
      if (!["image/png", "image/jpeg", "image/svg+xml"].includes(contentType)) return json({ error: "Mindmap must be PNG, JPG, JPEG, or SVG" }, { status: 400 });
      if (fileValue.size > 5 * 1024 * 1024) return json({ error: "Mindmap must be under 5MB" }, { status: 413 });
    } else {
      return json({ error: "Unsupported asset path" }, { status: 400 });
    }
  }

  await bucket.put(key, fileValue.stream(), {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return json({ data: { path: key, publicUrl: mediaUrl(request, bucketName, key) } }, { status: 201 });
}

async function logAdminAccess(request: Request, env: AdminEnv) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const user = await currentUser(request, env.DB);
  if (!user) return json({ ok: true });
  const role = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
  ).bind(user.id).first();
  const body = await request.json().catch(() => null) as any;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO admin_access_logs
      (id, attempted_email, user_id, ip_address, user_agent, outcome, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    user.email,
    user.id,
    request.headers.get("cf-connecting-ip"),
    (request.headers.get("user-agent") || body?.user_agent || "").slice(0, 500) || null,
    role ? "allowed" : "denied",
    role ? "admin_role" : "missing_admin_role",
    now,
  ).run();
  return json({ ok: true });
}

export async function handleAdminRoute(request: Request, env: AdminEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  try {
    if (pathname === "/api/admin/books" && request.method === "GET") return await listAdminBooks(request, env);
    if (pathname === "/api/admin/books" && request.method === "POST") return await createAdminBooks(request, env);

    const bookMatch = pathname.match(/^\/api\/admin\/books\/([^/]+)$/);
    if (bookMatch && request.method === "PATCH") return await updateAdminBook(request, env, decodeURIComponent(bookMatch[1]));
    if (bookMatch && request.method === "DELETE") return await deleteAdminBook(request, env, decodeURIComponent(bookMatch[1]));

    if (pathname === "/api/admin/book-assets" && request.method === "POST") return await writeBookAssetsBulk(request, env);
    const assetsMatch = pathname.match(/^\/api\/admin\/book-assets\/([^/]+)$/);
    if (assetsMatch && request.method === "GET") return await getBookAssets(request, env, decodeURIComponent(assetsMatch[1]));
    if (assetsMatch && request.method === "PUT") return await writeBookAssets(request, env, decodeURIComponent(assetsMatch[1]));

    if (pathname === "/api/admin/storage/covers" && request.method === "POST") return await uploadAdminObject(request, env, "covers");
    if (pathname === "/api/admin/storage/assets" && request.method === "POST") return await uploadAdminObject(request, env, "assets");
    if (pathname === "/api/admin/access-log" && request.method === "POST") return await logAdminAccess(request, env);
    return null;
  } catch (error) {
    console.error("admin route failed", error);
    const message = error instanceof Error ? error.message : "Admin request failed";
    if (/UNIQUE constraint failed|constraint failed/i.test(message)) return json({ error: "A record with the same unique value already exists" }, { status: 409 });
    return json({ error: "Admin request failed" }, { status: 500 });
  }
}
