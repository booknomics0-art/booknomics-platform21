# Hindi section — story covers

Covers for the books on booknomics.com/hindi (`language = hi`, published, not draft) that
had **no cover** when the catalogue was checked on 2026-10-09. Books that already have a
cover are left alone.

## Style: same as the covers already on the site

Built to match the existing covers in `public/book-covers/` and the Supabase `book-covers`
bucket (गबन, देवदास, परिणीता, …):

- a cinematic, photorealistic scene with the story's characters at a key moment
- a small `— BOOKNOMICS SUMMARY —` label at the top
- a big, heavy Devanagari title: metallic gold on dark art, a deep ink colour on light art
- the author's name underneath

**Every book gets its own theme colour**, such as light, dark, blue, yellow, red or green, and
its own scene from its story. Both are recorded per book in `manifest.json` (`theme`,
`palette`, `concept`).

The artwork is AI-generated without text. The title, author and label are set by
`tools/cover-studio/compose.mjs`, so the Devanagari matches the database exactly.

Format: 800×1200 WebP (2:3, what `BookCard` renders). `<slug>.webp` matches `books.slug`.
`_preview-latest.jpg` is a contact sheet of the latest batch, for review only, and is never uploaded.

## Progress

| | Books | Status |
|---|---|---|
| Samples in the site style | 3 | done: गोदान (yellow · light), काबुलीवाला (blue · dark), घरे-बाइरे (red · dark) |
| Narendra Kohli (10) | 10 | first made in an earlier symbolic style; **to be redone** in the site style (old versions are in commit `b979135`) |
| Other Devanagari titles: classics, Tagore, Khatri, Rahul, pulp, … | 90 | pending |
| Regional-literature summaries with Latin titles in the DB (`भारतीय क्षेत्रीय साहित्य · …`) | ~589 | not in the manifest yet. **The title will be written in Devanagari on the cover** |

`node tools/cover-studio/prompts.mjs --stats` gives the live count. The image tool makes up to 10
artworks per working session, so the set is built in batches.

Skipped on purpose:
- **चित्रा**: a cover already exists (`../chitra-cover.jpg`). It only needs uploading.
- Every book whose `cover_url` is already set, including Premchand's novels.
  गोदान already has a cover too, so the one here is a sample and optional.

## Uploading

**One at a time:** Admin → find the book → **HD Cover** (cloud icon) → pick `<slug>.webp`.

**All finished covers at once:**

```bash
cd tools/cover-studio && npm install
node upload.mjs                                   # dry run: lists what would change
SUPABASE_SERVICE_ROLE_KEY=… node upload.mjs --apply
```

It only fills books whose `cover_url` is still empty. To use the new गोदान cover instead of the
current one: `node upload.mjs --apply --force --only godan`.
