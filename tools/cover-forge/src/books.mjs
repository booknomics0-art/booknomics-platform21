// Book list loaders: content-drafts/*.txt, JSON, CSV, or the live Supabase table.

import fs from "node:fs";
import path from "node:path";

const VALUE = (content, key) => (content.match(new RegExp(`^${key}:\\s*(.+)$`, "m")) || [])[1]?.trim();
const FIELD = (content, key) => (content.match(new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)$`, "m")) || [])[1]?.trim();

/**
 * Theme signals we can read straight out of a draft. The markdown drafts carry
 * them in METADATA (`**प्रमुख विषय**: जीवन, मृत्यु, …`) or as the bolded bullets
 * under `### प्रमुख विषय`; the older #BOOK_START drafts only describe them in
 * prose, so the body is kept as a weaker signal for those.
 */
function draftThemes(content) {
  const line = FIELD(content, "प्रमुख विषय");
  if (line) return line.split(/[,;।]/).map((s) => s.trim()).filter(Boolean);
  const section = content.split(/^###\s+प्रमुख विषय.*$/m)[1];
  if (!section) return [];
  const body = section.split(/^###/m)[0];
  return [...body.matchAll(/^-\s*\*\*(.+?)\*\*/gm)].map((m) => m[1].trim()).filter(Boolean);
}

function draftBody(content) {
  const start = content.indexOf("#SUMMARY");
  const slice = (start >= 0 ? content.slice(start) : content).replace(/[#*`>|-]/g, " ").replace(/\s+/g, " ");
  return slice.slice(0, 6000);
}

/** Parse one content-drafts file (both the old #BOOK_START format and the newer markdown format). */
export function parseDraft(file, content) {
  const slug = path.basename(file, ".txt");
  if (content.includes("#BOOK_START")) {
    return {
      slug: VALUE(content, "Slug") || slug,
      title: VALUE(content, "Title") || slug,
      author: VALUE(content, "Author") || "",
      language: VALUE(content, "Language") || "Hindi",
      category: VALUE(content, "Category") || "",
      themes: draftThemes(content),
      style: "",
      tone: "",
      body: draftBody(content),
      source: "draft",
    };
  }
  const title = (content.match(/^#\s+(.+)$/m) || [])[1]?.trim() || slug;
  const authorLine = (content.match(/^##\s+(.+)$/m) || [])[1]?.trim() || "";
  const author = authorLine.replace(/\s*\((\d{3,4})\)\s*$/, "").trim();
  const year = (authorLine.match(/\((\d{3,4})\)\s*$/) || [])[1] || FIELD(content, "प्रकाशन वर्ष") || "";
  return {
    slug,
    title,
    author,
    language: "Hindi",
    category: FIELD(content, "श्रेणी") || "",
    themes: draftThemes(content),
    style: FIELD(content, "शैली") || "",
    tone: FIELD(content, "टोन") || "",
    year,
    body: draftBody(content),
    source: "draft",
  };
}

export function loadDrafts(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt"));
  return files
    .map((f) => parseDraft(f, fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((b) => b.title && b.title !== b.slug)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function loadJson(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = Array.isArray(data) ? data : data.books;
  if (!Array.isArray(rows)) throw new Error(`${file} must contain an array of books`);
  return rows.map((b) => ({
    id: b.id ?? null,
    slug: b.slug || slugify(b.title),
    title: b.title,
    author: b.author || "",
    language: b.language || "Hindi",
    category: b.category || "",
    themes: b.themes || b.keywords || "",
    body: b.description || "",
    cover_url: b.cover_url ?? null,
    source: "json",
  }));
}

export function loadCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = head.split(",").map((c) => c.trim());
  return lines.map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
    return {
      id: row.id || null,
      slug: row.slug || slugify(row.title),
      title: row.title,
      author: row.author || "",
      language: row.language || "Hindi",
      category: row.category || "",
      themes: row.themes || row.keywords || "",
      body: row.description || "",
      cover_url: row.cover_url || null,
      source: "csv",
    };
  });
}

/** Read the books table through the Supabase REST API (no extra dependency). */
export async function loadFromSupabase({ url, key, pageSize = 1000, onlyMissingCovers = false, includeDrafts = false, limit = 0 }) {
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required for --from-db");
  const select = "id,slug,title,author,category,language,is_draft,cover_url,meta_description";
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({ select, order: "id", limit: String(pageSize), offset: String(offset) });
    if (!includeDrafts) params.set("is_draft", "eq.false");
    if (onlyMissingCovers) params.set("cover_url", "is.null");
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/books?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", Prefer: "count=exact" },
    });
    if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    out.push(...rows.map((b) => ({ ...b, body: b.meta_description || "", source: "db" })));
    if (rows.length < pageSize) break;
    if (limit && out.length >= limit) break;
  }
  return limit ? out.slice(0, limit) : out;
}

export function slugify(text) {
  const base = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-saransh` : `book-${Date.now()}`;
}

export async function loadBooks(opts) {
  if (opts.fromDb) {
    return loadFromSupabase({
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      onlyMissingCovers: true,
      limit: opts.limit && !opts.all ? opts.limit : 0,
    });
  }
  if (opts.books) {
    return opts.books.endsWith(".csv") ? loadCsv(opts.books) : loadJson(opts.books);
  }
  if (opts.drafts) return loadDrafts(opts.drafts);
  throw new Error("Provide --drafts <dir>, --books <file.json|csv> or --from-db");
}
