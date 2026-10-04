# Cover Forge

Deterministic book-cover generator for Booknomics. Renders **800×1200 (exact 2:3)
progressive JPEG** covers — the ratio `BookCard.tsx` renders — for any number of
books, in seconds per cover, with no per-cover API cost.

```
tools/cover-forge/
├── generate.mjs      batch renderer  -> covers/<slug>.jpg + covers/manifest.json
├── check.mjs         quality gate    -> sizes, blanks, overflow, near-duplicates
├── upload.mjs        Supabase push   -> storage + books.cover_url
├── fetch-fonts.mjs   copies the 8 OFL fonts into ./fonts (offline afterwards)
├── sheet.mjs         contact sheet for visual review
├── src/              layout engine (templates, motifs, palettes, text fitting)
├── fonts/            8 committed OFL TTFs, no network needed at render time
└── covers/           generated output (git-ignored)
```

## Install

```sh
cd tools/cover-forge
npm install
node fetch-fonts.mjs     # once: node_modules -> ./fonts
```

## Use

```sh
# 24 covers from the content-drafts list, into ./covers
node generate.mjs --drafts ../../content-drafts --out covers

# the whole catalog
node generate.mjs --drafts ../../content-drafts --out covers --all --concurrency 8

# only the books that have no cover in the database yet
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node generate.mjs --from-db --out covers --all

# 1200 books per machine, sharded four ways
node generate.mjs --from-db --all --out covers --offset 0    --limit 300
node generate.mjs --from-db --all --out covers --offset 300  --limit 300

# review before shipping
node sheet.mjs covers preview/contact-sheet.jpg 6
node check.mjs --out covers --drafts ../../content-drafts --deep

# publish (dry run first, then --apply)
node upload.mjs --manifest covers/manifest.json
node upload.mjs --manifest covers/manifest.json --apply --skip-existing
```

`--dry-run` and `--emit-prompts art-prompts.json` need no output directory.
`--resume` skips covers that already exist on disk. `--seed 7` regenerates the
whole set with different compositions. `--template`, `--palette` and `--motif`
force a specific look (useful for A/B testing a single design).

## Two tracks

**Track A — procedural (default, works today).** Vector motif + typography +
palette, composed per book from the book's own metadata. ~0.3 s per cover,
no external service, no licensing risk, output is tiny (avg 47 KB).

**Track B — AI artwork + the same typography.** Generate one text-free
illustration per book with an image model (`--emit-prompts` writes the prompts),
drop the files in a folder as `<slug>.jpg`, then render with
`--art-dir art/`. The `photo` template puts the finished lettering over the
artwork with a scrim, so the AI never draws text (the reason the current
`grok-2-image` covers come out with broken lettering). Mixing both tracks is
fine: books without artwork keep the procedural design.

## How a cover is composed

| Stage | Rule |
| --- | --- |
| Canvas | 800×1200, rendered at 2× and downscaled (supersampled), JPEG q88 progressive, mozjpeg, 4:4:4 |
| Palette | 14 curated palettes, chosen by category (poetry warm, prose cool, essays mono, …) and cycled by index across the catalog so colours stay evenly spread |
| Motif | 20 procedural drawings (chakra, diya, lotus, mountains, moon phases, seigaiha, eye, bauhaus grid, …); index × 7 so it never repeats the neighbouring cover |
| Template | 8 layouts (band, classic, arch, split, poster, minimal, side, photo), cycled per book |
| Text | Title + author + category + BOOKNOMICS wordmark, in Noto Serif/Sans Devanagari for Hindi and Fraunces/EB Garamond/Inter for English |
| Fitting | Advance-width wrapping with an 6% safety factor for Devanagari, shrinking 110→52 px until it fits the box; `--deep` re-measures the *rendered* ink |
| Grain | Light paper-grain overlay (disable with `--no-grain`) |

Determinism: the same book always produces the same cover unless `--seed`
changes. That is what makes the manifest, the checks and the sharding useful.

## Quality gate

`check.mjs` fails the batch when a cover is

- not 800×1200 JPEG, or larger than `--max` KB (default 300),
- blank (greyscale stdev < 8),
- missing the title in the rendered SVG, or carrying a different title than the catalog,
- using glyphs the font cannot draw (tofu boxes),
- overflowing its text box — with `--deep`, the renderer measures real ink width.

It warns (not fails) on near-identical covers, non-progressive files, titles
that had to shrink to the minimum, and coverage gaps against the source list.

## Notes

- Generated covers are marked in the manifest with palette/template/motif ids,
  so any cover can be reproduced or tweaked individually.
- The manifest is the input to `upload.mjs`; nothing is written to Supabase
  without `--apply`.
- Uploads go to the `book-covers` bucket under `covers/<slug>.jpg` and set
  `books.cover_url` to the public URL. The app rewrites Supabase URLs to
  `/render/image/public/...?width=…&format=webp`, so the delivered WebP is
  ~15 KB per card.
- Fonts are Google Fonts under the SIL Open Font License (see `fonts/LICENSES.md`).
