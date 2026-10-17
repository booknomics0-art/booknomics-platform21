import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const TEMPLATE_FILE = resolve("dist", "index.html");
const OUTPUT_FILE = resolve("dist", "best-hindi-book-summaries", "index.html");
const BASE = "https://www.booknomics.com";
const PAGE_URL = `${BASE}/best-hindi-book-summaries`;
const TITLE = "Best Hindi Book Summaries | Booknomics";
const INDEXABLE_DESCRIPTION = "Booknomics पर चुने हुए हिंदी पुस्तक सारांश पढ़ें — साहित्य, इतिहास और दर्शन की किताबों के मुख्य विचार, गहन विश्लेषण, अभ्यास और रिफ्लेक्शन के साथ।";
const HOLD_DESCRIPTION = "Booknomics का Hindi catalog अभी editorial quality review में है। केवल book-specific, original और useful pages quality gate pass करने के बाद search indexing और advertising के लिए eligible होंगे।";
const PAGE_SIZE = 500;

const FEATURED_SLUGS = [
  "रक्तकरबी",
  "अर्थशास्त्र-hindi-summary",
  "ताओ-ते-चिंग-hindi-summary",
  "मेडिटेशन्स-hindi-summary",
  "रिपब्लिक-hindi-summary",
  "मृगनयनी-वृंदावनलाल-वरमा-सारांश",
  "वोलगा-से-गंगा-राहुल-सांकृतयायन-सारांश",
  "अभयुदय-नरेनदर-कोहली-सारांश",
  "ढाई-घर-गिरिराज-किशोर-saransh",
  "आइने-अकबरी-hindi-summary",
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("finalize-hindi-guide: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
}

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function replaceMeta(html, attr, key, value) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  const pattern = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
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
  if (!response.ok) throw new Error(`finalize-hindi-guide: Supabase ${response.status} ${await response.text()}`);
  return response.json();
}

async function fetchPublishedHindi() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await api(
      `books?select=slug,seo_slug,title,author,category&language=eq.hi&is_draft=eq.false&status=eq.published&order=title.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    if (!Array.isArray(page)) throw new Error("finalize-hindi-guide: expected an array response");
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

const books = await fetchPublishedHindi();
const guideIndexable = books.length >= 20;
const description = guideIndexable ? INDEXABLE_DESCRIPTION : HOLD_DESCRIPTION;
const robots = guideIndexable
  ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
  : "noindex,follow";

const bySlug = new Map();
for (const book of books) {
  if (book.slug) bySlug.set(book.slug, book);
  if (book.seo_slug) bySlug.set(book.seo_slug, book);
}
const featured = guideIndexable ? FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean) : [];
if (guideIndexable) {
  for (const book of books) {
    if (featured.length >= 12) break;
    if (!featured.some((item) => (item.seo_slug || item.slug) === (book.seo_slug || book.slug))) featured.push(book);
  }
}

const itemList = featured.map((book, index) => ({
  "@type": "ListItem",
  position: index + 1,
  name: book.title,
  url: `${BASE}/books/${encodeURI(book.seo_slug || book.slug)}`,
}));
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${PAGE_URL}#webpage`,
      name: "Best Hindi Book Summaries",
      url: PAGE_URL,
      description,
      inLanguage: "hi-IN",
      mainEntity: { "@type": "ItemList", numberOfItems: featured.length, itemListElement: itemList },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${PAGE_URL}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Booknomics", item: `${BASE}/` },
        { "@type": "ListItem", position: 2, name: "Hindi", item: `${BASE}/hindi` },
        { "@type": "ListItem", position: 3, name: "Best Hindi Book Summaries", item: PAGE_URL },
      ],
    },
  ],
};

const featuredHtml = featured.map((book) => {
  const slug = book.seo_slug || book.slug;
  const author = book.author ? ` — ${escapeHtml(book.author)}` : "";
  const category = book.category ? ` <small>(${escapeHtml(book.category)})</small>` : "";
  return `<li><a href="/books/${escapeHtml(encodeURI(slug))}"><strong>${escapeHtml(book.title)}</strong></a>${author}${category}</li>`;
}).join("\n");

