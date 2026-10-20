# Booknomics reader editorial baseline — 20 October 2026

## Scope and verified counts

Production Supabase `public.books` was checked read-only unless noted below.

| Metric | Count | Notes |
| --- | ---: | --- |
| Book records | 5,062 | 3,460 English; 1,602 Hindi |
| Published | 5,027 | 35 records marked draft |
| Author-name strings | 2,608 | May include spellings/transliteration duplicates |
| Distinct normalized title + author + language | 5,039 | 23 records warrant duplicate review; **not proof** of duplicate content |
| Hindi key ideas empty / <100 characters | 28 | Must be rewritten from the actual book |
| Hindi deep summary empty / <100 characters | 324 | Manual content repair |
| English practical application empty / <70 characters | 1,438 | Length heuristic; individually review |
| English formulaic idea pattern matches | 200 | Contains phrases like "Central reading lens"; manual semantic review |
| Hindi analysis without markdown headings | 199 | May be perfectly good prose; presentation audit only |
| Weak/absent explicit bold delimiters | 38 Hindi, 6 English | Heuristic; reader font changes do not invent emphasis |

Counts overlap: **never add these issue counts together** to claim affected-book totals.

## Confirmed code defects

1. `BookDetail.tsx` used overview/analysis/story exposition as filler for "5 key takeaways", truncating to the first sentence.
2. `ReadingView.tsx` removed **strong** markup after two emphasized spans per paragraph.
3. A JSON serialization of React children could throw on circular structures in rich-text rendering.
4. In-reader table of contents was missing; existing site-level index did not link to all reading sections.
5. Existing generic author card did not present an actual biography or works.

Draft implementation: https://github.com/booknomics0-art/booknomics-platform21/pull/66

## Per-book four-pass editorial contract

**Pass 1 — Factual accuracy and provenance.** Check author/title/date, characters, events, genuine work-specific themes and avoid invented claims. Store evidence before marking `verified`.

**Pass 2 — Deep reader benefit.** Inspect five takeaways independently. Each must express a transferable insight or a genuine ethical/analytical tension, *not retell the story*, be unique, and connect back to evidence in the work.

**Pass 3 — Completeness, hierarchy and typography.** Overview, plot summary, themes, named characters, deeper analysis (with substantive prose), practical applications with concise **bold** lead-ins and a verified author paragraph/other works. Verify markdown headings and bold do not disappear.

**Pass 4 — Experience and release safety.** Test Hindi/English on mobile and desktop, accessibility of TOC toggling and anchors, links to other works, readability, no duplicated heading, no broken SSR/prerender and unchanged canonical/noindex behavior. Recheck published result and rollback.

A pass may be marked complete only with evidence. Automatic length/keyword checks are screening, **not** equivalent to these four passes.

## Edits applied

- One particular published Hindi Godan record `35fb5775-5311-4c33-b0d0-bb9e6e30842b` received five human-oriented moral and socioeconomic insights, with a full prior-book snapshot in `private.book_content_revisions`.
- The other Godan record was deliberately left alone, pending canonical/duplicate review.
- Shared reader code changed in a draft PR. **Not merged to main or confirmed live** at the time this baseline was written.
- A detailed scholarly profile for Premchand is provided; **author biographies for the other authors are not yet fact-verified**.
- The 5,061 other records have **not** been individually rewritten or four-pass-certified; do not represent this as completion.

## Next safe execution sequence

1. CI test/typecheck + mobile preview QA; merge only after green.
2. Check canonical Godan mapping and compare both records.
3. Prioritize 28 Hindi key-idea deficits, then 324 Hindi summary deficits; separately screen 200 formulaic English idea pages.
4. Source-backed author profiles (dedupe all author-name strings first).
5. Batch editorial QA with evidence and progress counts for every book; never bulk-label incomplete records as verified or mass-change indexing status.
