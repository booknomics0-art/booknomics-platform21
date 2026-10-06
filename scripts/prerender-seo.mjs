import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const ORG_ID = `${BASE}/#organization`;
const WEBSITE_ID = `${BASE}/#website`;
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
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^[-*•]+\s+/gm, "")
  .replace(/\*\*|__|\*|_/g, "")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

const clamp = (value, max) => {
  const text = stripMarkdown(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};

const normalizeKey = (value = "") => stripMarkdown(value)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const LOW_SIGNAL_MARKERS = [
  "particular way of seeing",
  "modern application",
  "hidden assumption",
  "आत्म-चिंतन का महत्व",
  "रिश्तों की कीमत",
  "सामाजिक जिम्मेदारी",
  "नैतिक मूल्यों का पालन",
  "परिवर्तन को स्वीकार करना",
];

function isLowSignal(text = "") {
  const normalized = text.toLowerCase();
  return LOW_SIGNAL_MARKERS.some((marker) => normalized.includes(marker));
}

function extractTakeaways(book, max = 5) {
  const sources = [book.key_ideas, book.deep_analysis, book.overview].filter(Boolean);
  const out = [];
  const seen = new Set();

  for (const source of sources) {
    const chunks = String(source)
      .replace(/\r/g, "")
      .split(/\n{1,}|(?<=[.!?।॥])\s+/)
      .map((chunk) => stripMarkdown(chunk))
      .map((chunk) => chunk.replace(/^\d+[.)]\s*/, "").trim())
      .filter((chunk) => chunk.length >= 32 && chunk.length <= 330 && !isLowSignal(chunk));

    for (const chunk of chunks) {
      const sentence = chunk.split(/(?<=[.!?।॥])\s+/)[0]?.trim() || chunk;
      const value = sentence.length > 230 ? `${sentence.slice(0, 227).trim()}…` : sentence;
      const key = normalizeKey(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
      if (out.length >= max) return out;
    }
  }
  return out;
}

function replaceMeta(html, attr, key, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function prepareHead(html, { lang = "hi", title, description, canonical, image, jsonLd, noindex = false }) {
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
  out = replaceMeta(out, "name", "twitter:title", title);
  out = replaceMeta(out, "name", "twitter:description", description);
  out = replaceMeta(out, "property", "og:url", canonical);
  if (image) {
    out = replaceMeta(out, "property", "og:image", image);
    out = replaceMeta(out, "name", "twitter:image", image);
  }
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  out = out.replace(
    "</head>",
    `  <link rel="canonical" href="${escapeHtml(canonical)}" />\n` +
    `  <link rel="alternate" hreflang="hi-IN" href="${escapeHtml(canonical)}" />\n` +
    `  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`,
  );
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

const liveHindi = await supabase(
  "books?select=id,slug,seo_slug,title,author,category,cover_url,og_image,tagline,overview,key_ideas,deep_analysis,daily_application,meta_title,meta_description,reading_time,rating,year,seo_keywords,status&language=eq.hi&is_draft=eq.false&status=in.(published,published_noindex)&order=title.asc&limit=1000"
);

if (!Array.isArray(liveHindi)) {
  throw new Error("prerender-seo: Hindi catalog response is not an array");
}

const publishedHindi = liveHindi.filter((book) => book.status === "published");
if (publishedHindi.length < 20) {
  throw new Error(`prerender-seo: expected published Hindi catalog, got ${publishedHindi.length}`);
}

const organizationLd = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Booknomics",
  url: `${BASE}/`,
  description: "Booknomics is a bilingual learning platform for practical book summaries, deeper analysis, reflection, and action in Hindi and English.",
  areaServed: { "@type": "Country", name: "India" },
  knowsLanguage: ["hi", "en"],
  publishingPrinciples: `${BASE}/about#editorial-process`,
};

const websiteLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: `${BASE}/`,
  name: "Booknomics",
  publisher: { "@id": ORG_ID },
  inLanguage: ["hi", "en"],
};

const featured = publishedHindi.slice(0, 48);
const hindiCanonical = `${BASE}/hindi`;
const hindiTitle = "हिंदी पुस्तक सारांश — लोकप्रिय किताबों के सारांश और विश्लेषण | Booknomics";
const hindiDescription = "प्रेमचंद, दिनकर, महादेवी वर्मा और अन्य लेखकों की हिंदी किताबों के सारांश, पात्र, मुख्य विचार, सीख और गहन विश्लेषण Booknomics पर पढ़ें।";
const hindiLd = {
  "@context": "https://schema.org",
  "@graph": [
    organizationLd,
    websiteLd,
    {
      "@type": "CollectionPage",
      "@id": `${hindiCanonical}#webpage`,
      name: "हिंदी पुस्तक सारांश",
      description: hindiDescription,
      inLanguage: "hi-IN",
      url: hindiCanonical,
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORG_ID },
      about: [
        { "@type": "Thing", name: "Hindi book summaries" },
        { "@type": "Thing", name: "Hindi literature" },
        { "@type": "Thing", name: "Book analysis" },
      ],
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
    },
  ],
};

