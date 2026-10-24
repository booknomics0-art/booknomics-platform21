# Hindi genre-aware summary quality — batch 01 (2026-10-20)

## Scope, safety and honesty

Production catalogue has **1,568 published Hindi** book records, plus **34 hidden Hindi duplicates/drafts** (untouched).
The entire published Hindi corpus was screened by category, not personally fact-reviewed: **8 new books** were rewritten in this batch and **1 Godan record** had been previously improved. **1,559 published Hindi books are not yet individually reviewed to the same editorial standard.**

These edits do not alter cover images, canonical URLs, SEO indexing status, draft flags or other English books. Original full book rows were snapshotted in `private.book_content_revisions` before every editorial update (8 new snapshots for this batch).

## Genre groups for a pending full-corpus review

Provisional classification uses existing **category metadata only**, not verified text genre. In particular, several books are mislabeled broadly as "साहित्य".

| Provisional group | Published Hindi | Short deep_summary field (<100 chars) |
|---|---:|---:|
| Regional/translated Indian literature | 600 | 0 |
| Novels and genre fiction | 247 | 122 |
| Philosophy/religion/ethics | 155 | 3 |
| Essays/criticism/satire | 144 | 28 |
| History/biography/travel | 137 | 17 |
| Other/genre needs verification | 91 | 0 |
| Poetry/epic | 89 | 64 |
| Short stories/collections | 79 | 38 |
| Plays | 26 | 18 |
| **Total** | **1,568** | **290** |

A short `deep_summary` may be compensated by substantial `deep_analysis`; these **290 are flags, not automatically low-quality books**.

## Personalized production content updated (eight books)

Each book now has exactly **five transferable, distinct and bold-labelled insights** (not plot paraphrases), a **substantive, specifically written deeper-analysis section with three H4 subheadings**, and **four short bold-labelled reader actions**.

| Book | Genre used for editorial work | New deep-analysis focus | Evidence |
|---|---|---|---|
| कामायनी | Philosophical epic | Manu; Ida vs Shraddha; integration of emotion/reason/action | https://www.publicationsdivision.nic.in/journals/Journalarchives/Yojana/Yojana-English/1961/November/Yojana_1961_November_pdf.pdf |
| मधुशाला | Philosophical poem | Multifaceted symbols, recurring rubai refrain, equality | https://www.penguin.co.in/book/madhushala-%E0%A4%AE%E0%A4%A7%E0%A5%81%E0%A4%B6%E0%A4%BE%E0%A4%B2%E0%A4%BE/ |
| राग दरबारी | Social satire | Institutional networks, Ranganath's observational position | https://www.rajkamalprakashan.com/authors/shrilal-shukla |
| तमस | Partition novel | Nathu's exploitation; crowd escalation; empathy beyond communal rhetoric | https://www.penguin.co.in/book/tamas-3/ |
| रश्मिरथी | Epic re-reading | Karna's dignity; Duryodhana's recognition; loyalty vs ethics | https://books.google.com/books/about/Rashmirathi.html?id=qmmADwAAQBAJ |
| मैला आँचल | Regional novel | Meriganj as collective character; language; medicine and society | https://www.rhime.in/ojs/index.php/rhime/article/view/611 |
| गुनाहों का देवता | Psychological romance | Chander, Sudha, consent, idealization and social convention | https://www.hindwi.org/poets/dharmavir-bharati/profile |
| कफ़न | Realist short story | Budhiya's under-heard suffering; ritual; poverty and moral agency | https://www.rekhta.org/stories/social-issues/kafan-premchand-stories?lang=hi&sort= |

## Factual corrections made

- **मधुशाला:** Removed an assertion that Shyama's death in 1936 caused a 1935 publication; it violates chronology.
- **कामायनी:** Corrected Prasad's birth year from 1890 to 1889, publication opener 1935 → 1936, and the misleading flood narrative implying Shraddha survived alongside Manu.
- **राग दरबारी:** Corrected Shrilal Shukla birthplace Muradabad → Atrauli, Lucknow district.

## Structural QA performed in production database

All eight records passed:
1. Exact published record/title/language/hidden-draft exclusion.
2. Five distinct bold-labeled lessons with 1,008–1,136 characters of personalized insights.
3. Three new `####` subheadings and substantial genre-aware analysis. Existing book prose retained after the new section rather than wiped.
4. Four bold-labeled practical steps. Every row backed up in `private.book_content_revisions`.

Additional per-page visual / SEO HTML verification is required **after the latest Vercel build**. Structural checks are not proof of perfect original-book factual fidelity; further source-level scrutiny is still warranted.

## Author bios

Seven additional individually written, referenced Hindi author biographies were added via `src/lib/reviewedHindiAuthors.ts` and `AuthorBio`; Premchand was already present. Unknown authors remain transparently unverified, not falsely attributed.

## Next phases — no bulk text fabrication

Prioritize by:
1. 290 short deep_summary field flags, checking whether full deep_analysis already covers the material.
2. Generic categories where genre cannot be inferred reliably (91 records).
3. 600 regional works: identify actual original work, author, translation and language before any rewriting.
4. Genre-based batches: verify each source, write five deeper insights, 2–4 substantial analysis subsections, practical applications, author paragraph, four-pass QA, then release.
5. Maintain per-book evidence status and rollback, and **never** certify 1,568 books from automated checks alone.
