# Booknomics Mastery — 500-book personalized author bio cohort report

**Prepared:** 22 October 2026 (IST)  
**Target:** Each book's Mastery tab needs an independently written, source-checked author introduction of approximately 400 words.  
**Tracking:** [Cohort manifest](./mastery-author-bios-cohort-500-20261022.json) and draft [PR #90](https://github.com/booknomics0-art/booknomics-platform21/pull/90).

## Catalog verification and scope

| Measure | Verified count |
| --- | ---: |
| Production published books in Cloudflare D1 | 5,027 |
| Hindi published | 1,568 |
| English published | 3,459 |
| Exact published IDs selected for this cohort | 500 |
| Hindi cohort | 250 |
| English cohort | 250 |
| Distinct credited authors in cohort | 344 |
| Duplicate stable book IDs | 0 |

The first 100 cohort identities come from the pre-verified 100-book quiz dataset, reconciled with published D1 rows. Another 400 IDs are selected from published D1 using stable IDs, favoring existing research/evidence and substantial book-summary text where available.

## Editorial progress — honest boundary

| Status | Books | Definition |
| --- | ---: | --- |
| Reviewed ~400-word biographies on draft PR | **10** | Original, book-specific prose with source URLs and identity/length tests; awaiting merge/deploy |
| Still require individual research and writing | **490** | Listed and mapped; no claim of having ~400-word personal biographies |
| **Total tracked in this cohort** | **500** | Exactly 250 Hindi + 250 English |
| Production deployment verified | **0** | PR is draft and not merged |

The ten draft essays total **4,050 words** (individual counts 375–434). The full 500-book goal requires around **200,000 words** before editorial corrections. The remaining quantity cannot be counted complete by a manifest, template, author-name substitution, or an unverified generated text.

### Individually written entries (draft)

1. Crime and Punishment — Fyodor Dostoevsky — 397 words
2. Middlemarch — George Eliot — 375 words
3. The Count of Monte Cristo — Alexandre Dumas — 384 words
4. A Brief History of Time — Stephen Hawking — 394 words
5. Antifragile: Things That Gain from Disorder — Nassim Nicholas Taleb — 388 words
6. कर्मभूमि — मुंशी प्रेमचंद — 400 words
7. गबन — मुंशी प्रेमचंद — 418 words
8. रक्तकरबी — रवीन्द्रनाथ टैगोर — 426 words
9. रंगभूमि — मुंशी प्रेमचंद — 434 words
10. सेवासदन — मुंशी प्रेमचंद — 434 words

## Quality gate before marking a book complete

- Check stable published ID, exact title, credited author, and original book language.
- Independently verify author facts (dates, background, relevant publication context) with trustworthy sources; retain links.
- Write roughly 400 words *for that particular book*: connect the author's experiences, craft, historical setting, themes, and what the reader should notice in this work.
- Refuse generic prose, repeated templates, factual invention, and reused biographies from another title by the same author.
- Keep status `pending_research_and_authorship` until its actual individual essay is authored and validated. Include source link and quality checks.
- Run typecheck, tests, build, reviewer spot checks; then merge/deploy and visually verify Mastery tabs. No production D1 mutations made in this task.

## Implementation caution

The ten essay records currently live in a static TypeScript module and are prioritized by book ID. Putting all 500 long bios in the shipped main bundle would raise page weight; a lazy-loaded or Cloudflare D1-backed reviewed content store is preferable for the full corpus once the reader/API path and migration parity are verified.

## Deployment/check caveat

PR #90 stays draft. GitHub Actions should be checked on the **latest commit**, while Vercel preview checks currently report build-rate-limit failures. This report is a record of genuine work done, *not* a statement that 500 full essays are live.
