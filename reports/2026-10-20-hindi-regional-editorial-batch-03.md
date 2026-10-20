# Genre-specific Hindi regional editorial batch 03 — 20 October 2026

## Scope
Replaced **three published, non-draft Hindi generic regional summaries** in production Supabase. All five editorial fields (`overview`, `deep_summary`, `key_ideas`, `deep_analysis`, `daily_application`) were rewritten separately for their actual genres; no blind copying of a prior book. Preserved full-row snapshots in `private.book_content_revisions` before writes (`2026-10-20 regional editorial batch03`), with no covers, title, author, status, indexability or URL changes.

| Book | Genre | Verified basis and focal ideas | Reference |
|---|---|---|---|
| Badshahi Angti — Satyajit Ray | Bengali detective fiction | Feluda/Topshe; Lucknow, Dhiru Kaka, Dr Srivastav, stolen ring, evidence over appearances; serialized 1966–67, book 1969 | https://www.penguin.co.in/book/the-puffin-feluda-omnibus-2/ |
| Akhepatar — Bindu Bhatt | Gujarati Partition memory novel | Kanchanba's memories of Karachi and Jasapara; displacement, trauma, women's choices; inexhaustible bowl image; literary award 2003 | https://www.worldlitonline.net/issues/vol-12-no-1/articles/gendering-partition-narrative-akhe-patar/ |
| Akoopar — Dhruv Bhatt | Gujarati ecological literary fiction | An outsider artist in Gir, Aima and Sansai, Maldhari life, lion habitat, mythic tortoise symbol | https://www.crossword.in/products/akoopar-paperback-dhruv-bhatt |

## Four-pass editorial gate record
1. **Book identity and evidence**: title, author, historical setting, characters and literary category checked against linked literary/publisher sources; historical/medical/scientific claims kept distinct from fictional interpretation. Full primary-text collation still remains a separate, higher standard.
2. **Reader value**: exactly five non-repeat, book-specific transferable lessons for each book, not a plot recap.
3. **Structure**: five distinct bold-labelled lessons; **five** substantive `####` analytical subheadings; **four** practical exercises with bold lead-ins per book. Long synopsis and topic-specific overviews replace generic filler. Production quality gate v3 accepted all three.
4. **Safety**: three full-row rollback snapshots; no index/robots/canonical/cover mutations. New production build and publicly served HTML must be separately checked after this PR merges.

## Author profiles
New source-linked and individually written biographies for Satyajit Ray, Bindu Bhatt, and Dhruv Bhatt added to `src/lib/reviewedHindiAuthors.ts`, with regression tests. For Bindu Bhatt, unrelated works have deliberately not been invented where independent verification was insufficient.

## Reported progress
The targeted signature cohort contained 328 published Hindi regional summaries before batches. Batch 02 improved five, leaving 323. Batch 03 improved three, leaving **320** published summaries with matching repetitive template markers. These 320 are still pending book-specific review.

Hindi production catalogue has 1,568 published records. Targeted improvements now cover **17 records** (Godan + 8 genre originals + 5 regional batch 02 + 3 regional batch 03); **1,551** are not yet individually upgraded to this standard. The scope excludes 34 hidden Hindi duplicate/draft records.

The structural QA and bibliographic cross-checks do not mean every sentence has been checked against the full original published text. Do not label unrevised pages or unresolved claims as four-pass-perfect.

Tracking: GitHub #70 general rollout, #71 generic regional cohort.
