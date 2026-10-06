import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("prerender-seo: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
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
  .replace(/[#*_>`~\[\]()]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const clamp = (value, max) => {
  const text = stripMarkdown(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};

function replaceMeta(html, attr, key, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function prepareHead(html, { lang = "hi", title, description, canonical, image, jsonLd }) {
  let out = html.replace(/<html\s+lang=["'][^"']+["']>/i, `<html lang="${lang}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = replaceMeta(out, "name", "description", description);
  out = replaceMeta(out, "property", "og:title", title);
  out = replaceMeta(out, "property", "og:description", description);
  out = replaceMeta(out, "name", "twitter:title", title);
  out = replaceMeta(out, "name", "twitter:description", description);
  out = replaceMeta(out, "property", "og:url", canonical);
  if (image) {
    out = replaceMeta(out, "property", "og:image", image);
    out = replaceMeta(out, "name", "twitter:image", image);
  }
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  out = out.replace("</head>", `  <link rel="canonical" href="${escapeHtml(canonical)}" />\n  <link rel="alternate" hreflang="hi-IN" href="${escapeHtml(canonical)}" />\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`);
  return out;
}

function writeRoute(pathname, html) {
  const file = resolve(DIST, pathname.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

async function supabase(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`prerender-seo: Supabase ${response.status} ${await response.text()}`);
  return response.json();
}

const publishedHindi = await supabase(
  "books?select=id,slug,seo_slug,title,author,category,cover_url,tagline,overview,key_ideas,meta_title,meta_description,reading_time,rating&language=eq.hi&is_draft=eq.false&status=eq.published&order=title.asc&limit=500"
);

if (!Array.isArray(publishedHindi) || publishedHindi.length < 20) {
  throw new Error(`prerender-seo: expected published Hindi catalog, got ${publishedHindi?.length ?? 0}`);
}

const featured = publishedHindi.slice(0, 48);
const hindiCanonical = `${BASE}/hindi`;
const hindiTitle = "हिंदी पुस्तक सारांश — लोकप्रिय किताबों के सारांश और विश्लेषण | Booknomics";
const hindiDescription = "प्रेमचंद, दिनकर, महादेवी वर्मा, चाणक्य और अन्य लेखकों की हिंदी किताबों के सारांश, पात्र, मुख्य विचार, सीख और गहन विश्लेषण पढ़ें।";
const hindiLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "हिंदी पुस्तक सारांश",
  inLanguage: "hi-IN",
  url: hindiCanonical,
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: publishedHindi.length,
    itemListElement: featured.map((book, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: book.title,
      url: `${BASE}/books/${encodeURI(book.seo_slug || book.slug)}`,
    })),
  },
};

const hindiRoot = `
<main lang="hi" style="font-family:system-ui,-apple-system,sans-serif;max-width:1180px;margin:0 auto;padding:32px 20px;line-height:1.65">
  <header>
    <p>Booknomics हिंदी पुस्तकालय</p>
    <h1>हिंदी पुस्तक सारांश</h1>
    <p>${escapeHtml(hindiDescription)}</p>
    <p><strong>${publishedHindi.length}</strong> प्रकाशित हिंदी पुस्तक सारांश उपलब्ध हैं।</p>
  </header>
  <section aria-labelledby="popular-hindi-books">
    <h2 id="popular-hindi-books">लोकप्रिय हिंदी पुस्तकें</h2>
    <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;padding:0;list-style:none">
      ${featured.map((book) => {
        const slug = book.seo_slug || book.slug;
        return `<li><a href="/books/${escapeHtml(slug)}"><strong>${escapeHtml(book.title)}</strong></a><br><span>${escapeHtml(book.author || "")}</span>${book.category ? `<br><small>${escapeHtml(book.category)}</small>` : ""}</li>`;
      }).join("\n")}
    </ul>
  </section>
  <p><a href="/best-hindi-book-summaries">Best Hindi Book Summaries guide देखें</a></p>
</main>`;

let hindiHtml = prepareHead(template, {
  title: hindiTitle,
  description: hindiDescription,
  canonical: hindiCanonical,
  jsonLd: hindiLd,
});
hindiHtml = hindiHtml.replace('<div id="root"></div>', `<div id="root">${hindiRoot}</div>`);
writeRoute("/hindi", hindiHtml);

let writtenBooks = 0;
for (const book of publishedHindi) {
  const slug = book.seo_slug || book.slug;
  if (!slug || !book.title) continue;
  const canonical = `${BASE}/books/${encodeURI(slug)}`;
  const title = clamp(book.meta_title, 68) || `${book.title} सारांश हिंदी में | Booknomics`;
  const description = clamp(book.meta_description, 180) || clamp(`${book.title} — ${book.author || ""}. ${book.overview || book.tagline || "हिंदी सारांश, मुख्य विचार और विश्लेषण।"}`, 180);
  const image = book.cover_url || `${BASE}/og-default.svg`;
  const overview = clamp(book.overview || book.tagline || "", 1400);
  const keyIdeas = clamp(book.key_ideas || "", 900);
  const bookLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: book.title,
    description,
    inLanguage: "hi-IN",
    url: canonical,
    primaryImageOfPage: image ? { "@type": "ImageObject", url: image } : undefined,
    mainEntity: {
      "@type": "Book",
      name: book.title,
      author: book.author ? { "@type": "Person", name: book.author } : undefined,
      inLanguage: "hi",
      image: book.cover_url || undefined,
    },
  };
  const staticRoot = `
<main lang="hi" style="font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:0 auto;padding:32px 20px;line-height:1.75">
  <nav aria-label="Breadcrumb"><a href="/">होम</a> › <a href="/hindi">हिंदी</a> › ${escapeHtml(book.title)}</nav>
  <article>
    <h1>${escapeHtml(book.title)} — हिंदी सारांश</h1>
    ${book.author ? `<p><strong>लेखक:</strong> ${escapeHtml(book.author)}</p>` : ""}
    ${book.category ? `<p><strong>श्रेणी:</strong> ${escapeHtml(book.category)}</p>` : ""}
    ${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(`${book.title} पुस्तक कवर`)}" width="320" height="480" loading="eager" />` : ""}
    ${overview ? `<section><h2>पुस्तक का परिचय</h2><p>${escapeHtml(overview)}</p></section>` : ""}
    ${keyIdeas ? `<section><h2>मुख्य विचार</h2><p>${escapeHtml(keyIdeas)}</p></section>` : ""}
    <p><a href="/hindi">और हिंदी पुस्तक सारांश देखें</a></p>
  </article>
</main>`;
  let html = prepareHead(template, { title, description, canonical, image, jsonLd: bookLd });
  html = html.replace('<div id="root"></div>', `<div id="root">${staticRoot}</div>`);
  writeRoute(`/books/${slug}`, html);
  writtenBooks++;
}

console.log(`[prerender-seo] wrote /hindi + ${writtenBooks} published Hindi book snapshots`);
