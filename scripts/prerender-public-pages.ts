import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { BLOG_POSTS } from "../src/content/blog.ts";

const DIST = resolve("dist");
const INDEX = resolve(DIST, "index.html");
const BASE = "https://www.booknomics.com";
const ORG_ID = `${BASE}/#organization`;
const WEBSITE_ID = `${BASE}/#website`;
const template = readFileSync(INDEX, "utf8");

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const inlineMarkdown = (value = "") => {
  let text = escapeHtml(value);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  return text;
};

function markdownToHtml(markdown = "") {
  const lines = String(markdown).replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inlineMarkdown(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (list !== "ul") { closeList(); list = "ul"; out.push("<ul>"); }
      out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      if (list !== "ol") { closeList(); list = "ol"; out.push("<ol>"); }
      out.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph(); closeList();
      out.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph(); closeList();
  return out.join("\n");
}

function replaceMeta(html: string, attr: "name" | "property", key: string, value: string) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  const pattern = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function prepareHead(html: string, opts: { lang?: string; title: string; description: string; canonical: string; type?: string; jsonLd?: unknown }) {
  const { lang = "en", title, description, canonical, type = "website", jsonLd } = opts;
  let out = html.replace(/<html\s+lang=["'][^"']+["']>/i, `<html lang="${lang}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = replaceMeta(out, "name", "description", description);
  out = replaceMeta(out, "name", "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  out = replaceMeta(out, "name", "googlebot", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  out = replaceMeta(out, "property", "og:type", type);
  out = replaceMeta(out, "property", "og:title", title);
  out = replaceMeta(out, "property", "og:description", description);
  out = replaceMeta(out, "property", "og:url", canonical);
  out = replaceMeta(out, "name", "twitter:title", title);
  out = replaceMeta(out, "name", "twitter:description", description);
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  const ld = jsonLd ? `  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n` : "";
  out = out.replace("</head>", `  <link rel="canonical" href="${escapeHtml(canonical)}" />\n${ld}</head>`);
  return out;
}

function writeRoute(pathname: string, html: string) {
  const file = resolve(DIST, pathname.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function renderLinks(items: Array<{ href: string; label: string }>) {
  return `<ul>${items.map((x) => `<li><a href="${escapeHtml(x.href)}">${escapeHtml(x.label)}</a></li>`).join("")}</ul>`;
}

const organizationLd = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Booknomics",
  url: `${BASE}/`,
  description: "Booknomics is a bilingual book summaries platform for practical insights, deeper analysis, reflection, and action in English and Hindi.",
  knowsLanguage: ["en", "hi"],
  publishingPrinciples: `${BASE}/about#editorial-process`,
};
const websiteLd = { "@type": "WebSite", "@id": WEBSITE_ID, url: `${BASE}/`, name: "Booknomics", publisher: { "@id": ORG_ID }, inLanguage: ["en", "hi"] };

const staticPages = [
  {
    path: "/about", lang: "en",
    title: "About Booknomics — Hindi & English Book Summaries and Editorial Standards",
    description: "Learn how Booknomics creates structured Hindi and English book summaries, separates source works from editorial guides, and applies quality and indexing checks.",
    h1: "About Booknomics",
    body: `<p>Booknomics is a bilingual learning platform built to help readers understand important books and turn ideas into action. We publish structured summaries in English and Hindi with key ideas, deeper analysis, practical application, reflection prompts, and links back to the original work.</p>
      <h2 id="editorial-process">Editorial process</h2><p>Our workflow starts with correct book identification and source context, then separates the author's claims from Booknomics editorial explanation. Public pages are checked for useful book-specific content, canonical URL consistency, metadata quality, internal links, and indexing readiness. Pages that are incomplete or low-confidence can remain outside search indexing until they improve.</p>
      <h2>What we publish</h2><p>Booknomics covers English non-fiction, Hindi literature, spiritual texts, personal development, psychology, business, finance, productivity and other reading categories. A summary is an independent study guide, not a replacement for the original book.</p>
      <h2>Corrections and trust</h2><p>We aim to make attribution clear, avoid presenting editorial interpretation as the author's exact words, and correct material errors when they are found. Readers can contact the editorial team with feedback, copyright concerns, or correction requests.</p>
      ${renderLinks([{href:"/english",label:"English book summaries"},{href:"/hindi",label:"Hindi book summaries"},{href:"/press",label:"Press and citation information"},{href:"/contact",label:"Contact Booknomics"}])}`,
  },
  {
    path: "/contact", lang: "en",
    title: "Contact Booknomics — Get in touch with our editorial team",
    description: "Questions, feedback, partnership ideas, or copyright concerns? Reach the Booknomics editorial team. We reply within 48 hours.",
    h1: "Get in touch",
    body: `<p>Feedback, partnership ideas, or a copyright question? Contact the Booknomics editorial team. General enquiries can be sent to <a href="mailto:hello@booknomics.com">hello@booknomics.com</a>; copyright and DMCA concerns can be sent to <a href="mailto:legal@booknomics.com">legal@booknomics.com</a>.</p><h2>What to contact us about</h2><ul><li>Editorial feedback and corrections</li><li>Press, partnership and interview requests</li><li>Copyright or DMCA concerns</li><li>Product and accessibility feedback</li></ul>`,
  },
  {
    path: "/press", lang: "en",
    title: "Press & Media — Booknomics",
    description: "Learn about Booknomics, a bilingual English and Hindi book summaries platform with practical insights, action plans, and reading resources.",
    h1: "Press & Media",
    body: `<p>Booknomics turns important books into practical insights, deep analysis, and action plans for English and Hindi readers. Journalists, educators, creators, and researchers may cite and link to public Booknomics pages.</p><h2>Suggested description</h2><blockquote>Booknomics is a bilingual book summaries platform that turns important books into practical insights, action plans, and reflection prompts for English and Hindi readers.</blockquote><h2>What Booknomics offers</h2><ul><li>English and Hindi book summaries</li><li>Key insights and deeper analysis</li><li>Practical action plans and reflection prompts</li><li>Reading trackers and free educational resources</li></ul>${renderLinks([{href:"/contact",label:"Media enquiries"},{href:"/resources",label:"Free reading resources"},{href:"/english",label:"English library"},{href:"/hindi",label:"Hindi library"}])}`,
  },
  {
    path: "/resources", lang: "en",
    title: "Free Reading Resources by Booknomics",
    description: "Free reading tools from Booknomics: a 7-day action tracker, a book summary template, and practical guides for English and Hindi readers.",
    h1: "Free Reading Resources by Booknomics",
    body: `<p>Reading more is easy; retaining and applying what you read is harder. These free tools help readers turn books into notes, decisions and repeatable actions.</p><h2>Tools and guides</h2>${renderLinks([{href:"/resources/7-day-reading-action-tracker",label:"Free 7-Day Reading Action Tracker"},{href:"/resources/book-summary-template",label:"Free Book Summary Template"},{href:"/resources/best-book-summary-websites",label:"Best Book Summary Websites and Apps"},{href:"/resources/best-hindi-book-summaries-guide",label:"Best Hindi Book Summaries: Complete Guide"}])}<h2>Where to read next</h2>${renderLinks([{href:"/english",label:"English book summaries"},{href:"/hindi",label:"Hindi library"},{href:"/blog",label:"Booknomics blog"},{href:"/browse",label:"Browse the full library"}])}`,
  },
  {
    path: "/resources/7-day-reading-action-tracker", lang: "en",
    title: "Free 7-Day Reading Action Tracker (Printable) | Booknomics",
    description: "A free 7-day reading action tracker that turns any book into seven small daily actions, with prompts, scoring and a weekly review. No sign-up needed.",
    h1: "Free 7-Day Reading Action Tracker",
    body: `<p>Finishing a book feels like progress, but change comes from application. This tracker converts one book into seven days of specific, small actions.</p><h2>The seven-day sequence</h2><ol><li>Name the one most useful idea in your own words.</li><li>Pick the smallest action that expresses it.</li><li>Attach the action to an existing routine.</li><li>Remove one obstacle before it appears.</li><li>Do a deliberately small version to defeat perfectionism.</li><li>Tell one person and create accountability.</li><li>Review the week and decide whether to keep, change or drop the action.</li></ol><h2>Weekly review</h2><p>Record observable evidence rather than vague impressions, then decide what is small enough to survive an ordinary week.</p>${renderLinks([{href:"/resources/book-summary-template",label:"Book summary template"},{href:"/resources",label:"All free resources"}])}`,
  },
  {
    path: "/resources/book-summary-template", lang: "en",
    title: "Free Book Summary Template (8 Sections) | Booknomics",
    description: "A free book summary template used by Booknomics: eight sections covering core idea, lessons, counter-arguments, quotes and a seven-day action plan.",
    h1: "Free Book Summary Template",
    body: `<p>Most book notes become unusable because they have highlights without structure. This template gives each book the same retrievable shape.</p><h2>The eight sections</h2><ol><li>Book facts</li><li>The one-sentence core idea</li><li>Five lessons that changed something</li><li>The argument in the author's terms</li><li>Where you disagree</li><li>Quotes worth keeping</li><li>Actions for the next seven days</li><li>Who should read the full book</li></ol><h2>Rules that keep summaries useful</h2><p>Write in your own words, keep one evolving summary per book, and finish with a concrete action or an honest note that no action is needed.</p>${renderLinks([{href:"/resources/7-day-reading-action-tracker",label:"7-day action tracker"},{href:"/resources",label:"All free resources"}])}`,
  },
  {
    path: "/resources/best-book-summary-websites", lang: "en",
    title: "Best Book Summary Websites & Apps: How to Choose (2026) | Booknomics",
    description: "A practical guide to choosing among book summary websites and apps — the six criteria that matter, when summaries help, and when to read the full book instead.",
    h1: "Best Book Summary Websites and Apps: How to Choose",
    body: `<p>Judge a summary platform by whether it helps you understand, remember and apply a book rather than by catalogue size alone.</p><h2>Six criteria that matter</h2><ol><li>Depth over volume</li><li>An application layer</li><li>Honest treatment of the original</li><li>Language coverage that is native rather than machine-translated</li><li>Audio and offline usefulness</li><li>A transparent free tier</li></ol><h2>When summaries help</h2><p>Summaries are useful for deciding what to read, recalling a book you already finished, and revisiting single-idea books. They are weaker substitutes for memoir, narrative history, literary fiction and technical works where the detail is the value.</p>${renderLinks([{href:"/resources/book-summary-template",label:"Book summary template"},{href:"/english",label:"English book summaries"},{href:"/resources",label:"All free resources"}])}`,
  },
  {
    path: "/resources/best-hindi-book-summaries-guide", lang: "hi",
    title: "हिंदी पुस्तक सारांश: पूरी गाइड (2026) | Booknomics",
    description: "हिंदी में किताबों के सारांश पढ़ने की पूरी गाइड — कहाँ से शुरू करें, कौन-सी श्रेणी चुनें, 90 दिन की योजना और हर सारांश को जीवन में कैसे लागू करें।",
    h1: "हिंदी पुस्तक सारांश: पूरी गाइड",
    body: `<p>हिंदी पाठकों के लिए सबसे बड़ी समस्या किताबों की कमी नहीं, दिशा की कमी है। यह गाइड बताती है कि कहाँ से शुरू करें, किस क्रम में पढ़ें और पढ़ी हुई बात को जीवन में कैसे उतारें।</p><h2>90 दिन की पढ़ने की योजना</h2><ol><li>पहले 30 दिन: एक व्यावहारिक किताब और एक क्लासिक साथ पढ़ें।</li><li>31–60 दिन: आदत और उत्पादकता पर ध्यान दें और एक क्रिया सात दिन दोहराएँ।</li><li>61–90 दिन: वित्त और मनोविज्ञान के सारांश पढ़ें।</li><li>90 दिन के बाद: दर्शन और अध्यात्म को धीरे और दोबारा पढ़ें।</li></ol><h2>सारांश को जीवन में उतारें</h2><p>हर सारांश से एक क्रिया चुनें, उसे मौजूदा आदत से जोड़ें, सात दिन लिखित रूप से ट्रैक करें और सातवें दिन तय करें कि उसे जारी रखना है, छोटा करना है या छोड़ना है।</p>${renderLinks([{href:"/hindi",label:"हिंदी लाइब्रेरी"},{href:"/best-hindi-book-summaries",label:"सर्वश्रेष्ठ हिंदी सारांश"},{href:"/resources",label:"सभी मुफ़्त संसाधन"}])}`,
  },
  {
    path: "/privacy", lang: "en",
    title: "Privacy Policy | Booknomics",
    description: "Booknomics Privacy Policy — what data we collect, how we use it, our use of cookies and Google AdSense advertising, and your GDPR & CCPA rights.",
    h1: "Privacy Policy",
    body: `<p>Booknomics collects account information, reading activity, community activity, referral and subscription status, and limited technical analytics needed to operate and improve the service. We do not sell personal data.</p><h2>Your rights</h2><p>Users can request access, correction, export or deletion of personal data and can withdraw consent for non-essential communications. Privacy requests can be sent to <a href="mailto:privacy@booknomics.com">privacy@booknomics.com</a>.</p><h2>Cookies, analytics and advertising</h2><p>Booknomics uses essential and preference cookies, analytics, and Google AdSense advertising technologies. Users can control cookies in their browser and use Google's advertising settings for personalised-ad controls.</p><h2>Security</h2><p>Traffic is protected with HTTPS/TLS and the service uses managed infrastructure and access controls intended to limit data access.</p>`,
  },
  {
    path: "/terms", lang: "en",
    title: "Terms of Service | Booknomics",
    description: "The terms governing your use of Booknomics — user conduct, intellectual property, account responsibility, subscriptions, and liability.",
    h1: "Terms of Service",
    body: `<p>These terms govern use of Booknomics. By creating an account or using the service, users agree to follow community rules and use Booknomics content under the permissions described here.</p><h2>User conduct</h2><p>Community contributions should remain respectful, honest, on-topic, and free of harassment, impersonation and spam.</p><h2>Intellectual property</h2><p>Booknomics summaries, analysis, action plans, learning paths and editorial commentary are original Booknomics works. Book titles, author names and publisher-owned assets remain the property of their respective rights holders.</p><h2>Accounts and subscriptions</h2><p>Users are responsible for account security. Paid plans continue through the paid period after cancellation and are subject to the payment and refund terms stated on the service.</p>`,
  },
];

for (const page of staticPages) {
  const canonical = `${BASE}${page.path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationLd, websiteLd, {
      "@type": "WebPage", url: canonical, name: page.h1, description: page.description,
      inLanguage: page.lang === "hi" ? "hi-IN" : "en", isPartOf: { "@id": WEBSITE_ID }, publisher: { "@id": ORG_ID },
    }],
  };
  let html = prepareHead(template, { lang: page.lang, title: page.title, description: page.description, canonical, jsonLd });
  const root = `<main lang="${page.lang}" style="font-family:system-ui,-apple-system,sans-serif;max-width:980px;margin:0 auto;padding:32px 20px;line-height:1.68"><nav aria-label="Breadcrumb"><a href="/">Home</a> › ${escapeHtml(page.h1)}</nav><article><h1>${escapeHtml(page.h1)}</h1>${page.body}</article></main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  writeRoute(page.path, html);
}

const blogIndexCanonical = `${BASE}/blog`;
const blogIndexTitle = "Booknomics Blog — Practical articles on habits, mindset & money";
const blogIndexDescription = "Long-form, actionable articles that turn the best non-fiction books into routines, frameworks and decisions you can use this week.";
const blogItems = BLOG_POSTS.map((post, i) => ({ "@type": "ListItem", position: i + 1, name: post.title, url: `${BASE}/blog/${post.slug}` }));
let blogIndex = prepareHead(template, {
  title: blogIndexTitle, description: blogIndexDescription, canonical: blogIndexCanonical,
  jsonLd: { "@context": "https://schema.org", "@graph": [organizationLd, websiteLd, { "@type": "CollectionPage", url: blogIndexCanonical, name: "Booknomics Blog", description: blogIndexDescription, mainEntity: { "@type": "ItemList", itemListElement: blogItems } }] },
});
const blogRoot = `<main style="font-family:system-ui,-apple-system,sans-serif;max-width:980px;margin:0 auto;padding:32px 20px;line-height:1.68"><nav><a href="/">Home</a> › Blog</nav><h1>Booknomics Blog</h1><p>${escapeHtml(blogIndexDescription)}</p><section><h2>Latest articles</h2><ul>${BLOG_POSTS.map((post) => `<li><a href="/blog/${escapeHtml(post.slug)}"><strong>${escapeHtml(post.title)}</strong></a><br><span>${escapeHtml(post.description)}</span></li>`).join("\n")}</ul></section></main>`;
blogIndex = blogIndex.replace('<div id="root"></div>', `<div id="root">${blogRoot}</div>`);
writeRoute("/blog", blogIndex);

for (const post of BLOG_POSTS) {
  const canonical = `${BASE}/blog/${post.slug}`;
  const title = `${post.title} | Booknomics`;
  const articleLd = {
    "@context": "https://schema.org",
    "@graph": [organizationLd, websiteLd, {
      "@type": "BlogPosting", headline: post.title, description: post.description,
      datePublished: post.publishedAt, dateModified: post.publishedAt,
      author: { "@type": "Organization", name: post.author, url: BASE },
      publisher: { "@id": ORG_ID }, mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      keywords: post.tags, articleSection: post.category,
    }],
  };
  let html = prepareHead(template, { title, description: post.description, canonical, type: "article", jsonLd: articleLd });
  const root = `<main style="font-family:system-ui,-apple-system,sans-serif;max-width:780px;margin:0 auto;padding:32px 20px;line-height:1.72"><nav><a href="/">Home</a> › <a href="/blog">Blog</a> › ${escapeHtml(post.title)}</nav><article><header><p>${escapeHtml(post.category)}</p><h1>${escapeHtml(post.title)}</h1><p>By ${escapeHtml(post.author)} · <time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(post.publishedAt)}</time> · ${escapeHtml(String(post.readingTime))} min read</p><p>${escapeHtml(post.description)}</p></header>${markdownToHtml(post.body)}<footer><h2>Keep reading</h2>${renderLinks(BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3).map((p) => ({ href: `/blog/${p.slug}`, label: p.title })))}</footer></article></main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${root}</div>`);
  writeRoute(`/blog/${post.slug}`, html);
}

console.log(`[prerender-public-pages] ✅ wrote ${staticPages.length} public authority/resource pages + blog index + ${BLOG_POSTS.length} blog posts`);
