import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const TEMPLATE_FILE = resolve("dist", "index.html");
const OUTPUT_FILE = resolve("dist", "best-hindi-book-summaries", "index.html");
const BASE = "https://www.booknomics.com";
const PAGE_URL = `${BASE}/best-hindi-book-summaries`;
const TITLE = "Best Hindi Book Summaries | Booknomics";
const DESCRIPTION = "Booknomics पर चुने हुए हिंदी पुस्तक सारांश पढ़ें — साहित्य, इतिहास और दर्शन की किताबों के मुख्य विचार, गहन विश्लेषण, अभ्यास और रिफ्लेक्शन के साथ।";

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

const FAQS = [
  ["हिंदी पुस्तक सारांश क्या होते हैं?", "हिंदी पुस्तक सारांश किसी किताब के मुख्य विचार, संदर्भ, सीख और उपयोगी विश्लेषण का संरचित रूप होते हैं।"],
  ["क्या ये पूरी किताबें हैं या केवल सारांश?", "Booknomics पूरी किताब का पाठ नहीं देता। यहाँ स्वतंत्र अध्ययन-सारांश, मुख्य विचार, गहन विश्लेषण और अभ्यास सामग्री दी जाती है।"],
  ["मुझे किस किताब से शुरू करना चाहिए?", "साहित्य के लिए रक्तकरबी या ढाई घर, इतिहास के लिए आइने-अकबरी, भारतीय विचार के लिए अर्थशास्त्र, और दर्शन के लिए ताओ ते चिंग, मेडिटेशन्स या रिपब्लिक से शुरुआत कर सकते हैं।"],
  ["Booknomics कम-भरोसे वाले पृष्ठों के साथ क्या करता है?", "अधूरे या कम-भरोसे वाले Hindi pages को मुख्य indexable catalog से बाहर रखा जाता है और quality review के बाद ही वापस जोड़ा जाता है।"],
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
  if (!response.ok) {
    throw new Error(`finalize-hindi-guide: Supabase ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const books = await api(
  "books?select=slug,seo_slug,title,author,category&language=eq.hi&is_draft=eq.false&status=eq.published&order=title.asc&limit=500",
);
if (!Array.isArray(books) || books.length < 20) {
  throw new Error(`finalize-hindi-guide: suspiciously small published Hindi catalog (${Array.isArray(books) ? books.length : 0})`);
}

const bySlug = new Map();
for (const book of books) {
  if (book.slug) bySlug.set(book.slug, book);
  if (book.seo_slug) bySlug.set(book.seo_slug, book);
}
const featured = FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);
for (const book of books) {
  if (featured.length >= 12) break;
  if (!featured.some((item) => item.slug === book.slug)) featured.push(book);
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
      description: DESCRIPTION,
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
    {
      "@type": "FAQPage",
      inLanguage: "hi-IN",
      mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ],
};

const featuredHtml = featured.map((book) => {
  const slug = book.seo_slug || book.slug;
  const author = book.author ? ` — ${escapeHtml(book.author)}` : "";
  const category = book.category ? ` <small>(${escapeHtml(book.category)})</small>` : "";
  return `<li><a href="/books/${escapeHtml(encodeURI(slug))}"><strong>${escapeHtml(book.title)}</strong></a>${author}${category}</li>`;
}).join("\n");
const faqHtml = FAQS.map(([q, a]) => `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>`).join("\n");

const body = `<main lang="hi" style="font-family:system-ui,-apple-system,sans-serif;max-width:980px;margin:0 auto;padding:32px 20px;line-height:1.7">
<nav aria-label="Breadcrumb"><a href="/">होम</a> › <a href="/hindi">हिंदी</a> › Best Hindi Book Summaries</nav>
<header><p>Booknomics हिंदी क्यूरेटेड गाइड</p><h1>Best Hindi Book Summaries</h1><p>${escapeHtml(DESCRIPTION)}</p><p>मुख्य Hindi catalog में अभी <strong>${books.length}</strong> indexable पुस्तक पृष्ठ हैं।</p></header>
<section><h2>शुरुआत के लिए चुनी हुई हिंदी किताबें</h2><ul>${featuredHtml}</ul><p><a href="/hindi">सभी indexable Hindi summaries देखें</a>.</p></section>
<section><h2>Booknomics की Hindi quality policy</h2><p>यह guide केवल current <strong>published/indexable</strong> Hindi catalog से किताबें चुनती है। अधूरे, generic-template या कम-भरोसे वाले पृष्ठ main catalog और featured recommendations से बाहर रखे जाते हैं जब तक उनका quality review पूरा न हो।</p></section>
<section><h2>किस तरह की किताब से शुरू करें?</h2><p>साहित्य के लिए <a href="/books/${encodeURI("रक्तकरबी")}">रक्तकरबी</a> या <a href="/books/${encodeURI("ढाई-घर-गिरिराज-किशोर-saransh")}">ढाई घर</a>; इतिहास के लिए <a href="/books/${encodeURI("आइने-अकबरी-hindi-summary")}">आइने-अकबरी</a>; भारतीय विचार के लिए <a href="/books/${encodeURI("अर्थशास्त्र-hindi-summary")}">अर्थशास्त्र</a>; और दर्शन के लिए <a href="/books/${encodeURI("ताओ-ते-चिंग-hindi-summary")}">ताओ ते चिंग</a>, <a href="/books/${encodeURI("मेडिटेशन्स-hindi-summary")}">मेडिटेशन्स</a> या <a href="/books/${encodeURI("रिपब्लिक-hindi-summary")}">रिपब्लिक</a> से शुरुआत की जा सकती है।</p></section>
<section><h2>सारांश का सही उपयोग</h2><p>सारांश से पुस्तक की दिशा समझें, मुख्य विचार नोट करें, फिर जहाँ विषय आपके लिए महत्वपूर्ण हो वहाँ मूल पुस्तक या भरोसेमंद स्रोत से आगे पढ़ें। Booknomics सारांश मूल पुस्तक का विकल्प नहीं है।</p></section>
<section><h2>अक्सर पूछे जाने वाले प्रश्न</h2>${faqHtml}</section>
</main>`;

let html = readFileSync(TEMPLATE_FILE, "utf8");
html = html.replace(/<html\s+lang=["'][^"']+["']>/i, '<html lang="hi">');
html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(TITLE)}</title>`);
html = replaceMeta(html, "name", "description", DESCRIPTION);
html = replaceMeta(html, "name", "author", "Booknomics Editorial");
html = replaceMeta(html, "name", "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
html = replaceMeta(html, "name", "googlebot", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
html = replaceMeta(html, "property", "og:title", TITLE);
html = replaceMeta(html, "property", "og:description", DESCRIPTION);
html = replaceMeta(html, "property", "og:url", PAGE_URL);
html = replaceMeta(html, "name", "twitter:title", TITLE);
html = replaceMeta(html, "name", "twitter:description", DESCRIPTION);
html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
html = html.replace("</head>", `  <link rel="canonical" href="${PAGE_URL}" />\n  <link rel="alternate" hreflang="hi-IN" href="${PAGE_URL}" />\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`);
if (!html.includes('<div id="root"></div>')) {
  throw new Error("finalize-hindi-guide: root placeholder not found");
}
html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
writeFileSync(OUTPUT_FILE, html);

console.log(`[finalize-hindi-guide] prerendered guide with ${featured.length} featured books from ${books.length} published Hindi pages`);
