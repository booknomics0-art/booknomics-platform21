# Booknomics English → Hindi: cohorts 001–007 (2026-10-22)

## Verified source and scope

Source: connected Supabase project `pbkfewrtdgiagytmcigb`, table `public.books` (read only). Eligibility: `language='en'`, `is_draft=false`, `status='published'`.

- Total English rows in Supabase: **3,460**.
- Eligible published English rows: **3,459**.
- Excluded intentionally: **1** hidden draft marked `duplicate_hidden`.
- Total enrolled into cohorts: **3,459 unique book UUIDs**, no repeated UUIDs, no CSV parse errors.
- English source fields represented: **61,615,399 characters** across up to nine sections per book.
- Cohorts 001–006: **500** books each. Cohort 007: **459** books.
- Source English content was **not modified**.
- No external translation API or n8n used for the authored Hindi drafts.

## File inventory

| Cohort | Books | Manifest | Current complete draft(s) |
|---|---:|---|---|
| 001 | 500 | `en-hi-batch-001-20261022.csv` | `drafts/en-hi-batch-001/animal-farm.complete-draft.hi.json`; `drafts/en-hi-batch-001/100-ways-to-improve-your-writing.complete-draft.hi.json` |
| 002 | 500 | `en-hi-batch-002-20261022.csv` | `drafts/en-hi-batch-002/differentiate-or-die.complete-draft.hi.json` |
| 003 | 500 | `en-hi-batch-003-20261022.csv` | `drafts/en-hi-batch-003/kotler-on-marketing.complete-draft.hi.json` |
| 004 | 500 | `en-hi-batch-004-20261022.csv` | `drafts/en-hi-batch-004/social-media-marketing.complete-draft.hi.json` |
| 005 | 500 | `en-hi-batch-005-20261022.csv` | `drafts/en-hi-batch-005/the-anatomy-of-buzz.complete-draft.hi.json` |
| 006 | 500 | `en-hi-batch-006-20261022.csv` | `drafts/en-hi-batch-006/the-long-tail.complete-draft.hi.json` |
| 007 | 459 | `en-hi-batch-007-20261022.csv` | `drafts/en-hi-batch-007/zag.complete-draft.hi.json` |

The manifest paths above are relative to `content/translations/batches/`; draft paths are relative to `content/translations/`.

## Progress (honest editorial status)

- **8** complete but **unapproved** Hindi drafts of all nonempty source sections (two in cohort 001, one each in 002–007).
- **2** partial 7/9-section drafts: `Atomic Habits`, `The Psychology of Money` (cohort 001).
- **1** previously approved five-section translation exists for `The Old Man and the Sea` (cohort 006), but the eligible Supabase English record has nine source sections. This is flagged `preexisting_approved_5_of_9_requires_completion_and_parity`, not counted as fully translated. Existing translation must be reverified against the Cloudflare D1 source and have missing sections completed before full-toggle coverage.
- **3,448** further records are marked `pending_translation`.
- **0** of the eight new complete drafts are approved or verified as deployed to the live Cloudflare D1 translation store.
- Do not interpret an enrolled book or a complete draft as an already working live Hindi toggle.

## Activation gate

Each book must meet every condition before enabling `hi` toggle:
1. Original English book ID and nine source fields (or the exact nonempty set) match current Cloudflare D1 source, including expected English source hash. If the source changed, re-review and revise Hindi.
2. Hindi content covers **all** nonempty English sections with individual book-specific detail; preserve the meaning of headings, actionable frameworks, quotes attribution, examples, structure, and formatting.
3. Editorial validation confirms accuracy, natural Hindi, correct title/author identity, no generic copied lessons, no untranslated paragraphs, no privacy/security issues. Set `approved=true` only after real review.
4. Persist approved translation to the intended `book_translations` D1 schema through a safe, idempotent import (no update to original English books), then deploy the Worker consumer if required.
5. Test direct book route and English/Hindi toggling, including switching back to original English, responsive UI, cache behavior, and unpublished-book fallback. Never display machine-translation provider failure in a prewritten-translation path.

## Current infrastructure blocker

At the time the translation branch was prepared, the `book_translations` Worker from draft PR #92 had not been deployed. Cloudflare D1 Free read quota had also been exhausted for the day. Both prerequisites need fresh verification before any live import or toggle claim. This branch itself is **not** a live deployment.

## Next work, priority order

1. Complete the two remaining very long sections (`deep_summary` and `deep_analysis`) for each of `Atomic Habits` and `The Psychology of Money` before considering them ready. The other seven sections are now authored in Hindi.
2. Continue manual faithful translation cohort by cohort, maintaining per-book status and source snapshot.
3. Recheck previously approved `The Old Man and the Sea` five-field version and complete missing source fields.
4. Run the complete D1 parity/editorial/import/toggle acceptance gate. Batch import only after the gate passes.

**No claims of 3,459 completed translations or of a working live Hindi toggle are made by this report.**
