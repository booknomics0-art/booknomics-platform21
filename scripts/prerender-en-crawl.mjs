import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const PAGE_SIZE = 250;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("prerender-en-crawl: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
}

const template = readFileSync(INDEX, "utf8");

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const stripMarkdown = (value = "") => String(value)
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^[-*•]+\s+/gm, "")
  .replace(/\*\*|__|\*|_/g, "")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

const clamp = (value, max) => {
  const text = stripMarkdown(value);
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};

const slugify = (value = "") => String(value)
  .toLowerCase()
  .replace(/[\/&]+/g, "-")
  .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

function replaceMeta(html, attr, key, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function prepareHead(html, { lang = "en", title, description, canonical, image, jsonLd, noindex = false }) {
  let out = html.replace(/<html\s+lang=["'][^"']+["']>/i, `<html lang="${lang}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = replaceMeta(out, "name", "description", description);
  out = replaceMeta(out, "name", "author", "Booknomics Editorial");
  const robots = noindex
    ? "noindex,follow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  out = replaceMeta(out, "name", "robots", robots);
  out = replaceMeta(out, "name", "googlebot", robots);
  out = replaceMeta(out, "property", "og:title", title);
  out = replaceMeta(out, "property", "og:description", description);
  out = replaceMeta(out, "property", "og:url", canonical);
  out = replaceMeta(out, "name", "twitter:title", title);
  out = replaceMeta(out, "name", "twitter:description", description);
  if (image) {
    out = replaceMeta(out, "property", "og:image", image);
    out = replaceMeta(out, "name", "twitter:image", image);
  }
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  out = out.replace(/<link\s+rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>/gi, "");
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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`prerender-en-crawl: Supabase ${response.status} ${await response.text()}`);
  return response.json();
}

async function fetchPaged({ language, statuses }) {
  const rows = [];
  const select = "id,slug,seo_slug,title,author,category,cover_url,og_image,tagline,overview,key_ideas,deep_analysis,daily_application,meta_title,meta_description,reading_time,rating,year,status,language";
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const filters = [
      `select=${select}`,
      "is_draft=eq.false",
      `status=in.(${statuses.join(",")})`,
      language ? `language=eq.${language}` : "",
      "order=title.asc",
      `limit=${PAGE_SIZE}`,
      `offset=${offset}`,
    ].filter(Boolean).join("&");
    const page = await api(`books?${filters}`);
    if (!Array.isArray(page)) throw new Error("prerender-en-crawl: catalog response is not an array");
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

const [englishPublic, publishedAll] = await Promise.all([
  fetchPaged({ language: "en", statuses: ["published", "published_noindex"] }),
  fetchPaged({ language: null, statuses: ["published"] }),
]);

const publishedEnglish = englishPublic.filter((book) => book.status === "published");
if (publishedEnglish.length < 100) {
  throw new Error(`prerender-en-crawl: expected a substantial English catalog, got ${publishedEnglish.length}`);
}
if (publishedAll.length < 100) {
  throw new Error(`prerender-en-crawl: expected a substantial published catalog, got ${publishedAll.length}`);
}

const preferredSlug = (book) => book.seo_slug || book.slug;
const bookHref = (book) => `/books/${encodeURI(preferredSlug(book))}`;

const organizationLd = {
  "@type": "Organization",
  "@id": `${BASE}/#organization`,
  name: "Booknomics",
  url: `${BASE}/`,
  description: "Booknomics publishes structured book summaries, analysis, key ideas, and practical applications in English and Hindi.",
  knowsLanguage: ["en", "hi"],
  publishingPrinciples: `${BASE}/about#editorial-process`,
};
const websiteLd = {
  "@type": "WebSite",
  "@id": `${BASE}/#website`,
  url: `${BASE}/`,
  name: "Booknomics",
  publisher: { "@id": `${BASE}/#organization` },
  inLanguage: ["en", "hi"],
};

function renderBookList(books) {
  return `<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:0;list-style:none">${books.map((book) =>
    `<li><a href="${escapeHtml(bookHref(book))}"><strong>${escapeHtml(book.title)}</strong></a>${book.author ? `<br><span>${escapeHtml(book.author)}</span>` : ""}${book.category ? `<br><small>${escapeHtml(book.category)}</small>` : ""}</li>`
  ).join("\n")}</ul>`;
}

// /browse: a real, crawlable inventory page. Only indexable books are linked here.
{
  const canonical = `${BASE}/browse`;
  const title = "Book Summaries in English & Hindi | Booknomics";
  const description = "Browse Booknomics book summaries in English and Hindi with key ideas, deeper analysis, practical lessons, and action-oriented reading guides.";
  const categoryNames = [...new Set(publishedAll.map((book) => book.category).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const ld = {
    "@context": "https://schema.org",
    "@graph": [organizationLd, websiteLd, {
      "@type": "CollectionPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: "Booknomics book library",
      description,
      isPartOf: { "@id": `${BASE}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: publishedAll.length,
        itemListElement: publishedAll.slice(0, 200).map((book, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: book.title,
          url: `${BASE}${bookHref(book)}`,
        })),
      },
    }],
  };
  const root = `<main style="font-family:system-ui,-apple-system,sans-serif;max-width:1180px;margin:0 auto;padding:32px 20px;line-height:1.6">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> › Browse</nav>
    <header><h1>Browse all book summaries</h1><p>${escapeHtml(description)}</p><p><strong>${publishedAll.length}</strong> indexable book summaries are currently available.</p></header>
    <section><h2>Browse by language</h2><p><a href="/english">English book summaries</a> · <a href="/hindi">हिंदी पुस्तक सारांश</a></p></section>
    <section><h2>Browse by category</h2><ul>${categoryNames.map((name) => `<li><a href="/category/${escapeHtml(slugify(name))}">${escapeHtml(name)}</a></li>`).join("")}</ul></section>
    <section><h2>Published book summaries</h2>${renderBookList(publishedAll)}</section>
  </main>`;
  let html = prepareHead(template, { lang: "en", title, description, canonical, jsonLd: ld });
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  writeRoute("/browse", html);
}

// /english: indexable English hub with direct links to every published English page.
{
  const canonical = `${BASE}/english`;
  const title = "English Book Summaries — Key Ideas & Analysis | Booknomics";
  const description = "Explore English book summaries with key ideas, deeper analysis, practical lessons, and actionable reading guides on Booknomics.";
  const ld = {
    "@context": "https://schema.org",
    "@graph": [organizationLd, websiteLd, {
      "@type": "CollectionPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: "English book summaries",
      description,
      inLanguage: "en",
      isPartOf: { "@id": `${BASE}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: publishedEnglish.length,
        itemListElement: publishedEnglish.slice(0, 200).map((book, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: book.title,
          url: `${BASE}${bookHref(book)}`,
        })),
      },
    }],
  };
  const root = `<main lang="en" style="font-family:system-ui,-apple-system,sans-serif;max-width:1180px;margin:0 auto;padding:32px 20px;line-height:1.6">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/browse">Browse</a> › English</nav>
    <header><h1>English book summaries</h1><p>${escapeHtml(description)}</p><p><strong>${publishedEnglish.length}</strong> indexable English summaries are available.</p></header>
    <section><h2>Explore English books</h2>${renderBookList(publishedEnglish)}</section>
  </main>`;
  let html = prepareHead(template, { lang: "en", title, description, canonical, jsonLd: ld });
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  writeRoute("/english", html);
}

// Crawlable category hubs. Match sitemap policy: categories need >=3 published books.
const byCategory = new Map();
for (const book of publishedAll) {
  if (!book.category) continue;
  const key = String(book.category);
  if (!byCategory.has(key)) byCategory.set(key, []);
  byCategory.get(key).push(book);
}
let categoryPages = 0;
for (const [category, books] of byCategory) {
  if (books.length < 3) continue;
  const categorySlug = slugify(category);
  if (!categorySlug) continue;
  const canonical = `${BASE}/category/${encodeURI(categorySlug)}`;
  const title = `${category} Book Summaries — Key Ideas & Lessons | Booknomics`;
  const description = `Explore ${category} book summaries on Booknomics with key ideas, analysis, practical lessons, and related reading.`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category} book summaries`,
    url: canonical,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: books.length,
      itemListElement: books.slice(0, 100).map((book, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: book.title,
        url: `${BASE}${bookHref(book)}`,
      })),
    },
  };
  const root = `<main style="font-family:system-ui,-apple-system,sans-serif;max-width:1180px;margin:0 auto;padding:32px 20px;line-height:1.6">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/browse">Browse</a> › ${escapeHtml(category)}</nav>
    <header><h1>${escapeHtml(category)} book summaries</h1><p>${escapeHtml(description)}</p></header>
    <section><h2>Books in ${escapeHtml(category)}</h2>${renderBookList(books)}</section>
  </main>`;
  let html = prepareHead(template, { lang: "en", title, description, canonical, jsonLd: ld });
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  writeRoute(`/category/${categorySlug}`, html);
  categoryPages++;
}

// English book pages: full initial HTML, not a "Loading book…" shell.
let englishIndexable = 0;
let englishNoindex = 0;
for (const book of englishPublic) {
  const slug = preferredSlug(book);
  if (!slug || !book.title) continue;
  const canonical = `${BASE}/books/${encodeURI(slug)}`;
  const title = clamp(book.meta_title, 68) || `${book.title} Summary: Key Ideas & Analysis | Booknomics`;
  const description = clamp(book.meta_description, 180) || clamp(`${book.title} by ${book.author || ""}. ${book.overview || book.tagline || "Read the key ideas, analysis, lessons, and practical applications."}`, 180);
  const image = book.og_image || book.cover_url || `${BASE}/og-default.svg`;
  const noindex = book.status === "published_noindex";
  const sameCategory = publishedAll
    .filter((candidate) => candidate.id !== book.id && candidate.category && candidate.category === book.category)
    .slice(0, 6);
  const overview = clamp(book.overview || book.tagline || "", 1800);
  const ideas = clamp(book.key_ideas || "", 1400);
  const analysis = clamp(book.deep_analysis || "", 1400);
  const application = clamp(book.daily_application || "", 900);
  const bookLd = {
    "@type": "Book",
    "@id": `${canonical}#book`,
    name: book.title,
    author: { "@type": "Person", name: book.author || "Unknown" },
    inLanguage: "en",
    genre: book.category || undefined,
    image,
    ...(book.year ? { datePublished: String(book.year) } : {}),
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationLd, websiteLd, {
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: title,
      description,
      inLanguage: "en",
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      publisher: { "@id": `${BASE}/#organization` },
      about: { "@id": `${canonical}#book` },
      ...(image ? { image: [image] } : {}),
    }, bookLd, {
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
        { "@type": "ListItem", position: 2, name: "English", item: `${BASE}/english` },
        ...(book.category ? [{ "@type": "ListItem", position: 3, name: book.category, item: `${BASE}/category/${encodeURI(slugify(book.category))}` }] : []),
        { "@type": "ListItem", position: book.category ? 4 : 3, name: book.title, item: canonical },
      ],
    }],
  };
  const root = `<main lang="en" style="font-family:system-ui,-apple-system,sans-serif;max-width:1040px;margin:0 auto;padding:32px 20px;line-height:1.68">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/english">English</a>${book.category ? ` › <a href="/category/${escapeHtml(slugify(book.category))}">${escapeHtml(book.category)}</a>` : ""} › ${escapeHtml(book.title)}</nav>
    <article>
      <header><p>${escapeHtml(book.category || "Book summary")}</p><h1>${escapeHtml(book.title)}</h1><p>by ${escapeHtml(book.author || "Unknown author")}</p>${book.tagline ? `<p><em>${escapeHtml(book.tagline)}</em></p>` : ""}${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(`${book.title} book summary cover`)}" width="280" loading="eager" />` : ""}</header>
      ${overview ? `<section><h2>${escapeHtml(book.title)} summary</h2><p>${escapeHtml(overview)}</p></section>` : ""}
      ${ideas ? `<section><h2>Key ideas</h2><p>${escapeHtml(ideas)}</p></section>` : ""}
      ${analysis ? `<section><h2>Analysis</h2><p>${escapeHtml(analysis)}</p></section>` : ""}
      ${application ? `<section><h2>Practical application</h2><p>${escapeHtml(application)}</p></section>` : ""}
      <section><h2>Continue exploring</h2><p><a href="/english">More English book summaries</a> · <a href="/browse">Browse the full library</a>${book.category ? ` · <a href="/category/${escapeHtml(slugify(book.category))}">More ${escapeHtml(book.category)} books</a>` : ""}</p>${sameCategory.length ? renderBookList(sameCategory) : ""}</section>
    </article>
  </main>`;
  let html = prepareHead(template, { lang: "en", title, description, canonical, image, jsonLd, noindex });
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  writeRoute(`/books/${slug}`, html);
  if (noindex) englishNoindex++; else englishIndexable++;
}

console.log(`[prerender-en-crawl] ✅ browse + English hub + ${categoryPages} category hubs + ${englishIndexable} indexable English books + ${englishNoindex} noindex English books`);
