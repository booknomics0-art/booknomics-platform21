# Booknomics remaining books: honest no-external-AI-API quiz audit

**Date:** October 22, 2026
**Source:** Live connected Supabase database snapshot
**Published catalog:** 5,027 books
**Quizzes completed before this execution:** 1,607 books / 16,070 questions
**New this execution:** 14 books / 140 manually drafted, book-specific questions.
**Total after this execution:** 1,621 quiz books / 16,210 stored questions.
**Still without quizzes:** **3,406 published books** (see complete CSV).

## Why these were not indiscriminately filled

Several thousand stored `key_ideas` passages are boilerplate reading instructions or broad topical labels, not reliable descriptions of what happens or is argued in the actual work. Turning generic material into 10 forced MCQs per title would create apparent completion without trustworthy learning value.

The automated classifier below is **a triage tool, not a verified finding that every flagged book is generic**. A book must be examined individually before its status is changed.

| Backlog reason | Books |
|---|---:|
| Generic-content language marker detected — rewrite or inspect sources | 2589 |
| No generic marker detected — verify book-specific source evidence before quiz authoring | 795 |
| Existing empty asset has a non-draft status — inspect workflow | 10 |
| Book has no `book_assets` row — repair schema/data linkage | 12 |
| **Total** | **3406** |

## What was actually changed

14 additional book-specific sets were added to existing draft `book_assets` only when `quiz_data=[]`. Titles: Little Women; Tao Te Ching; देवदास; Anna Karenina; Notes from Underground; Resurrection; The Brothers Karamazov; The Gambler; The Tempest; The Wild Duck; The Frogs; Homo Deus; Persepolis 1 & 2; The Seven Lamps of Architecture.

All new questions have four options, a correct-answer index, an explanation, tier placement and `editorial_review_required=true`. The questions were hand-authored from existing reading material and model knowledge, **not authenticated against every original edition**. These sets therefore remain editorial drafts.

## Next necessary content workflow

1. Verify exact work identity, author, edition and language first.
2. Replace generic summaries and learnings with factual book-specific discussion, using authoritative editions or other credible references; avoid invented plot details.
3. Author 10 individually tailored MCQs, preferably 3 Basic, 4 Medium, 3 Advanced, with meaningful plausible distractors, answer explanations and source provenance.
4. Have each answer independently verified; do not publish purely because a JSON structure passes.
5. Verify auth, scoring, visibility, and reading experience in browser. Beware: draft asset status alone may not keep quizzes hidden under current read policies.

**No Gemini, Lovable, or other external AI-generation API was used in this execution.** Supabase and GitHub connectors were used only to check and store work.

The attached CSV is a full catalog of remaining books with a triage reason, not a claim of quiz completion.
