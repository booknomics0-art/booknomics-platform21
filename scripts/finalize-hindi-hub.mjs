import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const HINDI_FILE = resolve("dist", "hindi", "index.html");
const PAGE_SIZE = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("finalize-hindi-hub: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
}

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

async function api(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`finalize-hindi-hub: Supabase ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function fetchPublishedHindi() {
  const rows = [];
  const select = "slug,seo_slug,title,author,category";
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await api(
      `books?select=${select}&language=eq.hi&is_draft=eq.false&status=eq.published&order=category.asc,title.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    if (!Array.isArray(page)) throw new Error("finalize-hindi-hub: expected an array response");
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.filter((book) => (book.seo_slug || book.slug) && book.title);
}

const books = await fetchPublishedHindi();
if (books.length < 20) {
  throw new Error(`finalize-hindi-hub: suspiciously small published Hindi catalog (${books.length})`);
}

const groups = new Map();
for (const book of books) {
  const category = String(book.category || "अन्य").trim() || "अन्य";
  if (!groups.has(category)) groups.set(category, []);
  groups.get(category).push(book);
}

const categorySections = [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b, "hi"))
  .map(([category, items]) => {
    const links = items.map((book) => {
      const slug = book.seo_slug || book.slug;
      const author = book.author ? ` — ${escapeHtml(book.author)}` : "";
      return `<li><a href="/books/${escapeHtml(encodeURI(slug))}"><strong>${escapeHtml(book.title)}</strong></a>${author}</li>`;
    }).join("\n");
    return `<section><h3>${escapeHtml(category)} (${items.length})</h3><ul>${links}</ul></section>`;
  })
  .join("\n");

const directory = `<section id="hindi-crawl-directory"><h2>सभी इंडेक्स योग्य हिंदी पुस्तक सारांश</h2><p>इस सूची में ${books.length} इंडेक्स योग्य हिंदी पुस्तक पृष्ठ हैं। अधूरे या कम-भरोसे वाले पृष्ठ indexing से बाहर रखे जाते हैं।</p>${categorySections}</section>`;

let html = readFileSync(HINDI_FILE, "utf8");
const target = /<section><h2>लोकप्रिय हिंदी पुस्तकें<\/h2><ul>[\s\S]*?<\/ul><\/section>/;
if (!target.test(html)) {
  throw new Error("finalize-hindi-hub: expected Hindi popular-books section was not found");
}
html = html.replace(target, directory);
writeFileSync(HINDI_FILE, html);

console.log(`[finalize-hindi-hub] exposed ${books.length} published Hindi books across ${groups.size} categories`);
