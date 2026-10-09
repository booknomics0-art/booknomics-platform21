# Book covers

800x1200 JPEG, exactly the 2:3 ratio `BookCover` renders. See
`ANALYSIS-existing-covers.md` for why that ratio is non-negotiable.

| File | Book | Size |
|---|---|---|
| `raktakarabi-cover.jpg` | रक्तकरबी — रवींद्रनाथ ठाकुर | 165 KB |
| `chitra-cover.jpg` | चित्रा — रवींद्रनाथ ठाकुर | 139 KB |

## What changed in v2

The first pass had no text. That was wrong for three reasons, all of which came
out of the analysis:

1. `image-sitemap.xml` lists every cover, so these images surface in Google
   Images on their own, with no page text beside them.
2. Shared to WhatsApp or Pinterest, a coverless illustration reads as stock art
   rather than a book.
3. Real book covers carry their title. Without it the card looks unfinished.

So each cover now carries the title in Devanagari, the author below it, and a
small BOOKNOMICS wordmark at the foot. The Devanagari was checked by cropping
and zooming into the title band on both files: रक्तकरबी and चित्रा both render
correctly, with the क्त conjunct intact.

## Why the middle is kept clear

`BookCard.tsx` line 54 uses `object-contain`, not `object-cover`. Nothing gets
cropped, but anything that is not 2:3 gets letterboxed. These are built at the
exact ratio, and the artwork leaves the upper third free so the title never
fights the illustration.

## Upload

Use the upload (cloud) button in the Admin book row, not the sparkle generator.
That stores the file in the `book-covers` bucket, which is what gives you the
automatic WebP transform:

    /render/image/public/...?width=W&height=H&resize=cover&quality=78&format=webp

Avoid external URLs. 15 of the current covers point at Google Books or
OpenLibrary and can break without warning.

## Design notes

- **रक्तकरबी** — a red oleander pushing up through scrap iron, the exact image
  Tagore saw in Shillong that started the play. The faint lattice behind the
  title is the screen the king hides behind.
- **चित्रा** — a mirror split between moonlight and gold. The left reflection
  shows a bow (her warrior self, कुरूपा), the right a jasmine garland (the
  borrowed beauty, सुरूपा).

## Batch 1 (2026-10-09): Godan and English library

Same spec: 800x1200 JPEG, 2:3. Each cover has its own colour theme and a motif
taken from the book's story, so no two covers share a palette or artwork. Title,
author and the BOOKNOMICS wordmark are set on the artwork. Layout follows the two
covers above.

| File | Book | Author | Colour theme |
|---|---|---|---|
| `godan-cover.jpg` | गोदान | मुंशी प्रेमचंद | Ochre gold on dusk brown |
| `deep-work-cover.jpg` | Deep Work | Cal Newport | Charcoal and cyan |
| `educated-cover.jpg` | Educated | Tara Westover | Ivory and amber (light) |
| `hooked-cover.jpg` | Hooked | Nir Eyal | Black and magenta |
| `influence-cover.jpg` | Influence | Robert B. Cialdini | Violet and silver |
| `nudge-cover.jpg` | Nudge | Richard H. Thaler & Cass R. Sunstein | Peach and teal (light) |
| `the-100-startup-cover.jpg` | The $100 Startup | Chris Guillebeau | Emerald and copper |
| `the-e-myth-cover.jpg` | The E-Myth Revisited | Michael E. Gerber | Cobalt blueprint |
| `the-one-thing-cover.jpg` | The ONE Thing | Gary Keller & Jay Papasan | Sunflower yellow and black |
| `the-tipping-point-cover.jpg` | The Tipping Point | Malcolm Gladwell | Steel grey and ember |
| `thinking-fast-and-slow-cover.jpg` | Thinking, Fast and Slow | Daniel Kahneman | Split teal-blue and tangerine |

Not yet uploaded to the `book-covers` bucket. Upload through the Admin book row
(cloud button), as described above.
