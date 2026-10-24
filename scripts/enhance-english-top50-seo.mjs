import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cloudflarePrerender, fetchCloudflarePrerenderBooks } from "./lib/cloudflare-prerender-catalog.mjs";

const BASE = "https://www.booknomics.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const PAGE_SIZE = 500;

if (!cloudflarePrerender && (!SUPABASE_URL || !SUPABASE_KEY)) {
  throw new Error("enhance-english-top50-seo: missing Supabase env");
}

const TARGET_SLUGS = new Set([
  "quit-annie-duke-summary",
  "a-random-walk-down-wall-street-burton-g-malkiel-summary",
  "playing-to-win-a-g-lafley-and-roger-l-martin-summary",
  "the-culture-code-daniel-coyle-summary",
  "daring-greatly-brene-brown-summary",
  "hooked-nir-eyal-with-ryan-hoover-summary",
  "difficult-conversations-douglas-stone-bruce-patton-and-sheila-heen-summary",
  "thanks-for-the-feedback-douglas-stone-and-sheila-heen-summary",
  "thinking-in-bets-annie-duke-summary",
  "the-millionaire-next-door-thomas-j-stanley-and-william-d-danko-summary",
  "dare-to-lead-brene-brown-summary",
  "drive-the-surprising-truth-about-what-motivates-us-daniel-h-pink-summary",
  "traction-get-a-grip-on-your-business-gino-wickman-summary",
  "grumpy-darling-alexandra-moody-summary",
  "the-slight-edge-jeff-olson-summary",
  "a-brief-history-of-time-stephen-hawking-summary",
  "great-by-choice-jim-collins-and-morten-t-hansen-summary",
  "made-to-stick-chip-heath-and-dan-heath-summary",
  "you-are-not-so-smart-david-mcraney-summary",
  "competing-against-luck-clayton-m-christensen-taddy-hall-karen-dillon-and-david-s-duncan-summary",
  "rework-jason-fried-and-david-heinemeier-hansson-summary",
  "turn-the-ship-around-l-david-marquet-summary",
  "the-black-swan-nassim-nicholas-taleb-summary",
  "the-first-90-days-michael-d-watkins-summary",
  "the-confidence-game-maria-konnikova-summary",
  "the-ride-of-a-lifetime-robert-iger-summary",
  "the-courage-to-be-disliked-ichiro-kishimi-and-fumitake-koga-summary",
  "the-coaching-habit-michael-bungay-stanier-summary",
  "sprint-jake-knapp-john-zeratsky-and-braden-kowitz-summary",
  "how-emotions-are-made-lisa-feldman-barrett-summary",
  "fooled-by-randomness-nassim-nicholas-taleb-summary",
  "flow-the-psychology-of-optimal-experience-mihaly-csikszentmihalyi-summary",
  "four-thousand-weeks-oliver-burkeman-summary",
  "skin-in-the-game-nassim-nicholas-taleb-summary",
  "the-checklist-manifesto-atul-gawande-summary",
  "the-great-ceo-within-matt-mochary-summary",
  "the-selfish-gene-richard-dawkins-summary",
  "thinking-fast-and-slow-daniel-kahneman-summary",
  "principles-life-and-work-ray-dalio-summary",
  "the-body-keeps-the-score-bessel-van-der-kolk-summary",
  "the-one-thing-gary-keller-and-jay-papasan-summary",
  "outliers-the-story-of-success-malcolm-gladwell-summary",
  "the-little-book-of-behavioral-investing-james-montier-summary",
  "range-why-generalists-triumph-in-a-specialized-world-david-epstein-summary",
  "lean-analytics-alistair-croll-and-benjamin-yoskovitz-summary",
  "the-gene-siddhartha-mukherjee-summary",
  "influence-the-psychology-of-persuasion-robert-b-cialdini-summary",
  "think-and-grow-rich-napoleon-hill-summary",
  "the-psychology-of-money-morgan-housel-summary",
  "why-we-sleep-matthew-walker-summary",
]);

if (TARGET_SLUGS.size !== 50) {
  throw new Error(`enhance-english-top50-seo: expected 50 unique slugs, got ${TARGET_SLUGS.size}`);
}

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

function extractIdeas(value = "", max = 3) {
  const text = String(value).replace(/\r/g, "");
  const pieces = text
    .split(/\n{1,}|(?<=[.!?])\s+/)
    .map((part) => stripMarkdown(part).replace(/^\d+[.)]\s*/, "").trim())
    .filter((part) => part.length >= 28 && part.length <= 260);
  const seen = new Set();
  const out = [];
  for (const part of pieces) {
    const sentence = part.split(/(?<=[.!?])\s+/)[0]?.trim() || part;
    const key = sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(sentence.length > 210 ? `${sentence.slice(0, 207).trim()}…` : sentence);
    if (out.length >= max) break;
  }
  return out;
}

