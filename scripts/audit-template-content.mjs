// Read-only template-content audit for the published catalogue.
//
// Pulls every status=published book through the Cloudflare prerender catalog
// bridge (the same keyset pagination the production build uses), scores each
// book for template/boilerplate content, and writes a reviewable report:
//
//   out/template-audit/template-audit-<date>.csv   per-book scores + verdict
//   out/template-audit/boilerplate-fragments.csv   the shared fragments themselves
//   out/template-audit/summary.json                totals, distributions, thresholds
//
// Signals (all deterministic, no model calls):
//   1. Signature phrases — curated template markers (EN + Hindi) seen in the
//      live catalogue and in scripts/guard-aeo-prerender.mjs.
//   2. Shared sentences  — normalized sentences appearing verbatim in at
//      least MIN_SHARED_SENTENCES distinct books.
//   3. Shared paragraphs — normalized 120+ char blocks appearing verbatim in
//      at least MIN_SHARED_PARAGRAPHS distinct books.
//   4. Overview groups   — books with byte-identical normalized overviews.
//
// Usage (run on a machine that can reach the public site; read-only, no
// credentials needed):
//
//   PRERENDER_CATALOG_API=https://www.booknomics.com node scripts/audit-template-content.mjs
//
// Optional flags: --min-sentences N (default 5) --min-paragraphs N (default 3)
//                 --noindex-min-score N (default 20) --review-min-score N (default 8)
//                 --out DIR (default out/template-audit)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_API = "https://www.booknomics.com";
const PAGE_SIZE = 50;

// Curated template markers. EN phrases were observed in live catalog samples
// (e.g. the 2026-10 batch overviews); HI phrases mirror the low-signal list
// in scripts/guard-aeo-prerender.mjs. Matching is case-insensitive substring
// on normalized text, so a hit means the exact phrase (not a paraphrase).
export const SIGNATURE_PHRASES = [
  // English batch template
  "this booknomics summary explains",
  "instead of treating them as isolated labels",
  "written as original analysis rather than a reproduction",
  "avoids invented quotations, unsupported superlatives",
  "separates the author's recommendation from evidence",
  "each principle is treated as a testable lens",
  "reader usefulness, specificity, and intellectual independence",
  "key anchors include",
  "centered on this problem",
  // Shared low-signal EN phrases (AEO guard list)
  "particular way of seeing",
  "modern application",
  "hidden assumption",
  // Hindi template phrases (AEO guard list)
  "आत्म-चिंतन का महत्व",
  "रिश्तों की कीमत",
  "सामाजिक जिम्मेदारी",
  "नैतिक मूल्यों का पालन",
  "परिवर्तन को स्वीकार करना",
  "सबसे महत्वपूर्ण कृतियों में से एक",
  "हिंदी साहित्य की एक अनमोल धरोहर",
  "कहानी की शुरुआत होती है एक साधारण से दृश्य से",
  "हर पात्र, हर घटना, हर संवाद",
  "एक अलग ही दुनिया में ले जाती है",
  "अपने समय के सामाजिक, सांस्कृतिक और राजनीतिक परिवेश",
  "अपने अनुभव और अवलोकन के माध्यम से प्रस्तुत किया है",
];

// ---------------------------------------------------------------------------
// Text normalization + segmentation (pure, exported for unit tests)
// ---------------------------------------------------------------------------

/** Lowercase, drop markdown/HTML noise, collapse whitespace. Newlines kept. */
export function normalizeText(text = "") {
  return String(text ?? "")
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]{1,200}>/g, " ")
    .replace(/[#>*`~]{1,}/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\|/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Split normalized text into candidate sentences (48+ chars, 6+ words). */
export function splitSentences(normalizedText) {
  const parts = String(normalizedText).split(/(?<=[.!?।])\s+|\n+/);
  const out = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (s.length < 48) continue;
    if (s.split(/\s+/).length < 6) continue;
    out.push(s);
  }
  return out;
}

/** Split raw text into candidate paragraphs (120+ chars after normalization). */
export function splitParagraphs(rawText) {
  const blocks = String(rawText ?? "").split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const p = normalizeText(block).replace(/\s+/g, " ").trim();
    if (p.length >= 120) out.push(p);
  }
  return out;
}

const bookFields = (book) =>
  [book.overview, book.deep_summary, book.key_ideas, book.deep_analysis, book.daily_application]
    .map((value) => String(value || ""))
    .join("\n\n");

// ---------------------------------------------------------------------------
// Audit engine (pure)
// ---------------------------------------------------------------------------

/**
 * Score every book. `books` rows need at least: id, slug, seo_slug, title,
 * author, category, language, overview, deep_summary, key_ideas,
 * deep_analysis, daily_application.
 */
