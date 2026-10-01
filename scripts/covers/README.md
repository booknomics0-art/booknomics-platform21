# Cover engine — 450 Hindi books

Deterministic generator for the Booknomics cover set in
`content-drafts/covers-450/` (450 JPEGs, 800×1200, avg ~90 KB).

## Why an engine, not 450 one-off images

The two hand-made covers in `content-drafts/covers/` set the standard
(painted art + Devanagari title + author + BOOKNOMICS wordmark, exact 2:3
because `BookCard.tsx` uses `object-contain`). Scaling that standard to 450
books by hand is not reproducible or reviewable, so the standard was encoded:

| Axis | Space | Rule |
|---|---|---|
| Composition archetype | 15 (dawn_village, moon_river, diya_night, monsoon_tree, mist_mountains, lotus_pond, jharokha_arch, wheat_noon, ink_brush, deco_city, warli_folk, sufi_stars, ember_pyre, block_print, minimal_wave) | one per book-pair |
| Colour palette (tone) | 30 hand-picked families | 15 × 30 = 450 unique (archetype, palette) pairs — no two books share style *and* tone |
| Devanagari display face | 6 (Rozha One, Yatra One, Tiro Devanagari, Martel Bold, Khand Bold, Hind Bold) | seeded per book |
| Text layout | 5 (top, bottom, topleft, framed, band) | seeded per book, weights 42/20/14/12/12 |
| Noise, motifs, texture | per-book seed (`crc32(slug)`) | same slug ⇒ same cover, forever |

## Devanagari shaping

Pillow wheels ship **without libraqm**, so `ImageDraw.text` renders Devanagari
unshaped (क्त → क + ् + त). The engine therefore shapes with **uharfbuzz** and
rasterises with **freetype-py** (`ShapedFont.render_line`). Conjuncts, matras
and nukta forms are correct; latin/digits fall back to DejaVu Sans Bold per
run. Fonts in `fonts/` are OFL (Google Fonts).

## Legibility rules (from content-drafts/covers/ANALYSIS-existing-covers.md)

* exact 800×1200, JPEG q86 progressive, ≤300 KB
* title + author + small BOOKNOMICS wordmark on every cover
* the text layout is chosen **before** the art, and the art receives a `focal`
  zone so suns/moons/spirals never sit behind the title band
* every text block samples the luminance behind *itself* (`pick_ink`) and picks
  dark or light ink, with a soft shadow (light ink) or halo (dark ink)

## Commands

```bash
pip install --user --break-system-packages pillow numpy uharfbuzz freetype-py

python3 scripts/covers/generate_covers.py --sample 12   # preview + contact sheet
python3 scripts/covers/generate_covers.py --all         # full 450 + INDEX.csv
python3 scripts/covers/qa_covers.py                     # QA gate (exit 0 = pass)
```

Book data is parsed from `content-drafts/*.txt` (both header formats: the
`#BOOK_START` field block and the early `# title / ## author` markdown drafts).
Filenames are ASCII slugs produced by a faithful port of
`src/lib/seoSlugTools.ts` + `bookParser.slugify`, so they line up with the
existing `public/book-covers/<slug>-saransh.webp` naming.

`INDEX.csv` maps slug → title/author/category → archetype/palette/font/layout
→ file. `_overview_450.jpg` is the whole wall at a glance.

## Upload

Per the covers analysis: use the Admin row's cloud upload (Supabase
`book-covers` bucket) so the WebP transform applies — not external URLs.
