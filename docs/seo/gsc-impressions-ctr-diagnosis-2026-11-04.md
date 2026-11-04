# Booknomics — GSC Impressions & CTR Diagnosis (04 Nov 2026)

Scope: full audit of why impressions/CTR are low, based on the GSC screenshots
(04 Nov 2026), the production code, live site samples, and the internal audit docs
already in this repo.

---

## 1. Current GSC snapshot

| Metric | 24 hours | 3 months |
|---|---:|---:|
| Total impressions | 309 | 10,100 |
| Total clicks | 4 | 133 |
| Average CTR | 1.3% | 1.3% |
| Average position | 8.9 | 12.9 |
| Indexed pages | **1,060** | — |
| Published pages in DB | **5,027** | — |

Derived numbers that matter:

- **Only ~21% of published pages are indexed** (1,060 / 5,027). Google is
  deliberately leaving ~4,000 pages out of the index.
- **~0.1 impressions per page per day** (10,100 ÷ 1,060 ÷ 90). Even indexed
  pages get almost no distribution.
- Top queries are all **1–2 impressions, 0 clicks** — an extreme long tail.
- Good news: the "Previously 26 / 5 / 4 / 3 / 2" arrows on the Pages report show
  pages climbing, and the 24h average position (8.9) is better than the 3-month
  average (12.9). The trend is up, but the ceiling is very low.

**Bottom line: CTR is not the main problem. Impressions (visibility) are.**
1.3% CTR at position 8.9–12.9 is roughly average for those positions (position
9–13 typically earns 1–2%; position 1–3 earns 20–30%). If positions move to 3–5,
CTR moves up on its own. The site is barely being *shown*; it is not being shown
*badly*.

---

## 2. Root causes (ranked by impact)

### 2.1 Template/scaled content across most English pages — THE main cause

The site relaunched in August 2026 and published **5,027 book pages in ~2–3
months**. The majority of the 3,460 English pages are template-generated.
Verified live from the production API on 04 Nov 2026:

- **The Midnight Library** (`/books/the-midnight-library-matt-haig-summary`):
  the `key_ideas` section contains **8 paragraphs that are word-for-word
  identical** except the lens name ("point of view", "identity", "memory", …).
  The `deep_summary` repeats the **same filler paragraph 6 times** ("A summary
  should not pretend to reproduce the author's scene construction…"). There is
  **no mention of the actual story** — no Nora Seed, no library between life and
  death, no parallel lives. A reader (or Google) cannot learn anything about the
  book from this page.
- **Beartown** (`/books/beartown-fredrik-backman-summary`): a generic
  "translation-aware critical guide" — zero plot, zero characters, zero
  hockey-town-specific content.
- **Think and Grow Rich**: formulaic framework prose, an **empty
  `### Critical synthesis` heading**, and sentences like "No management,
  psychology, finance, design, or productivity framework works independently of
  context" — a boilerplate line that reads as if it appears on hundreds of books.

These are not isolated cases. The repo's own read-only audit
(`docs/quality-gateway-2026-10-21.md`, production `public.books`) confirms at
scale:

| Confirmed exact-copy evidence | Count |
|---|---:|
| English books sharing the identical practice-tracker text | **2,387** |
| English books sharing identical tracker or action system | **2,618** |
| English books sharing identical key ideas | 21 |
| P0 thin pages (overview/key ideas/deep summary < 100 chars) | **291** |
| P1 pages needing editorial review | 2,382 |
| Hindi books with deep summary < 100 chars | 324 |
| Hindi books with key ideas < 100 chars | 28 |

Editorial repair is underway but at a trickle: **31 full Hindi rewrites + 10
partial fixes so far** (Issue #70: "1,537 individual reviews remaining").

This pattern — thousands of pages published in a short window with repeated
template text — is exactly what Google's **scaled content abuse** policy (March
2024 core update) targets. The observable result is precisely what GSC shows:

1. Google indexes only ~21% of the pages (it withholds the rest).
2. The whole domain gets a low-trust treatment → very limited SERP real estate
   per query (1–2 impressions per long-tail query).
3. Even the indexed pages sit at positions 9–13 and can't break through.

The Hindi core (कंकाल, गोदान, भूले बिसरे चित्र etc.) is genuinely book-specific
after editorial work — that is why those are the pages earning the most
impressions in your top-pages list.

### 2.2 Google only indexes a thin slice of each page (technical)

`scripts/prerender-all-books.mjs` (run in every production build) writes the
static HTML that crawlers receive, but by design it includes only:

- `overview` — clamped to **1,800 chars**
- `key_ideas` — clamped to **1,700 chars**
- `daily_application` — clamped to **900 chars**

That is ~800 indexable words. `deep_summary` and `deep_analysis` are
**explicitly excluded** (code comment: *"The prerender only needs enough
indexable text for crawlers; the full article continues to hydrate from
Supabase in the client."*). The full article loads in the browser via API after
hydration. Google's secondary JS rendering of cross-origin API hydration is
unreliable, so the index is effectively built from the thin, templated slice.

Result: even where the DB has better content, Google mostly never sees it.

### 2.3 Domain age and authority

- The current stack/content was published from ~August 2026 (fresh Supabase
  cutover, `FRESH-SETUP-STATUS.md`); GSC has only ~3 months of history.
- External footprint is minimal: a web search for "booknomics.com" surfaces only
  the site's own GitHub — no press, no citations, no directory listings.
- With near-zero backlinks, a 3-month-old domain gets 1–2 impressions per
  long-tail query. This is normal for the age **but** it makes recovery slower,
  because the trust cap compounds the content problem.

### 2.4 CTR-specific issues (secondary, fix later)

- English titles have **no author**: `{Title} Summary: Key Lessons & Analysis |
  Booknomics` — but the actual queries include the author ("think and grow rich
  **napoleon hill** summary"). Hindi titles already include the author.
- English titles run >60 chars and truncate in the SERP.
- Some impressions come from off-target queries ("simanto gandhi name ke
  porichito chilen" — Bengali intent) where the page will rarely win.
- Competitors on these queries (Goodreads, Wikipedia, Amazon, major Hindi
  summary sites) have far more authority; at position 9+ they absorb the
  clicks. This is a position problem, not a copy problem — but title fixes still
  buy a CTR bump.

### 2.5 Minor technical items (low impact)

- `index.html` contains **two** `google-site-verification` meta tags with
  different tokens — the stale one should be removed (confusing, though not
  harmful).
- Catalog includes non-EN/HI original works (Thai, Malay, Malayalam, Telugu,
  Swedish…) under `-hindi-summary`/`-summary` slugs. That's a legitimate niche,
  but it dilutes the "English & Hindi summaries" positioning that the titles,
  sitemap and hubs all promise. Consider a clearly-labeled sub-section.
- Everything else is in good shape: robots.txt is clean and submits 3 sitemaps;
  `sitemap.xml`/`books-sitemap.xml`/`image-sitemap.xml` are build-generated from
  the DB with a fail-closed guard (`generate-sitemap-v2.ts`); canonical host is
  normalized to `www` (Vite plugin); canonical 301 redirects are build-verified;
  `Book` + `Article` + `BreadcrumbList` JSON-LD is in the prerendered head;
  category hubs with <3 books are noindexed; `published_noindex` status exists
  and is used by the quality gate.

---

## 3. Where to fix — action plan

### P0 — Next 1–2 weeks: stop the bleeding, protect the ~1,000 good pages

1. **Run a template-detection pass over all 5,027 books** and flag pages whose
   `overview`/`key_ideas`/`deep_summary`/`tracker` contain the known repeated
   signatures (e.g. "useful lens for examining how the narrative moves",
   "No management, psychology, finance, design, or productivity framework",
   "A summary should not pretend to reproduce the author's scene
   construction", the 1,060-book tracker template). The 2026-10-21 gateway
   already has exact-copy fingerprints to build on.
2. **Set template-only pages to `published_noindex`** (status already exists in
   the system and is excluded from curated links). Goal: cut the indexable
   surface from 5,027 to the pages that are actually unique (likely 400–1,000).
   This is the single biggest lever: it tells Google "here is our real
   catalogue" instead of 5,000 near-identical pages.
3. **Stop bulk-publishing templated pages.** New pages go live only after
   passing the quality gateway + `SAFE_CONTENT_FIX_NOTICE` workflow (book-
   specific, source-verified).
4. **Fix or noindex the 291 P0 thin pages** (empty/<100-char sections),
   starting with the 324 Hindi deep summaries and 28 Hindi key-ideas deficits.
5. **Thicken the prerender for pages that have real content**: include full
   `deep_summary` + `deep_analysis` (no 1,800-char clamp) in the static HTML,
   and keep the clamp only as a safety net. The index must contain the whole
   article, not a slice.
6. **GSC housekeeping**: confirm no Manual Actions; in the Pages report, split
   "Crawled – currently not indexed" vs "Submitted – currently not indexed";
   after step 2, use URL Inspection → Request indexing for the top ~100–500
   real-content pages (quota-limited, prioritize by impressions).

### P1 — Weeks 2–6: fix the pages that already earn impressions

7. **Editorial rewrites driven by GSC, not by batches.** The Hindi top-20
   sprint (docs/seo/hindi-top20-2026-10-13.md) is the right model. Extend it:
   - Verify the **English top-50 by impressions** actually received real
     content — the `enhance-english-top50-seo.mjs` list exists, but live
     sampling on 04 Nov shows The Midnight Library is still fully templated.
     Rewrite these first; they are the pages closest to earning clicks.
   - Then the next cohort by impressions (कंकाल-adjacent Hindi, business EN).
8. **CTR pass on the top ~200 pages only** (do not mass-rewrite titles; per
   the repo's own evaluation rule, avoid title churn during observation
   windows):
   - EN titles: add author — "Think and Grow Rich by Napoleon Hill — Summary &
     Key Lessons | Booknomics" (keep ≤60 chars where possible).
   - Descriptions: weave in the exact GSC top-query phrasing per page
     (e.g. "…full summary in English: the 13 principles, autosuggestion,
     and a practical plan…").
   - Keep the existing Hindi title pattern (it already wins).
9. **Internal links to the priority pages**: category hubs,
   `/best-hindi-book-summaries`, `/english`, `/hindi` and author pages should
   prominently link the top-100 by impressions; add "more by this author"
   cross-links on book pages. Crawl equity on a low-trust domain has to flow
   to the pages that can rank.

### P2 — Months 1–3: build the authority the content now deserves

10. **Backlinks — 20–50 quality links is enough at this stage.** The site
    already has the surfaces for it: `/press`, Instagram/YouTube channels,
    Pinterest MCP. Concrete channels: book-blogger roundups, BookTuber
    collabs (send a book-club pack), literary directories, guest posts on
    reading/productivity blogs, LinkedIn articles per rewrite.
11. **Catalog curation**: move non-EN/HI original-language books (Thai, Malay,
    Malayalam, Telugu…) into a clearly labeled section or reduce their
    indexable weight; keep `/hindi` and `/english` hubs 100% on-language so
    Google's language signals stay clean.
12. **Small tech cleanup**: remove the duplicate `google-site-verification`
    meta; keep one valid token per property.
13. **Weekly GSC snapshot cadence** (impressions, clicks, CTR, avg position,
    indexed count) — the repo already has `monitor-indexing.ts`; extend it to
    track indexed vs published so the 21% ratio becomes a tracked KPI.

### 90-day targets (realistic, given domain age)

| KPI | Now | 90-day target |
|---|---:|---:|
| Indexed pages (indexable surface) | 1,060 / 5,027 | ~800–1,500 of a deliberately smaller indexable set |
| Impressions / 30 days | ~330 | 3,000–6,000 |
| Clicks / 30 days | ~13 | 100–250 |
| CTR on top-20 priority pages | 0.6–2.6% | 3–5% |
| Avg position on priority queries | 6–9 | 3–6 |

### Do NOT do

- Do not mass-rewrite titles/descriptions outside the top-200 priority set.
- Do not re-publish templated pages with cosmetic edits — that's the same
  scaled content.
- Do not buy or spam backlinks; at this trust level it does more harm.
- Do not use the Indexing API in bulk on templated pages.

---

## 4. One-paragraph answer

Impressions low = Google is only showing your ~1,060 indexed pages a few times
a day because (a) ~79% of your 5,027 pages were never indexed — most of the
English catalogue is template-generated with repeated boilerplate (2,387 books
share one tracker word-for-word; live pages like The Midnight Library contain
the same paragraph 6–8 times and no real story content), which triggers
Google's scaled-content handling; (b) even the pages that are indexed only get
~800 words into the index because the prerender intentionally omits the deep
sections; and (c) the domain is 3 months old with almost no backlinks, so each
query gets 1–2 impressions. CTR at 1.3% is a symptom of position 9–13, not the
disease. Fix order: noindex the template pages and publish only verified
content (P0), put the full article into prerendered HTML, rewrite the top-100
impressing pages (English top-50 first) with book-specific content and
author-in-title metas (P1), then earn 20–50 real backlinks (P2).