export function auditBooks(books, options = {}) {
  const minSentences = options.minSharedSentences ?? 5;
  const minParagraphs = options.minSharedParagraphs ?? 3;
  const noindexMinScore = options.noindexMinScore ?? 20;
  const reviewMinScore = options.reviewMinScore ?? 8;

  // Pass 1: collect per-book unique fragments + global frequency (distinct books).
  const sentenceBooks = new Map(); // sentence -> Set(bookId)
  const paragraphBooks = new Map(); // paragraph -> Set(bookId)
  const overviewGroups = new Map(); // normalized overview -> [bookId]
  const perBook = new Map(); // bookId -> {sentences:Set, paragraphs:Set, sigs:Set}

  for (const book of books) {
    const normalized = normalizeText(bookFields(book));
    const sentences = new Set(splitSentences(normalized));
    const paragraphs = new Set(splitParagraphs(bookFields(book)));
    const hits = new Set();
    for (const phrase of SIGNATURE_PHRASES) {
      if (normalized.includes(phrase)) hits.add(phrase);
    }
    perBook.set(book.id, { sentences, paragraphs, sigs: hits });

    for (const s of sentences) {
      let set = sentenceBooks.get(s);
      if (!set) { set = new Set(); sentenceBooks.set(s, set); }
      set.add(book.id);
    }
    for (const p of paragraphs) {
      let set = paragraphBooks.get(p);
      if (!set) { set = new Set(); paragraphBooks.set(p, set); }
      set.add(book.id);
    }
    const fp = normalizeText(String(book.overview || "")).replace(/\s+/g, " ");
    if (fp.length >= 48) {
      const group = overviewGroups.get(fp) || [];
      group.push(book.id);
      overviewGroups.set(fp, group);
    }
  }

  const isSharedSentence = (s) => (sentenceBooks.get(s)?.size || 0) >= minSentences;
  const isSharedParagraph = (p) => (paragraphBooks.get(p)?.size || 0) >= minParagraphs;

  // Pass 2: score books.
  const results = [];
  for (const book of books) {
    const info = perBook.get(book.id);
    let sharedSentences = 0;
    for (const s of info.sentences) if (isSharedSentence(s)) sharedSentences++;
    let sharedParagraphs = 0;
    for (const p of info.paragraphs) if (isSharedParagraph(p)) sharedParagraphs++;
    const signatureHits = info.sigs.size;
    const overviewGroupSize = (overviewGroups.get(
      normalizeText(String(book.overview || "")).replace(/\s+/g, " "),
    ) || []).length;

    const score =
      sharedParagraphs * 10 +
      sharedSentences * 4 +
      signatureHits * 6 +
      (overviewGroupSize >= 3 ? 5 + Math.min(overviewGroupSize, 10) : 0);

    let recommendation = "keep";
    if (
      score >= noindexMinScore ||
      sharedParagraphs >= 2 ||
      (signatureHits >= 3 && sharedSentences >= 1)
    ) {
      recommendation = "noindex";
    } else if (score >= reviewMinScore) {
      recommendation = "review";
    }

    results.push({
      id: book.id,
      slug: book.slug,
      seo_slug: book.seo_slug || book.slug,
      title: book.title,
      author: book.author,
      language: book.language,
      category: book.category,
      score,
      recommendation,
      shared_paragraphs: sharedParagraphs,
      shared_sentences: sharedSentences,
      signature_hits: signatureHits,
      signature_matchers: [...info.sigs].join(" | "),
      overview_group_size: overviewGroupSize,
    });
  }
  results.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));

  // Shared fragments worth human review (the template itself).
  const fragments = [];
  for (const [text, set] of sentenceBooks) {
    if (set.size >= minSentences) fragments.push({ type: "sentence", books: set.size, text: text.slice(0, 200) });
  }
  for (const [text, set] of paragraphBooks) {
    if (set.size >= minParagraphs) fragments.push({ type: "paragraph", books: set.size, text: text.slice(0, 200) });
  }
  fragments.sort((a, b) => b.books - a.books || b.text.length - a.text.length);

  const byRecommendation = { noindex: 0, review: 0, keep: 0 };
  const byLanguage = {};
  for (const row of results) {
    byRecommendation[row.recommendation] += 1;
    byLanguage[row.language] = (byLanguage[row.language] || 0) + 1;
  }

  return {
    results,
    fragments,
    summary: {
      generated_at: new Date().toISOString(),
      total_books: results.length,
      by_recommendation: byRecommendation,
      by_language: byLanguage,
      thresholds: { minSharedSentences: minSentences, minSharedParagraphs: minParagraphs, noindexMinScore, reviewMinScore },
      top_fragments: fragments.slice(0, 25).map((f) => ({ ...f, books: f.books })),
    },
  };
}

// ---------------------------------------------------------------------------
// CSV helpers (exported for unit tests)
// ---------------------------------------------------------------------------

