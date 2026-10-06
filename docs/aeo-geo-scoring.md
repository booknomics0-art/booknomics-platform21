# Booknomics AEO/GEO Scoring — Hindi v1.0

This is an internal quality/readiness rubric for Booknomics. It is not a promise of ranking, citation, or inclusion in any search engine or AI answer engine.

## Score bands

- **99–100 — Gold:** exceptional internal readiness; page is highly structured, specific, crawlable, attributable, and citation-friendly.
- **98+ — Strong:** very strong internal readiness with only minor gaps.
- **95+ — AI-ready:** eligible for priority promotion/indexing; core AEO/GEO requirements are satisfied.
- **90–94 — Improve:** useful page, but important answer/citation signals are incomplete.
- **Below 90 — Hold:** improve before treating as an AEO/GEO priority page.

## AEO score (100)

AEO measures how easily an answer engine can extract a useful, direct answer from a page without sacrificing normal SEO.

### Global technical layer — 30 points
- Crawlable canonical HTML and explicit index/noindex rules — 8
- Answer-engine/search crawler eligibility (`OAI-SearchBot`, Googlebot, Bingbot) — 5
- Direct-answer section in prerendered HTML — 6
- Visible question/answer structure — 4
- Structured entity graph and breadcrumbs — 5
- Unlimited useful snippet/image preview directives on indexable pages — 2

### Page quality layer — 70 points
- Book-specific overview (>=300 chars) — 10
- Book-specific key ideas (>=300 chars) — 10
- Substantive analysis (>=3000 chars) — 10
- Practical/application section (>=250 chars) — 8
- Useful meta title — 4
- Useful meta description — 4
- Author + category identity — 6
- Publication year when confidently known — 4
- Three or more internal intent/query terms — 4
- Useful cover/primary image — 3
- No repeated long-sentence boilerplate — 7

## GEO score (100)

GEO measures how well a page presents trustworthy, attributable, reusable information for generative answer systems.

### Global entity/trust layer — 35 points
- Booknomics Organization + WebSite entity graph — 7
- Source-work Book entity separated from Booknomics editorial Article — 7
- `about`, `isBasedOn`, and citation/source relationships — 6
- Visible editorial/source disclaimer — 5
- Canonical URL + language + breadcrumbs — 5
- Transparent editorial/corrections principles — 5

### Page evidence layer — 65 points
- Book-specific overview — 8
- Book-specific key ideas — 8
- Substantive analysis — 10
- Practical/application section — 5
- Useful title + description pair — 6
- Author + category identity — 6
- Publication year when confidently known — 4
- Intent/query terms — 3
- Useful image — 3
- No repeated boilerplate — 8
- Direct concise answer/takeaways generated from page-specific content — 4

## External outcome metrics

Internal AEO/GEO scores must be kept separate from real-world outcome metrics. External metrics include:

- Google Search / AI feature impressions, clicks, CTR, and position where available
- Bing Webmaster Tools AI Performance citations and cited pages
- ChatGPT Search citations / cited pages where measurable
- Gemini / Google AI citations where measurable
- Perplexity/Copilot citations where measurable
- AI share of voice / brand mentions from a supported third-party tracker

A page can score 99 internally and still receive zero citations. A citation system chooses sources independently. The score measures readiness, not control over an external ranking system.

## Publishing rule

Do not lower normal SEO quality to increase AEO/GEO. Canonicals, indexability, factual accuracy, source identity, helpful original content, and crawlability remain mandatory. Known-factual-risk pages should remain noindex until corrected.

Scoring version: `AEO-GEO-HI-v1.0`
