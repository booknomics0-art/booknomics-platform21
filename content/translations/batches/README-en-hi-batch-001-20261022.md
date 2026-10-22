# Booknomics English → Hindi — Batch 001 (2026-10-22)

## Scope
- Source: **Supabase** project `pbkfewrtdgiagytmcigb`, `public.books`.
- Selection: 500 non-draft published/noindex English rows; Atomic Habits and The Psychology of Money first, then deterministic case-insensitive title + ID ordering.
- Original English rows remain unchanged.
- 500 exact IDs, slugs, titles, authors, status and field character counts: [manifest](./en-hi-batch-001-20261022.csv).
- Total source length across the 9 toggle sections: **8,386,591 characters**. These are source characters, not translated words or completed content.

## Progress
| Book | Authored Hindi fields | Status |
| --- | --- | --- |
| Atomic Habits — James Clear | overview, key_ideas, daily_application | Partial editorial draft (3/9) |
| The Psychology of Money — Morgan Housel | overview, key_ideas, daily_application | Partial editorial draft (3/9) |
| Animal Farm — George Orwell | All nine toggle fields | Complete Hindi draft; awaits editorial approval and D1 parity |
| 100 Ways to Improve Your Writing — Gary Provost | All five nonempty toggle fields | Complete Hindi draft; awaits editorial approval and D1 parity |
| Remaining 496 | None in this batch | Pending |

Drafts: [Atomic Habits](../drafts/en-hi-batch-001/atomic-habits.partial.hi.json), [The Psychology of Money](../drafts/en-hi-batch-001/psychology-of-money.partial.hi.json), [Animal Farm](../drafts/en-hi-batch-001/animal-farm.complete-draft.hi.json), [100 Ways to Improve Your Writing](../drafts/en-hi-batch-001/100-ways-to-improve-your-writing.complete-draft.hi.json).

## Import gates
1. Complete the exact nonempty source fields for each book (`overview`, `deep_summary`, `key_ideas`, `deep_analysis`, `daily_application`, `action_system`, `practice_tracker`, `reflection_questions`, `real_life_example`). Do not shorten long sections into overviews.
2. Independently review Hindi fidelity, book-specific details, Markdown headings, access tiers and source alignment.
3. Reconcile the current Cloudflare D1 source with the Supabase snapshot. The D1 database was blocked by its free-tier daily row-read limit at extraction time; a Supabase snapshot alone does not establish the Worker SHA-256 source hash.
4. Convert only fully reviewed documents with `scripts/prepare-reviewed-translation.mjs`, import to the correct D1 database, and read back the saved values.
5. Verify PR #92 staging Worker routing/assets, then signed-in EN → HI → EN behavior for free/premium readers before publication.

## Editorial principles
- No translation AI API or runtime translation service.
- Do not copy source English into a Hindi slot, reuse another book or fill with generic content.
- Partial drafts are **not approved, importable or live**. A missing translation must not be advertised as ready.
- Preserve source IDs; do not create duplicate Hindi catalog books merely to implement the toggle.
