import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "https://www.booknomics.com";
const ORG_ID = `${BASE}/#organization`;
const ORG_LOGO = `${BASE}/og-default.svg`;
const BOOKS_DIR = resolve("dist", "books");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const PAGE_SIZE = 1000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("repair-book-structured-data: missing Supabase env");
}

async function api(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`repair-book-structured-data: Supabase ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const publicationBySlug = new Map();
for (let offset = 0; ; offset += PAGE_SIZE) {
  const page = await api(
    `books?select=slug,seo_slug,created_at&is_draft=eq.false&status=in.(published,published_noindex)&limit=${PAGE_SIZE}&offset=${offset}`,
  );
  for (const book of page) {
    if (!book.created_at) continue;
    if (book.slug) publicationBySlug.set(book.slug, book.created_at);
    if (book.seo_slug) publicationBySlug.set(book.seo_slug, book.created_at);
  }
  if (page.length < PAGE_SIZE) break;
}

function schemaTypes(node) {
  const value = node?.["@type"];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function repairNode(node, publishedAt, stats) {
  if (Array.isArray(node)) {
    node.forEach((item) => repairNode(item, publishedAt, stats));
    return;
  }
  if (!node || typeof node !== "object") return;

  const types = schemaTypes(node);
  const isBooknomicsOrg = types.includes("Organization") &&
    (node.name === "Booknomics" || node["@id"] === ORG_ID);
  if (isBooknomicsOrg && !node.logo) {
    node.logo = { "@type": "ImageObject", url: ORG_LOGO };
    stats.logosAdded += 1;
  }

  if (types.includes("Article") && !node.datePublished) {
    if (!publishedAt) stats.articlesWithoutSourceDate += 1;
    else {
      node.datePublished = new Date(publishedAt).toISOString();
      stats.articleDatesAdded += 1;
    }
  }

  for (const value of Object.values(node)) repairNode(value, publishedAt, stats);
}

function validateNode(node, stats) {
  if (Array.isArray(node)) {
    node.forEach((item) => validateNode(item, stats));
    return;
  }
  if (!node || typeof node !== "object") return;

  const types = schemaTypes(node);
  if (types.includes("Organization") &&
      (node.name === "Booknomics" || node["@id"] === ORG_ID) &&
      !node.logo) {
    stats.organizationsMissingLogo += 1;
  }
  if (types.includes("Article") && !node.datePublished) {
    stats.articlesMissingDate += 1;
  }
  for (const value of Object.values(node)) validateNode(value, stats);
}

const dirs = readdirSync(BOOKS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const stats = {
  pagesChecked: 0,
  schemasChecked: 0,
  logosAdded: 0,
  articleDatesAdded: 0,
  articlesWithoutSourceDate: 0,
  organizationsMissingLogo: 0,
  articlesMissingDate: 0,
};

const scriptRe = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;

for (const dir of dirs) {
  const file = resolve(BOOKS_DIR, dir.name, "index.html");
  let html;
  try {
    html = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const slug = decodeURIComponent(dir.name);
  const publishedAt = publicationBySlug.get(slug) || null;
  let changed = false;

  html = html.replace(scriptRe, (full, jsonText) => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return full;
    }

    stats.schemasChecked += 1;
    const before = JSON.stringify(parsed);
    repairNode(parsed, publishedAt, stats);
    validateNode(parsed, stats);
    const after = JSON.stringify(parsed).replace(/</g, "\\u003c");
    if (after !== before) changed = true;
    return `<script type="application/ld+json">${after}</script>`;
  });

  if (changed) writeFileSync(file, html);
  stats.pagesChecked += 1;
}

if (stats.articlesWithoutSourceDate || stats.organizationsMissingLogo || stats.articlesMissingDate) {
  throw new Error(
    `repair-book-structured-data: validation failed ${JSON.stringify(stats)}`,
  );
}

console.log(
  `[repair-book-structured-data] ✅ ${stats.pagesChecked} pages · ${stats.schemasChecked} JSON-LD blocks · ${stats.logosAdded} logos added · ${stats.articleDatesAdded} Article dates added`,
);
