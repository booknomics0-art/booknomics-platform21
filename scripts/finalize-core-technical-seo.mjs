import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const LOGO = `${BASE}/og-default.svg`;

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function replaceMeta(html, attr, key, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function alternateTags(items) {
  return items.map(({ lang, href }) => `  <link rel="alternate" hreflang="${lang}" href="${escapeHtml(href)}" />`).join("\n");
}

function prepareStaticPage(template, { lang, title, description, canonical, root, jsonLd, alternates = [] }) {
  let html = template;
  html = html.replace(/<html\s+lang=["'][^"']+["']>/i, `<html lang="${lang}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, "name", "description", description);
  html = replaceMeta(html, "name", "author", "Booknomics Editorial");
  html = replaceMeta(html, "name", "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  html = replaceMeta(html, "name", "googlebot", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  html = replaceMeta(html, "property", "og:title", title);
  html = replaceMeta(html, "property", "og:description", description);
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "name", "twitter:title", title);
  html = replaceMeta(html, "name", "twitter:description", description);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  html = html.replace(/<link\s+rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>/gi, "");
  html = html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(
    "</head>",
    `  <link rel="canonical" href="${escapeHtml(canonical)}" />\n${alternateTags(alternates)}\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`,
  );
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  return html;
}

function writeRoute(pathname, html) {
  const clean = pathname.replace(/^\//, "");
  const file = clean ? resolve(DIST, clean, "index.html") : INDEX;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function patchOrganizationLogo(value) {
  if (Array.isArray(value)) {
    for (const item of value) patchOrganizationLogo(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Organization") && !value.logo) {
    value.logo = { "@type": "ImageObject", url: LOGO };
  }
  for (const child of Object.values(value)) patchOrganizationLogo(child);
}

function patchHub(pathname, alternates) {
  const file = resolve(DIST, pathname.replace(/^\//, ""), "index.html");
  let html = readFileSync(file, "utf8");
  html = html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, (full, raw) => {
    try {
      const data = JSON.parse(raw);
      patchOrganizationLogo(data);
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
    } catch {
      return full;
    }
  });
  html = html.replace(/<link\s+rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>/gi, "");
  html = html.replace("</head>", `${alternateTags(alternates)}\n</head>`);
  writeFileSync(file, html);
}

const template = readFileSync(INDEX, "utf8");

const organizationLd = {
  "@type": "Organization",
  "@id": `${BASE}/#organization`,
  name: "Booknomics",
  url: `${BASE}/`,
  logo: { "@type": "ImageObject", url: LOGO },
  description: "Booknomics publishes practical English and Hindi book summaries, key ideas, deeper analysis, and action-oriented reading guides.",
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

const sharedAlternates = [
  { lang: "en", href: `${BASE}/english` },
  { lang: "hi-IN", href: `${BASE}/hindi` },
  { lang: "x-default", href: `${BASE}/browse` },
];

{
  const canonical = `${BASE}/`;
  const title = "Booknomics — English & Hindi Book Summaries";
  const description = "Read practical English and Hindi book summaries with key ideas, deeper analysis, memorable lessons, and clear actions you can apply.";
  const root = `<main style="font-family:system-ui,-apple-system,sans-serif;max-width:1080px;margin:0 auto;padding:36px 20px;line-height:1.7">
    <header>
      <p>Booknomics</p>
      <h1>Book summaries that turn reading into action</h1>
      <p>Booknomics helps readers understand useful books faster without pretending that a summary replaces the original work. Explore English and Hindi study guides built around the book's central ideas, deeper analysis, practical lessons, and clear next steps.</p>
      <p><a href="/browse"><strong>Browse all book summaries</strong></a> · <a href="/english">English summaries</a> · <a href="/hindi">हिंदी पुस्तक सारांश</a></p>
    </header>
    <section>
      <h2>What you can learn on Booknomics</h2>
      <p>Each published guide is designed to answer the questions readers commonly have before, during, and after reading: What is this book about? Which ideas matter most? How do the arguments or characters fit together? What can a reader apply in real life? Booknomics combines concise answers with deeper sections so you can start quickly and continue when you need context.</p>
      <ul>
        <li><a href="/english">English book summaries</a> with key ideas, analysis, and practical applications.</li>
        <li><a href="/hindi">Hindi book summaries</a> covering literature, classics, self-development, history, and other reading interests.</li>
        <li><a href="/browse">A crawlable book library</a> for discovering titles, authors, languages, and categories.</li>
        <li><a href="/resources">Reading resources</a> for turning notes and summaries into a consistent learning habit.</li>
      </ul>
    </section>
    <section>
      <h2>Built for useful, transparent reading</h2>
      <p>Booknomics publishes independent study summaries and clearly separates them from original books and publishers. Pages are reviewed for book-specific usefulness, crawlability, canonical consistency, and structured metadata before they are treated as indexable. Our aim is not to compress every book into a few generic points, but to help readers decide what deserves deeper attention and remember what they learn.</p>
      <p>For methodology, corrections, and editorial standards, read the <a href="/about#editorial-process">editorial process</a>. For original research and citation-ready data, visit the <a href="/research">Booknomics research hub</a>.</p>
    </section>
  </main>`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationLd, websiteLd, {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { "@id": `${BASE}/#website` },
      publisher: { "@id": `${BASE}/#organization` },
      inLanguage: ["en", "hi"],
    }],
  };
  writeRoute("/", prepareStaticPage(template, {
    lang: "en",
    title,
    description,
    canonical,
    root,
    jsonLd,
    alternates: [
      { lang: "en", href: `${BASE}/english` },
      { lang: "hi-IN", href: `${BASE}/hindi` },
      { lang: "x-default", href: canonical },
    ],
  }));
}

{
  const canonical = `${BASE}/research`;
  const title = "Booknomics Research — Reading & Discovery Reports";
  const description = "Explore Booknomics research on reading discovery, book-summary search behavior, catalog trends, methodology, and citation-ready aggregate data.";
  const reportUrl = `${BASE}/research/reading-discovery-report-2026`;
  const root = `<main style="font-family:system-ui,-apple-system,sans-serif;max-width:920px;margin:0 auto;padding:36px 20px;line-height:1.7">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> › Research</nav>
    <header>
      <p>Booknomics Research</p>
      <h1>Reading and book-discovery research</h1>
      <p>${escapeHtml(description)}</p>
    </header>
    <section>
      <h2>Reading Discovery Report 2026</h2>
      <p>The Booknomics Reading Discovery Report 2026 is a citation-ready analysis of aggregate Booknomics catalog data and early Google Search discovery signals. It is designed for journalists, educators, reading communities, publishers, and researchers who need transparent context rather than unsupported market claims.</p>
      <p><a href="/research/reading-discovery-report-2026"><strong>Read the Reading Discovery Report 2026</strong></a></p>
    </section>
    <section>
      <h2>Methodology and limitations</h2>
      <p>Booknomics research uses aggregate platform and search-performance data and documents the period, source, and limitations of each report. Platform observations are not presented as a national reader survey unless the underlying methodology actually supports that conclusion. Where a report uses Search Console data, the report describes the available window and treats early visibility signals as directional evidence rather than population-level behavior.</p>
      <p>For the site's publishing and correction standards, see the <a href="/about#editorial-process">Booknomics editorial process</a>. To explore the underlying reading library, visit <a href="/browse">all book summaries</a>.</p>
    </section>
  </main>`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationLd, websiteLd, {
      "@type": "CollectionPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { "@id": `${BASE}/#website` },
      publisher: { "@id": `${BASE}/#organization` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: 1,
        itemListElement: [{
          "@type": "ListItem",
          position: 1,
          name: "Booknomics Reading Discovery Report 2026",
          url: reportUrl,
        }],
      },
    }],
  };
  writeRoute("/research", prepareStaticPage(template, {
    lang: "en",
    title,
    description,
    canonical,
    root,
    jsonLd,
    alternates: [{ lang: "x-default", href: canonical }],
  }));
}

patchHub("/browse", sharedAlternates);
patchHub("/english", sharedAlternates);
patchHub("/hindi", sharedAlternates);

for (const route of ["/", "/research", "/browse", "/english", "/hindi"]) {
  const file = route === "/" ? INDEX : resolve(DIST, route.replace(/^\//, ""), "index.html");
  const html = readFileSync(file, "utf8");
  if (!/<h1[\s>]/i.test(html)) throw new Error(`[finalize-core-technical-seo] ${route} missing H1`);
  if (!/<link\s+rel=["']canonical["']/i.test(html)) throw new Error(`[finalize-core-technical-seo] ${route} missing canonical`);
  if (!html.includes(LOGO)) throw new Error(`[finalize-core-technical-seo] ${route} missing Organization logo signal`);
}

console.log("[finalize-core-technical-seo] ✅ home + research hub + core hub schema/hreflang finalized");
