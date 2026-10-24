# Hindi regional literary editorial batch 04 — 20 October 2026

## Changed in live production database
Three individually sourced, published Hindi regional fiction summary records were rewritten (not cloned or template replaced). Each received **all eight fields**: `overview`, `deep_summary`, `key_ideas`, `deep_analysis`, `daily_application`, `action_system`, `practice_tracker`, `reflection_questions`.

| Book | Genre and real work-specific content | Primary editorial source |
| --- | --- | --- |
| **Devdas** (Sarat Chandra Chattopadhyay) | Bengali social-psychological tragedy; Devdas, Paro, Chandramukhi; caste/class, belated decisions, respect for consent, non-glorification of alcohol/self-destruction | https://www.penguinrandomhouse.com/books/836722/devdas-hindi-by-saratchandra-chattopadhyay/ |
| **Parineeta** (Sarat Chandra Chattopadhyay) | Bengali family/romance; Lalita, Shekhar, Girin, Gurucharan; debt, property, possessiveness, economic power, early 20th-century social conventions | https://books.google.com/books/about/Parineeta.html?id=8YljAAAAMAAJ |
| **Pather Panchali** (Bibhutibhushan Bandyopadhyay) | Bengali village/family coming-of-age novel; Apu, Durga, Sarbajaya, Harihar, Indir; childhood curiosity and poverty, ageing, death, rail symbol | https://www.penguin.co.in/book/pather-panchali/ |

**Author profiles:** Sarat Chandra is source-linked and individually profiled, with two novel entries. Bibhutibhushan was already supported by a prior source-backed profile. Source for Sarat's works and dates: https://en.banglapedia.org/index.php/Chattopadhyay%2C_Sharat_Chandra

## Verified structural quality
Each changed book:
- 5 individually meaningful bold-labelled `key_ideas`, not plot recap.
- 5 substantive `####` heading-based deep analysis paragraphs.
- 4 bold-labelled practical applications.
- 7 specific daily exercises and a 7-row progress table, not identical generic days across books.
- 6 genuinely book-specific discussion/reflection questions.
- New overall synopsis and a substantive narrative summary of the original work.
- First validated locally for sensible field lengths/markers, then checked by the database's production Hindi publish quality gate, then re-read through SQL to confirm new content saved and generic flags absent.
- Whole original book row snapshotted atomically in `private.book_content_revisions` before replacement, with version reason `2026-10-20 regional editorial batch04`.

## Release and scope
The three published records remain published and indexable; no cover, title, author, slug, canonical or robots flag changes and no hidden drafts modified.

At original 2026-10-20 cohort discovery **328** regional Hindi published records had formulaic repeated main ideas. Regional batches 02 (5), 03 (3), 04 (3) now cover 11 of that cohort; **317** remain with the identified marker.

Published Hindi catalog: **1,568 records**. Targeted, individually improved book main content: Godan (1) + genre batch 01 (8) + regional batch 02 (5) + batch 03 (3) + batch 04 (3) = **20 distinct books**, with **1,548 not individually rewritten to the same standard**.

**Important limitation:** checking against publisher synopses and bibliographic sources is not line-by-line collation with full original texts. A final original-text editorial audit and mobile-device manual reading remain necessary for every book. Static HTML / live deployment validation is a separate release check; don't claim live HTML verified until measured.
