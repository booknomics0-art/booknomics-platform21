# Booknomics Mastery — book-specific author profiles, first 10-book cohort

**Date:** 22 October 2026  
**Scope:** Editorial branch / PR #90. No production database writes.

The Mastery tab's author section previously used author-name lookup. This could
reuse one biography across different books by the same writer, or show a short
placeholder. The new lookup first checks the **stable book ID** and only then
falls back to the existing reviewed author profile. The new entries are original,
independently reviewed essays written for each particular work.

| Book | Language | Words | Linked reference count |
| --- | --- | ---: | ---: |
| Crime and Punishment | English | 397 | 2 |
| Middlemarch | English | 375 | 2 |
| The Count of Monte Cristo | English | 384 | 2 |
| कर्मभूमि | Hindi | 400 | 2 |
| गबन | Hindi | 418 | 2 |
| रक्तकरबी | Hindi | 426 | 2 |
| रंगभूमि | Hindi | 434 | 2 |
| सेवासदन | Hindi | 434 | 2 |
| A Brief History of Time | English | 394 | 2 |
| Antifragile: Things That Gain from Disorder | English | 388 | 2 |

All ten use IDs from `reports/quiz-batch-100-20261021.json` and preserve original
book languages. Biographical claims were researched against publishers, literary
archives, or university learning materials; links are attached to each profile.
Different Premchand works have materially different analyses and reading lenses.

## Editorial quality checks

- Exact published-cohort book ID, title, author, and language match.
- A target range of 350–460 whitespace-delimited words (approximately 400).
- Book and author are explicitly identified in each essay.
- Two HTTPS source references per profile; no generic generated substitution.
- Identity, duplication, length, and source tests in
  `src/lib/reviewedBookAuthorProfiles.test.ts`.
- Existing Mastery quiz, flashcards, mind map, URLs, and book data untouched.

## Honest completion boundary

**10 individually authored book profiles** are prepared on PR #90. This is not
catalog-wide completion. The other 90 books in the 100-book manifest remain
pending personalized author writing; books outside that manifest remain pending
as well. Existing author-based reviews remain available as a fallback, but most
of those are not independently verified ~400-word entries for each book.

Before merging, require a passing TypeScript check, Vitest suite, app build,
and targeted reader review for Hindi and English. Vercel deployment statuses
may be rate-limited independently of GitHub CI. Do not call an unpublished
branch live merely because the PR is open.

## Scaling caution

Appending several thousand 400-word essays to a statically imported TS file
would inflate the reader bundle. Before expanding substantially, move the same
reviewed-by-book-ID data to a paged/lazy-loaded content store, preferably the
Cloudflare D1 production content path after schema and compatibility verification.
Use editorial gates and reversible write batches; never synthesize a shared
author biography with book-title substitution and claim it is personalized.