const csvCell = (value) => {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers, rows) {
  return [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n");
}

// ---------------------------------------------------------------------------
// Catalog fetch (production keyset bridge + transient retry) — live only
// ---------------------------------------------------------------------------

const AUDIT_FIELDS = "id,slug,seo_slug,title,author,category,language,tagline,overview,deep_summary,key_ideas,deep_analysis,daily_application,meta_title,meta_description";

async function fetchCatalog(apiBase) {
  process.env.PRERENDER_CATALOG_API = apiBase;
  const { fetchCloudflarePrerenderBooks, cloudflarePrerender } = await import("./lib/cloudflare-prerender-catalog.mjs");
  if (!cloudflarePrerender) throw new Error("audit-template-content: VITE_DATA_BACKEND must be cloudflare");
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const api = async (path) => {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetchCloudflarePrerenderBooks(path);
      } catch (err) {
        lastError = err;
        const message = String(err?.message || err);
        const retryable = /^Cloudflare prerender catalog HTTP (429|5\d\d)/.test(message) ||
          /TimeoutError|AbortError|fetch failed|network error/i.test(message);
        if (!retryable || attempt === 2) throw err;
        console.warn(`[audit-template-content] transient catalog failure; retry ${attempt + 1}/2 (${message.slice(0, 120)})`);
        await pause(1500 * (attempt + 1));
      }
    }
    throw lastError;
  };
  const books = [];
  let lastId = "";
  for (;;) {
    const page = await api(
      `books?select=${AUDIT_FIELDS}&is_draft=eq.false&status=eq.published&order=id&limit=${PAGE_SIZE}` +
      (lastId ? `&id=gt.${lastId}` : "")
    );
    if (!Array.isArray(page)) throw new Error("audit-template-content: catalog response is not an array");
    books.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1]?.id;
    if (!lastId) throw new Error("audit-template-content: missing ID in paginated catalog");
    if (books.length % 500 < PAGE_SIZE) console.log(`[audit-template-content] fetched ${books.length} books...`);
  }
  return books;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = argv.indexOf(name);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const apiBase = (flag("--api", process.env.PRERENDER_CATALOG_API || DEFAULT_API)).replace(/\/$/, "");
  const outDir = resolve(flag("--out", "out/template-audit"));
  const options = {
    minSharedSentences: Number(flag("--min-sentences", "5")),
    minSharedParagraphs: Number(flag("--min-paragraphs", "3")),
    noindexMinScore: Number(flag("--noindex-min-score", "20")),
    reviewMinScore: Number(flag("--review-min-score", "8")),
  };

  console.log(`[audit-template-content] fetching published catalogue from ${apiBase} ...`);
  const books = await fetchCatalog(apiBase);
  console.log(`[audit-template-content] ${books.length} published books fetched; scoring...`);

  const { results, fragments, summary } = auditBooks(books, options);

  mkdirSync(outDir, { recursive: true });
  const date = summary.generated_at.slice(0, 10);
  const csvPath = resolve(outDir, `template-audit-${date}.csv`);
  const csvHeaders = [
    "id", "slug", "seo_slug", "title", "author", "language", "category",
    "score", "recommendation", "shared_paragraphs", "shared_sentences",
    "signature_hits", "signature_matchers", "overview_group_size",
  ];
  writeFileSync(csvPath, toCsv(csvHeaders, results));
  writeFileSync(resolve(outDir, "boilerplate-fragments.csv"),
    toCsv(["type", "books", "text"], fragments.slice(0, 2000).map((f) => ({ type: f.type, books: f.books, text: f.text }))));
  writeFileSync(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n" + "=".repeat(72));
  console.log(`TEMPLATE AUDIT — ${summary.total_books} published books`);
  console.log("=".repeat(72));
  console.log(`  noindex candidates: ${summary.by_recommendation.noindex}`);
  console.log(`  review:             ${summary.by_recommendation.review}`);
  console.log(`  keep:               ${summary.by_recommendation.keep}`);
  console.log(`  by language:        ${Object.entries(summary.by_language).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  console.log(`\n  top shared fragments:`);
  for (const f of summary.top_fragments.slice(0, 8)) {
    console.log(`    [${f.type}, ${f.books} books] ${f.text.slice(0, 110)}`);
  }
  console.log(`\n  top noindex candidates:`);
  for (const row of results.filter((r) => r.recommendation === "noindex").slice(0, 15)) {
    console.log(`    ${row.score.toString().padStart(3)}  ${row.language}  ${row.slug}  (${row.shared_paragraphs}¶ ${row.shared_sentences}s ${row.signature_hits}sig)`);
  }
  console.log(`\n  CSV:        ${csvPath}`);
  console.log(`  fragments:  ${resolve(outDir, "boilerplate-fragments.csv")}`);
  console.log(`  summary:    ${resolve(outDir, "summary.json")}`);
  console.log(`\nNext step (after you review the CSV):`);
  console.log(`  BN_ADMIN_COOKIE=<bn_session cookie> node scripts/apply-noindex-list.mjs --csv ${csvPath} --recommendation noindex   # dry-run`);
  console.log(`  add --apply to actually set status=published_noindex (restore with --restore).`);
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isDirectRun) {
  main().catch((err) => {
    console.error("[audit-template-content] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
