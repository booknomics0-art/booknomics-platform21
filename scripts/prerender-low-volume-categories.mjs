import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cloudflarePrerender, fetchCloudflarePrerenderBooks } from "./lib/cloudflare-prerender-catalog.mjs";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const PAGE_SIZE = 250;

if (!cloudflarePrerender && (!SUPABASE_URL || !SUPABASE_KEY)) {
  throw new Error("prerender-low-volume-categories: missing Supabase public environment variables");
}

const template = readFileSync(INDEX, "utf8");

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const slugify = (value = "") => String(value)
  .toLowerCase()
  .replace(/[\/&]+/g, "-")
  .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

const isHindiLabel = (value = "") => /[\u0900-\u097F]/.test(String(value));

function replaceMeta(html, attr, key, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function prepareHead(html, { lang, title, description, canonical, jsonLd }) {
  let out = html.replace(/<html\s+lang=["'][^"']+["']>/i, `<html lang="${lang}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = replaceMeta(out, "name", "description", description);
  out = replaceMeta(out, "name", "robots", "noindex,follow");
  out = replaceMeta(out, "name", "googlebot", "noindex,follow");
  out = replaceMeta(out, "property", "og:title", title);
  out = replaceMeta(out, "property", "og:description", description);
  out = replaceMeta(out, "property", "og:url", canonical);
  out = replaceMeta(out, "name", "twitter:title", title);
  out = replaceMeta(out, "name", "twitter:description", description);
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  out = out.replace(
    "</head>",
    `  <link rel="canonical" href="${escapeHtml(canonical)}" />\n` +
    `  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`,
  );
  return out;
}

function writeRoute(pathname, html) {
  const clean = pathname.replace(/^\//, "");
  const file = resolve(DIST, clean, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

async function api(path) {
  if (cloudflarePrerender) return fetchCloudflarePrerenderBooks(path);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`prerender-low-volume-categories: Supabase ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function fetchPublishedBooks() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await api(
      `books?select=id,title,author,category,slug,seo_slug,language&is_draft=eq.false&status=eq.published&order=title.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    if (!Array.isArray(page)) throw new Error("prerender-low-volume-categories: catalog response is not an array");
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

const books = await fetchPublishedBooks();
const byCategory = new Map();
for (const book of books) {
  if (!book.category) continue;
  const category = String(book.category).trim();
  const slug = slugify(category);
  if (!slug) continue;
  if (!byCategory.has(slug)) byCategory.set(slug, { category, books: [] });
  byCategory.get(slug).books.push(book);
}

let written = 0;
for (const [slug, group] of byCategory) {
  // The main prerender creates indexable category hubs with >=3 published books.
  // Fill only the 1–2 book gap so every /browse category link resolves, while
  // keeping thin collections out of the sitemap and search index.
  if (group.books.length >= 3) continue;

  const category = group.category;
  const lang = isHindiLabel(category) ? "hi" : "en";
  const canonical = `${BASE}/category/${encodeURI(slug)}`;
  const title = `${category} Book Summaries | Booknomics`;
  const description = `Explore ${category} book summaries currently available on Booknomics. This small collection remains noindex until it has at least three published books.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category} book summaries`,
    url: canonical,
    description,
    inLanguage: lang,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: group.books.length,
      itemListElement: group.books.map((book, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: book.title,
        url: `${BASE}/books/${encodeURI(book.seo_slug || book.slug)}`,
      })),
    },
  };

  const items = group.books.map((book) => {
    const href = `/books/${encodeURI(book.seo_slug || book.slug)}`;
    return `<li><a href="${escapeHtml(href)}"><strong>${escapeHtml(book.title)}</strong></a>${book.author ? ` — ${escapeHtml(book.author)}` : ""}</li>`;
  }).join("\n");

  const root = `<main lang="${lang}" style="font-family:system-ui,-apple-system,sans-serif;max-width:960px;margin:0 auto;padding:32px 20px;line-height:1.6">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/browse">Browse</a> › ${escapeHtml(category)}</nav>
    <header><h1>${escapeHtml(category)} book summaries</h1><p>${escapeHtml(description)}</p></header>
    <section><h2>Available books</h2><ul>${items}</ul></section>
    <p><a href="/browse">Browse the full Booknomics library</a></p>
  </main>`;

  let html = prepareHead(template, { lang, title, description, canonical, jsonLd });
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  writeRoute(`/category/${slug}`, html);
  written++;
}

console.log(`[prerender-low-volume-categories] ✅ wrote ${written} noindex category pages`);
