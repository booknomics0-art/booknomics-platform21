# Hindi regional-literature editorial batch 02 — 20 October 2026

## Precisely what was changed

Five **published, non-draft** Hindi summary records were rewritten **individually** in Supabase from identified book-specific reference material. The entire previous row for each was snapshotted in `private.book_content_revisions` under `2026-10-20 regional editorial batch02`. No publishing status, cover, canonical, image or indexing flags were changed.

| Book (slug) | Genre | Work-specific focus | Bibliographic/context source |
| --- | --- | --- | --- |
| Anandamath (`anandamath-bankim-chandra-chattopadhyay-hindi-summary`) | Historical-political novel | Bengal famine/Sannyasi rebellion; Satyananda, Mahendra, Kalyani, Shanti; nationalism and its exclusions; role of Vande Mataram | https://books.google.com/books/about/Anandamath.html?id=FO6wCwAAQBAJ |
| Aparajito (`aparajito-bibhutibhushan-bandyopadhyay-hindi-summary`) | Coming-of-age and family novel | Apu's education; Sarbajaya's loneliness; Aparna's loss; relationship with Kajal | https://books.google.com/books/about/Aparajito.html?id=x4FjAAAAMAAJ |
| Chander Pahar (`chander-pahar-bibhutibhushan-bandyopadhyay-hindi-summary`) | Adventure novel | Shankar's African journey; Diego Alvarez; wilderness, risk and loss; caution that fictional creatures are not scientific evidence | https://en.wikipedia.org/wiki/Chander_Pahar |
| Arogyaniketan (`arogyaniketan-tarashankar-bandyopadhyay-hindi-summary`) | Medical/social philosophical novel | Jiban Moshay; traditional and modern medicine; fear of death; careful distinction between literary interpretation and evidence-based care | https://books.google.com/books/about/Arogya_Niketan.html?id=jd_6NTXBiyYC |
| Angaliyat (`angaliyat-joseph-macwan-hindi-summary`) | Gujarati Dalit social novel | Vankar weaver community, Patel caste dominance, Methi and Kanku, remarriage and exclusion, stepchild metaphor | https://india.oup.com/product/the-stepchild-9780198090304 |

## Per-record structural checks completed

- Book IDs, titles, published status and language matched; drafts were excluded.
- Exactly 5 distinct, work-specific **bold-labelled** main insights.
- 5 substantive `####` deep-analysis subsections per book; Markdown headings already render bold through PR #68.
- 4 numbered **bold-labelled** practical exercises per book.
- Replaced rather than appended to the old generic `key_ideas`, `deep_analysis`, `overview`, `deep_summary`, and `daily_application` fields.
- Each record passed production Hindi publish quality gate v3. An earlier transaction failed on an analysis below minimum length; **transaction rolled back**. The deficient analysis was rewritten before the successful new transactions. Quality gate was not disabled.
- Repeated `केंद्रीय प्रश्न` / `पात्र और दबाव` / `पढ़ने की सही शुरुआत` template text no longer appears in these five repaired fields.
- Original source snapshots: **5**. Exact prior book content can be restored from `private.book_content_revisions`.

## Author biographies and tests

Four referenced author profiles for Bankim Chandra Chattopadhyay, Bibhutibhushan Bandyopadhyay, Tarashankar Bandyopadhyay and Joseph Macwan added via `src/lib/reviewedHindiAuthors.ts`. The profile for Bibhutibhushan is shared with both `Aparajito` and `Chander Pahar`. Regression tests cover profile detection and text.

## Rollout state and remaining scope

The total originally detected template-affected published Hindi regional summaries was **328**. Exactly **5 repaired** in this batch, leaving **323** in the same signature cohort. This is a heuristic count of repeated templates, not certification of all other pages.

Whole Hindi published catalogue baseline: **1,568**; 9 earlier improved records including Godan plus 5 more here = **14 records with targeted editorial updates**, with **1,554 published Hindi books not individually upgraded to the same level**.

Work-specific research in this batch used publication/overview sources; a complete line-by-line verification against the primary-language text for every interpretive statement is still a distinct, higher-cost editorial task. Do **not** imply this was completed.

Next required check: green CI, production deploy, response HTTP 200, page content new takeaway visible in generated HTML, canonical and robots preserved, mobile reader heading/TOC regression.

Follow-up: GitHub issue #71 for remaining 323 template pages, and issue #70 for overall published Hindi editorial rollout.
