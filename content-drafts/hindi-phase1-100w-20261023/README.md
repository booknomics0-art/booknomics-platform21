# Booknomics — Phase 1: 500-book Hindi mini-summary cohort

**Date:** 23 October 2026  
**Goal:** original, book-specific Hindi summaries of ~100 words for the first 500 English-language Booknomics detail-page records. Expand *each* to a separately researched 2,500+ word premium Hindi summary in Phase 2.  
**Publication:** **NOT DEPLOYED. No changes to live Booknomics, GitHub, or Cloudflare.**

## Actual handoff status

| Category | Exact count |
|---|---:|
| Distinct English-source book-page records in cohort | 500 |
| Individual Hindi mini-summary drafts actually written | 100 |
| Drafts passing offline 100–140-word and Devanagari checks | 100 |
| Books still awaiting a Phase 1 Hindi mini-summary | 400 |
| Drafts with final independent book-level factual verification | 0 |
| Drafts deployed/published | 0 |

**Important:** The 500-row manifest is a **queue**, not a claim that 500 summaries are complete. Phase 1 is **20% drafted**. Review status is distinct from automated word-count checks. These drafts are *not* the final 2,500-word premium summaries.

## Files

- `seed_001_025.md`, `seed_026_050.md`, `seed_051_075.md`, `seed_076_100.md` — the original manually authored Hindi mini-draft text, grouped by 25.
- `drafts/` — 100 distinct Markdown files with their title, author, source English Booknomics URL, and full Hindi mini-summary.
- `phase1_drafts.jsonl` — one JSON record per completed draft; can be used as offline data input in a *future, separately approved* import.
- `phase1_500_progress.csv` — all 500 actual source book-page records, including precise status, content-file path when present, future target length, and `not_deployed` marker.
- `QA_REPORT.json` — exact automated word-count and Hindi-script validation for each of the 500 rows.
- `build_phase1.py` — standard-library-only, repeatable offline validator and exporter; no external services or credentials needed.

## Editorial and integration requirements before launch

1. Complete the remaining **400** missing Hindi mini-summaries, grounded in each book's content. Do not fill with generic templates or programmatically pad length.
2. Have a human/factual editorial pass for named characters, events, claims, spoilers, and original versus English-edition book metadata. Public short descriptions alone are not an exhaustive source of truth.
3. Extend each accepted short draft into a distinct, book-specific **2,500+ word** Hindi premium summary with a new factual/content review. Merely repeating or expanding the short draft with filler does not meet that standard.
4. Match each existing English book **ID** to the correct independently stored Hindi variant **ID** in the site's data layer. Identical titles/URL slugs alone do not establish an ID mapping; this ZIP deliberately leaves `hindi_book_id` blank.
5. Wire Hindi toggle to the **persisted prewritten Hindi content** via the linked book record. Do **not** use runtime translation, Gemini, or another translation/generation API.
6. Test one-book-to-one-book navigation, readable Hindi rendering, fallback for unmapped books, and no cross-language wrong-book links before any separately authorized deployment.

## Scope and provenance

The cohort is the 500-page source queue assembled from earlier Booknomics batches 061–072. The list contains English-language summary pages of works originally published in multiple languages, including Spanish and German; it is **not** restricted to authors who wrote their original works in English. Source title, author and public Booknomics page URL are preserved per row.

Mini-summaries were authored in Hindi rather than literal translations of Booknomics English summary prose. No external machine translation / text-generation API was called, and no bulk placeholder text was used to mark missing records complete. The 100 drafted entries were researched against the named books and public Booknomics page descriptions; all remain subject to editorial verification.
