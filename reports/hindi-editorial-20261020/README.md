# Hindi selective editorial audit — 500 × 3 + 68 (20 October 2026)

This is a **read-only, four-batch inventory** of **1,568 published, non-draft Hindi Booknomics records**. It does not itself rewrite or approve 1,568 works. 500-book cohorts are frozen by `lower(title), id` at snapshot time, so a later catalogue edit may change position, but **book IDs in manifests are stable**.

## Four audited batches

| Batch | Frozen sequence | Live books | Books with obvious generic marker | Regional generic lessons | Template 7-day plan | Template tracker | Template reflections | Short deep_summary (not proof of missing content) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 01 | 1–500 | 500 | 454 | 267 | 454 | 454 | 267 | 0 |
| 02 | 501–1000 | 500 | 215 | 50 | 215 | 212 | 50 | 121 |
| 03 | 1001–1500 | 500 | 227 | 0 | 227 | 223 | 0 | 140 |
| 04 | 1501–1568 | 68 | 29 | 0 | 29 | 28 | 0 | 29 |
| **Total** | 1–1568 | **1,568** | **925** | **317** | **925** | **917** | **317** | **290** |

Other generic-ideas signatures in this audit: autobiography lessons **45** and a particular spiritual-ideas signature **25** (may overlap the 925 books). Because those signatures can be missed by simple keyword detection, the **643 unflagged books are not certified good**. Source-specific editorial checks are required.

Per-book manifests: `batch-1-manifest.json` through `batch-4-manifest.json`. They include only public catalogue identifiers, section-level flags and ordering; no passwords, private user data or source-content copies.

## Work dispatch and expert roles per batch

**Research and evidence subagent:** identify original work (title, author, edition/translation), actual genre, reputable primary/publisher/academic sources and 3–8 work-specific fact/character/motif anchors. If identity is ambiguous, mark `needs_source` and **do not rewrite**.

**Critical reading and insights subagent:** for each flag, write only the flagged part: transferable, nuanced lessons (not plot recaps), actual character names, accurate genre-aware analysis, concrete application, 7-day study steps, or real reflection questions. Preserve unflagged content unless a concrete factual or formatting defect is independently established. Avoid fabricated quotes, years and awards.

**Independent QA subagent:** verify every proposed claim against evidence; compare changed vs existing content and reject generic patterns, plot spoilers presented as lessons, copied templates, factual inventions, analysis headings with no body, or repetitive practical exercises.

**Production QA subagent:** before any write, snapshot complete original row in `private.book_content_revisions`, check exact book ID and current row/version, update only approved fields within a transaction; then verify counts, markdown `####` rendering, mobile screen, TOC, unchanged canonical/robots/cover/status and page HTML. A previously updated field must not be replaced by stale proposals.

## Mandatory partial-update contract

For every book, propose:

```json
{
  "book_id": "<exact manifest UUID>",
  "title": "<manifest title>",
  "status": "unchanged|needs_source|reviewed_no_change|proposed|approved|committed|live_verified",
  "source_links": ["https://..."],
  "genre_verified": "Specific literary genre or unknown",
  "field_decisions": {
    "key_ideas": {"decision": "keep|rewrite|needs_source", "reason": "..."},
    "deep_summary": {"decision": "keep|rewrite|needs_source", "reason": "..."},
    "deep_analysis": {"decision": "keep|rewrite|needs_source", "reason": "..."},
    "daily_application": {"decision": "keep|rewrite|needs_source", "reason": "..."},
    "action_system": {"decision": "keep|rewrite|needs_source", "reason": "..."},
    "practice_tracker": {"decision": "keep|rewrite|needs_source", "reason": "..."},
    "reflection_questions": {"decision": "keep|rewrite|needs_source", "reason": "..."},
    "overview": {"decision": "keep|rewrite|needs_source", "reason": "..."}
  },
  "reviewer_qa": {"bibliographic": false, "claim_checked": false, "original_value_preserved": false, "render_checked": false},
  "changed_fields": {}
}
```

Never set `changed_fields` for a field marked `keep` or `needs_source`. No default writer templates, no padding to word counts, no site-wide bulk `UPDATE books SET key_ideas=...`; the legacy generators are deliberately disabled for literary accuracy. This task must not restore those generators.

## Publishing gates and count reporting

1. **Selection:** 1,568 row IDs accounted for across 4 manifests; flag counts are screening results only.
2. **Source check:** book/author/genre and all specific factual claims supported. Unsupported proposals remain `needs_source`.
3. **Content review:** only defective part revised. Five distinct insightful lessons if `key_ideas` changes, substantial analysis with bold subheadings if `deep_analysis` changes, and individually meaningful study plan/tracker/questions if those change.
4. **Safe commit:** preserve complete backup, apply approved changed fields with safeguards against concurrent changes, and independently verify new row.
5. **Live QA:** deploy only verified pages and check actual HTML, URL, canonical, meta robots and mobile layout; no mass indexability policy changes.

A book is **not complete** merely because the JSON manifest exists, an LLM output was generated, tests passed, or the page is prerendered. `live_verified` requires the final checks and actual updated website content. Report separate counts: audited, needs-edit, source-blocked, revised, approved, committed, live-verified. Preserve all good content.

## Current connection limitation

Connected n8n agent discovery and credentials tools returned an internal error at setup. Research agents can review from these public GitHub manifests, but they do **not** implicitly have access to private Supabase write credentials; no agent may claim a website update without a verified production write and public page read.