const body = guideIndexable
  ? `<main lang="hi" style="font-family:system-ui,-apple-system,sans-serif;max-width:980px;margin:0 auto;padding:32px 20px;line-height:1.7">
<nav aria-label="Breadcrumb"><a href="/">होम</a> › <a href="/hindi">हिंदी</a> › Best Hindi Book Summaries</nav>
<header><p>Booknomics हिंदी क्यूरेटेड गाइड</p><h1>Best Hindi Book Summaries</h1><p>${escapeHtml(description)}</p><p>मुख्य Hindi catalog में अभी <strong>${books.length}</strong> indexable पुस्तक पृष्ठ हैं।</p></header>
<section><h2>शुरुआत के लिए चुनी हुई हिंदी किताबें</h2><ul>${featuredHtml}</ul><p><a href="/hindi">सभी indexable Hindi summaries देखें</a>.</p></section>
<section><h2>Booknomics की Hindi quality policy</h2><p>यह guide केवल current <strong>published/indexable</strong> Hindi catalog से किताबें चुनती है। अधूरे, generic-template या कम-भरोसे वाले पृष्ठ main catalog और featured recommendations से बाहर रखे जाते हैं जब तक उनका quality review पूरा न हो।</p></section>
<section><h2>सारांश का सही उपयोग</h2><p>सारांश से पुस्तक की दिशा समझें, मुख्य विचार नोट करें, फिर जहाँ विषय महत्वपूर्ण हो वहाँ मूल पुस्तक या भरोसेमंद स्रोत से आगे पढ़ें। Booknomics सारांश मूल पुस्तक का विकल्प नहीं है।</p></section>
</main>`
  : `<main lang="hi" style="font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:0 auto;padding:32px 20px;line-height:1.7">
<nav aria-label="Breadcrumb"><a href="/">होम</a> › <a href="/hindi">हिंदी</a> › Best Hindi Book Summaries</nav>
<header><p>Booknomics हिंदी क्यूरेटेड गाइड</p><h1>Best Hindi Book Summaries</h1><p>${escapeHtml(description)}</p></header>
<section><h2>Editorial quality hold</h2><p>इस समय कोई Hindi page Booknomics के current indexable publishing gate को pass नहीं करता। Existing Hindi records सुरक्षित हैं, लेकिन उन्हें search indexing और advertising से बाहर रखा गया है जब तक book-specific accuracy, originality और usefulness review पूरा न हो।</p></section>
<section><h2>हम क्या जाँचते हैं?</h2><p>Book-specific summary depth, repeated/template text, factual attribution, canonical metadata, structured data और practical usefulness को दोबारा verify किया जाता है। Quality pass होने पर योग्य pages फिर से published/indexable किए जाएंगे।</p></section>
<p><a href="/about#editorial-process">Booknomics editorial process पढ़ें</a>.</p>
</main>`;

let html = readFileSync(TEMPLATE_FILE, "utf8");
html = html.replace(/<html\s+lang=["'][^"']+["']>/i, '<html lang="hi">');
html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(TITLE)}</title>`);
html = replaceMeta(html, "name", "description", description);
html = replaceMeta(html, "name", "author", "Booknomics Editorial");
html = replaceMeta(html, "name", "robots", robots);
html = replaceMeta(html, "name", "googlebot", robots);
html = replaceMeta(html, "property", "og:title", TITLE);
html = replaceMeta(html, "property", "og:description", description);
html = replaceMeta(html, "property", "og:url", PAGE_URL);
html = replaceMeta(html, "name", "twitter:title", TITLE);
html = replaceMeta(html, "name", "twitter:description", description);
html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
html = html.replace("</head>", `  <link rel="canonical" href="${PAGE_URL}" />\n  <link rel="alternate" hreflang="hi-IN" href="${PAGE_URL}" />\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`);
if (!html.includes('<div id="root"></div>')) throw new Error("finalize-hindi-guide: root placeholder not found");
html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
writeFileSync(OUTPUT_FILE, html);

console.log(`[finalize-hindi-guide] ${guideIndexable ? `prerendered indexable guide with ${featured.length} featured books from ${books.length} published Hindi pages` : `prerendered noindex quality-hold guide with ${books.length} published Hindi pages`}`);