async function api(path) {
  if (cloudflarePrerender) return fetchCloudflarePrerenderBooks(path);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`enhance-english-top50-seo: Supabase ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const englishBooks = [];
for (let offset = 0; ; offset += PAGE_SIZE) {
  const select = "id,slug,seo_slug,title,author,category,overview,key_ideas,meta_description,status,language";
  const page = await api(
    `books?select=${select}&language=eq.en&is_draft=eq.false&status=eq.published&order=title.asc&limit=${PAGE_SIZE}&offset=${offset}`,
  );
  englishBooks.push(...page);
  if (page.length < PAGE_SIZE) break;
}

const bySlug = new Map();
for (const book of englishBooks) {
  const slug = (book.seo_slug || book.slug || "").trim();
  if (slug) bySlug.set(slug, { ...book, canonicalSlug: slug });
}

const missing = [...TARGET_SLUGS].filter((slug) => !bySlug.has(slug));
if (missing.length) {
  throw new Error(`enhance-english-top50-seo: missing target books: ${missing.join(", ")}`);
}

function relatedBooks(book) {
  const result = [];
  const seen = new Set([book.id]);
  const sameAuthor = englishBooks.filter((candidate) => candidate.id !== book.id && candidate.author && candidate.author === book.author);
  const sameCategory = englishBooks.filter((candidate) => candidate.id !== book.id && candidate.category && candidate.category === book.category);
  for (const candidate of [...sameAuthor, ...sameCategory]) {
    if (seen.has(candidate.id)) continue;
    const slug = (candidate.seo_slug || candidate.slug || "").trim();
    if (!slug) continue;
    seen.add(candidate.id);
    result.push({ ...candidate, canonicalSlug: slug });
    if (result.length >= 4) break;
  }
  return result;
}

function insertBeforeClosingArticle(html, block) {
  const index = html.lastIndexOf("</article>");
  if (index === -1) throw new Error("enhance-english-top50-seo: page is missing </article>");
  return `${html.slice(0, index)}${block}${html.slice(index)}`;
}

let enhanced = 0;
let faqCount = 0;
let relatedLinkCount = 0;

for (const slug of TARGET_SLUGS) {
  const book = bySlug.get(slug);
  const file = resolve("dist", "books", slug, "index.html");
  let html = readFileSync(file, "utf8");

  if (/data-seo=["']english-top50["']/.test(html)) {
    throw new Error(`enhance-english-top50-seo: duplicate enhancement marker on ${slug}`);
  }
  if (/noindex/i.test(html.match(/<meta\s+name=["']robots["'][^>]*>/i)?.[0] || "")) {
    throw new Error(`enhance-english-top50-seo: target unexpectedly noindex: ${slug}`);
  }

  const canonical = `${BASE}/books/${slug}`;
  const author = stripMarkdown(book.author || "Booknomics Editorial");
  const overview = clamp(book.overview || book.meta_description || "", 430);
  const ideas = extractIdeas(book.key_ideas || book.overview || "", 3);
  const ideasAnswer = ideas.length
    ? ideas.join(" ")
    : clamp(book.key_ideas || book.overview || book.meta_description || "", 420);

  const faqs = [
    {
      question: `Who wrote ${book.title}?`,
      answer: `${book.title} was written by ${author}.`,
    },
    {
      question: `What is ${book.title} about?`,
      answer: overview || `${book.title} is covered on Booknomics with a concise summary, key ideas and analysis.`,
    },
    {
      question: `What are the key ideas in ${book.title}?`,
      answer: ideasAnswer || `The Booknomics guide highlights the book's central arguments, key takeaways and practical implications.`,
    },
    {
      question: `Is this the full text of ${book.title}?`,
      answer: `No. This Booknomics page is an independent study summary and analysis of ${book.title}; it is not the full text of the original book.`,
    },
  ];

  const related = relatedBooks(book);
  relatedLinkCount += related.length;

  const visibleFaq = `<section data-seo="english-top50"><h2>${escapeHtml(book.title)} FAQs</h2>${faqs.map((faq) => `<h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p>`).join("")}</section>`;
  const relatedHtml = related.length
    ? `<section data-seo="english-related"><h2>Related book summaries</h2><ul>${related.map((item) => `<li><a href="/books/${escapeHtml(item.canonicalSlug)}">${escapeHtml(item.title)}</a>${item.author ? ` — ${escapeHtml(item.author)}` : ""}</li>`).join("")}</ul></section>`
    : "";

  html = insertBeforeClosingArticle(html, `${visibleFaq}${relatedHtml}`);

  if (!/<link\s+rel=["']alternate["'][^>]*hreflang=["']en["']/i.test(html)) {
    html = html.replace("</head>", `  <link rel="alternate" hreflang="en" href="${escapeHtml(canonical)}" />\n</head>`);
  }

  const breadcrumbId = `${canonical}#breadcrumb-en`;
  const faqId = `${canonical}#faq`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Booknomics", item: `${BASE}/` },
          { "@type": "ListItem", position: 2, name: "English book summaries", item: `${BASE}/english` },
          { "@type": "ListItem", position: 3, name: book.title, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        inLanguage: "en",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  html = html.replace(
    "</head>",
    `  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`,
  );

  if (!html.includes(`href="${escapeHtml(canonical)}"`) && !html.includes(`href="${canonical}"`)) {
    throw new Error(`enhance-english-top50-seo: canonical/hreflang missing after enhancement: ${slug}`);
  }
  if (!html.includes('"@type":"FAQPage"')) {
    throw new Error(`enhance-english-top50-seo: FAQ schema missing after enhancement: ${slug}`);
  }

  writeFileSync(file, html);
  enhanced += 1;
  faqCount += faqs.length;
}

if (enhanced !== 50) {
  throw new Error(`enhance-english-top50-seo: expected 50 enhanced pages, got ${enhanced}`);
}

console.log(
  `[enhance-english-top50-seo] ✅ ${enhanced} pages · ${faqCount} visible/schema FAQs · ${relatedLinkCount} contextual related links`,
);