const hindiRoot = `
<main lang="hi" style="font-family:system-ui,-apple-system,sans-serif;max-width:1180px;margin:0 auto;padding:32px 20px;line-height:1.65">
  <header>
    <p>Booknomics हिंदी पुस्तकालय</p>
    <h1>हिंदी पुस्तक सारांश</h1>
    <p>${escapeHtml(hindiDescription)}</p>
    <p><strong>${publishedHindi.length}</strong> इंडेक्स योग्य हिंदी पुस्तक सारांश उपलब्ध हैं।</p>
  </header>
  <section aria-labelledby="hindi-answer">
    <h2 id="hindi-answer">Booknomics की हिंदी लाइब्रेरी में क्या मिलता है?</h2>
    <p>Booknomics हिंदी पाठकों के लिए पुस्तक का संक्षिप्त उत्तर, मूल लेखक की पहचान, मुख्य विचार, गहरा विश्लेषण, व्यावहारिक सीख और संबंधित किताबों की खोज एक ही जगह देता है। हर Booknomics सारांश मूल पुस्तक से अलग एक स्वतंत्र अध्ययन-मार्गदर्शिका है।</p>
  </section>
  <section aria-labelledby="popular-hindi-books">
    <h2 id="popular-hindi-books">लोकप्रिय हिंदी पुस्तकें</h2>
    <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;padding:0;list-style:none">
      ${featured.map((book) => {
        const slug = book.seo_slug || book.slug;
        return `<li><a href="/books/${escapeHtml(slug)}"><strong>${escapeHtml(book.title)}</strong></a><br><span>${escapeHtml(book.author || "")}</span>${book.category ? `<br><small>${escapeHtml(book.category)}</small>` : ""}</li>`;
      }).join("\n")}
    </ul>
  </section>
  <section aria-labelledby="editorial-note">
    <h2 id="editorial-note">सारांश कैसे तैयार होते हैं?</h2>
    <p>Booknomics पुस्तक की पहचान, पुस्तक-विशिष्ट सामग्री, canonical URL, उपयोगी उत्तर और गुणवत्ता संकेतों को प्राथमिकता देता है। कम भरोसे या अधूरे पेज search indexing से बाहर रखे जा सकते हैं जब तक वे बेहतर न हों। <a href="/about#editorial-process">Editorial process पढ़ें</a>.</p>
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

let writtenIndexable = 0;
let writtenNoindex = 0;
for (const book of liveHindi) {
  const slug = book.seo_slug || book.slug;
  if (!slug || !book.title) continue;

  const canonical = `${BASE}/books/${encodeURI(slug)}`;
  const title = clamp(book.meta_title, 68) || `${book.title} सारांश हिंदी में | Booknomics`;
  const description = clamp(book.meta_description, 180) || clamp(`${book.title} — ${book.author || ""}. ${book.overview || book.tagline || "हिंदी सारांश, मुख्य विचार और विश्लेषण।"}`, 180);
  const image = book.og_image || book.cover_url || `${BASE}/og-default.svg`;
  const overview = clamp(book.overview || book.tagline || "", 1500);
  const keyIdeas = clamp(book.key_ideas || "", 1200);
  const application = clamp(book.daily_application || "", 800);
  const takeaways = extractTakeaways(book, 5);
  const directAnswer = clamp(book.overview || book.tagline || book.deep_analysis || "", 680);
  const isNoindex = book.status === "published_noindex";
  const bookId = `${canonical}#book`;
  const pageId = `${canonical}#webpage`;
  const articleId = `${canonical}#article`;
  const breadcrumbId = `${canonical}#breadcrumb`;
  const faqId = `${canonical}#faq`;
  const keywords = Array.isArray(book.seo_keywords) ? book.seo_keywords.filter(Boolean).slice(0, 12) : [];
  const wordCount = stripMarkdown([
    book.overview,
    book.key_ideas,
    book.deep_analysis,
    book.daily_application,
  ].filter(Boolean).join(" ")).split(/\s+/).filter(Boolean).length;

  const faqEntries = [
    book.author ? {
      question: `${book.title} के लेखक कौन हैं?`,
      answer: `${book.title} के लेखक ${book.author} हैं। Booknomics का यह पृष्ठ ${book.title} का स्वतंत्र हिंदी अध्ययन-सारांश है।`,
    } : null,
    directAnswer ? {
      question: `${book.title} का संक्षिप्त सारांश क्या है?`,
      answer: directAnswer,
    } : null,
    takeaways.length ? {
      question: `${book.title} की मुख्य बातें क्या हैं?`,
      answer: takeaways.slice(0, 3).join(" "),
    } : null,
    {
      question: `क्या Booknomics पर ${book.title} मूल पुस्तक का पूरा पाठ है?`,
      answer: `नहीं। Booknomics का यह पृष्ठ ${book.title} की स्वतंत्र अध्ययन-मार्गदर्शिका और सारांश है; मूल पुस्तक और उसके लेखक अलग स्रोत-रचना हैं।`,
    },
  ].filter(Boolean);

  const graph = [
    organizationLd,
    websiteLd,
    {
      "@type": "Book",
      "@id": bookId,
      name: book.title,
      author: book.author ? { "@type": "Person", name: book.author } : undefined,
      inLanguage: "hi",
      genre: book.category || undefined,
      datePublished: book.year ? String(book.year) : undefined,
      image: book.cover_url || undefined,
    },
    {
      "@type": "WebPage",
      "@id": pageId,
      name: title,
      description,
      inLanguage: "hi-IN",
      url: canonical,
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORG_ID },
      breadcrumb: { "@id": breadcrumbId },
      mainEntity: { "@id": bookId },
      primaryImageOfPage: image ? { "@type": "ImageObject", url: image } : undefined,
    },
    {
      "@type": "Article",
      "@id": articleId,
      headline: title,
      description,
      abstract: directAnswer || description,
      inLanguage: "hi-IN",
      mainEntityOfPage: { "@id": pageId },
      isPartOf: { "@id": WEBSITE_ID },
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      about: { "@id": bookId },
      isBasedOn: { "@id": bookId },
      citation: { "@id": bookId },
      ...(wordCount ? { wordCount } : {}),
      ...(keywords.length ? { keywords: keywords.join(", ") } : {}),
      ...(image ? { image: [image] } : {}),
    },
    {
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Booknomics", item: `${BASE}/` },
        { "@type": "ListItem", position: 2, name: "हिंदी पुस्तक सारांश", item: `${BASE}/hindi` },
        ...(book.category ? [{ "@type": "ListItem", position: 3, name: book.category }] : []),
        { "@type": "ListItem", position: book.category ? 4 : 3, name: book.title, item: canonical },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": faqId,
      inLanguage: "hi-IN",
      mainEntity: faqEntries.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: entry.answer },
      })),
    },
  ];

  const bookLd = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  const staticRoot = `
<main lang="hi" style="font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:0 auto;padding:32px 20px;line-height:1.75">
  <nav aria-label="Breadcrumb"><a href="/">होम</a> › <a href="/hindi">हिंदी</a> › ${escapeHtml(book.title)}</nav>
  <article>
    <header>
      <p>Booknomics हिंदी अध्ययन-सारांश</p>
      <h1>${escapeHtml(book.title)} — हिंदी सारांश</h1>
      ${book.author ? `<p><strong>लेखक:</strong> ${escapeHtml(book.author)}</p>` : ""}
      ${book.category ? `<p><strong>श्रेणी:</strong> ${escapeHtml(book.category)}</p>` : ""}
      ${book.year ? `<p><strong>मूल प्रकाशन वर्ष:</strong> ${escapeHtml(String(book.year))}</p>` : ""}
      ${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(`${book.title} पुस्तक कवर`)}" width="320" height="480" loading="eager" />` : ""}
    </header>

    ${directAnswer ? `<section aria-labelledby="direct-answer"><h2 id="direct-answer">${escapeHtml(book.title)} का संक्षिप्त उत्तर</h2><p>${escapeHtml(directAnswer)}</p></section>` : ""}

    ${takeaways.length ? `<section aria-labelledby="quick-takeaways"><h2 id="quick-takeaways">${escapeHtml(book.title)} की 5 मुख्य बातें</h2><ul>${takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}

    ${overview ? `<section><h2>पुस्तक का परिचय और सारांश</h2><p>${escapeHtml(overview)}</p></section>` : ""}
    ${keyIdeas ? `<section><h2>मुख्य विचार</h2><p>${escapeHtml(keyIdeas)}</p></section>` : ""}
    ${application ? `<section><h2>जीवन में कैसे लागू करें</h2><p>${escapeHtml(application)}</p></section>` : ""}

    <section aria-labelledby="source-basis">
      <h2 id="source-basis">स्रोत और संपादकीय नोट</h2>
      <p>इस Booknomics पृष्ठ का स्रोत-कार्य <strong>${escapeHtml(book.title)}</strong>${book.author ? `, लेखक ${escapeHtml(book.author)}` : ""} है। Booknomics इसका स्वतंत्र हिंदी अध्ययन-सारांश प्रकाशित करता है; यह मूल लेखक या प्रकाशक का आधिकारिक पाठ नहीं है।</p>
      <p><a href="/about#editorial-process">Booknomics editorial process और corrections policy पढ़ें</a>.</p>
    </section>

    <section aria-labelledby="book-faq">
      <h2 id="book-faq">अक्सर पूछे जाने वाले प्रश्न</h2>
      ${faqEntries.map((entry) => `<h3>${escapeHtml(entry.question)}</h3><p>${escapeHtml(entry.answer)}</p>`).join("\n")}
    </section>

    <p><a href="/hindi">और हिंदी पुस्तक सारांश देखें</a> · <a href="/best-hindi-book-summaries">Best Hindi Book Summaries guide</a></p>
  </article>
</main>`;

  let html = prepareHead(template, { title, description, canonical, image, jsonLd: bookLd, noindex: isNoindex });
  html = html.replace('<div id="root"></div>', `<div id="root">${staticRoot}</div>`);
  writeRoute(`/books/${slug}`, html);
  if (isNoindex) writtenNoindex++; else writtenIndexable++;
}

console.log(`[prerender-seo] wrote /hindi + ${writtenIndexable} indexable + ${writtenNoindex} noindex Hindi snapshots with AEO/GEO answer and entity layers`);
