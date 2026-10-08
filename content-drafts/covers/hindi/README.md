# Hindi section — story covers

Covers for the books on booknomics.com/hindi (`language = hi`, published, not draft) that
had **no cover** when the catalogue was checked on 2026-10-09. Books that already have a
cover are left alone.

- Every cover has **its own theme colour and a motif from that book's story**. Both are
  recorded per book in `manifest.json` (`palette`, `concept`).
- Artwork is AI-generated without text. Title, author and the BOOKNOMICS mark are set by
  `tools/cover-studio/compose.mjs`, so the Devanagari matches the database exactly.
- Format: 800×1200 WebP (2:3, what `BookCard` renders), about 70–180 KB each.
  `<slug>.webp` matches `books.slug`.
- `_preview-latest.jpg` is a contact sheet of the latest batch, for review only. It is not uploaded.

## Progress

| Group | Books | Done |
|---|---|---|
| Sample: गोदान (already had a cover, so this one is optional) | 1 | 1 |
| Devanagari titles: classics, Kohli, Tagore, Khatri, Rahul, essays | 52 | 10 |
| Devanagari titles: pulp (Pathak, Ved Prakash Sharma, Kamboj, Om Prakash Sharma) | 50 | 0 |
| Regional-literature summaries with Latin titles (`भारतीय क्षेत्रीय साहित्य · …`) | ~589 | not in the manifest yet |

`node tools/cover-studio/prompts.mjs --stats` gives the live count for the manifest.

Skipped on purpose:
- **चित्रा**: a cover was already made (`../chitra-cover.jpg`). It only needs uploading.
- Every book whose `cover_url` is set. That includes all of Premchand's novels (गोदान,
  गबन, निर्मला, कर्मभूमि, रंगभूमि, सेवासदन), which already have covers.

## Uploading

**One at a time:** Admin → find the book → **HD Cover** (cloud icon) → pick `<slug>.webp`.

**All finished covers at once:**

```bash
cd tools/cover-studio && npm install
node upload.mjs                                   # dry run: lists what would change
SUPABASE_SERVICE_ROLE_KEY=… node upload.mjs --apply
```

It only fills books whose `cover_url` is still empty. To use the new गोदान cover instead of
the current one: `node upload.mjs --apply --force --only godan`.
