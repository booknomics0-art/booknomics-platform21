# Cover studio

Makes 800×1200 Booknomics covers (JPG, quality 84, about 150 KB each; `.png` or `.webp` output also works). The default **`foil` layout** is the approved reference look
(the यशोधरा cover the user shared):
- a photorealistic film-still scene from the story. Every cover gets a film finish so it does not
  read as a glossy AI render: saturation ×0.93, fine monochrome grain (soft-light) and a gentle
  vignette. Set `grain: 0` per entry to switch the grain off.
- a big gold-foil title (deep ink colour on light art) in a high-contrast calligraphic face
- a thin rule with a lotus, then the author in ivory
- an open-book icon with BOOKNOMICS at the foot. It turns gold or ink depending on how dark the
  bottom of the art is.

Two other layouts are available per entry:
- `layout: "summary"`: the older site style, with a small `— BOOKNOMICS SUMMARY —` label at the top
  and no brand at the foot.
- `layout: "classic"`: a symbolic painting, a cream title and a wordmark.

Art that comes back as a 2:3 picture inside a square canvas with black pillarbox bars is trimmed
automatically.

**The artwork is generated without any text, and the typography is set here in code.** Image
models regularly garble Devanagari conjuncts (क्त, श्र, ह्य, र्ब). Setting the text with
real fonts through sharp (pango + harfbuzz) means every title is spelled exactly as it
is in the `books` table.

```
manifest.json ──► prompts.mjs ──► AI artwork (text-free) ──► compose.mjs ──► qa.mjs / sheet.mjs ──► upload.mjs
 (one entry       (same prompt     ~/cover-art-raw/           <slug>.webp      duplicates +         Supabase
  per book)        recipe)         <key>.png                  800×1200         contact sheet        book-covers
```

## The cover loop: every remaining cover in one run

`auto.mjs` does the whole job unattended, so the set does not have to be built 10 artworks at a time:

1. **plan**: reads every published Hindi book without a cover live from Supabase. For each one a text
   model writes one realistic scene from that book's own story (its characters, place and era, taken
   from the book's `overview`) and picks a colour theme from `THEMES` that suits the story. A theme used
   by any of the last six books is never picked again, so neighbouring covers never share a theme. Latin-titled regional books also get their Devanagari
   title and author (`titleDisplay`, `authorDisplay`).
2. **render**: generates each artwork with the OpenAI Images API (`gpt-image-1`, i.e. ChatGPT images,
   1024×1536) using the same prompt recipe as `prompts.mjs`, then composes the foil-layout cover with
   `compose.mjs`. The manifest is saved after every cover, so a stopped run continues where it left off.
   If moderation blocks a scene, the entry is marked `blocked` and the loop moves on.

```bash
cd tools/cover-studio && npm ci
OPENAI_API_KEY=… node auto.mjs all                  # plan + render everything that is left
node auto.mjs plan --dry                            # preview the scenes without writing
node auto.mjs render --limit 50 --concurrency 4     # 50 covers, 4 at a time
```

**On GitHub, no computer needed:** `.github/workflows/generate-hindi-covers.yml` runs the same loop. Add
the repository secret `OPENAI_API_KEY` once. Then either change `auto-run.json` on the branch and push
it, or use Actions → *Generate Hindi covers (AI loop)* → Run workflow once the workflow is on `main`.
The run commits the covers every 20 books and attaches all covers as a zip to the run.
Optional repository variables: `IMAGE_MODEL`, `IMAGE_QUALITY` (`low` | `medium` | `high`) and `TEXT_MODEL`.

## Setup

```bash
cd tools/cover-studio
npm install          # sharp + Google Fonts from npm (@expo-google-fonts/*)
```

Nothing here touches the site build. ESLint only checks `*.ts/tsx`, and the app's tsconfig only includes `src/`.

## Commands

| Step | Command |
|---|---|
| Progress | `node prompts.mjs --stats` |
| Prompts for the next N books | `node prompts.mjs --limit 10` (JSON lines: key, art path, prompt) |
| Compose every entry that has art | `node compose.mjs --batch` |
| Recompose specific books | `node compose.mjs --batch --only <slug or key>,… --force` |
| One-off cover | `node compose.mjs --art a.png --out x.webp --title "गोदान" --author "मुंशी प्रेमचंद" --font mukta` |
| Duplicate / palette check | `node qa.mjs` (exit code 1 if two covers look like duplicates) |
| Contact sheet | `node sheet.mjs out.jpg a.webp b.webp … --cols 6 --w 260` |
| Upload (dry run) | `node upload.mjs` |
| Upload for real | `SUPABASE_SERVICE_ROLE_KEY=… node upload.mjs --apply` |

Artwork is read from `~/cover-art-raw/<key>.png|webp|jpg` (override with `--art-dir` or
`COVER_ART_DIR`). Raw art is kept out of git on purpose, because only the composed WebP files are
committed. Keep it outside `~/.cache`, since that folder does not survive a sandbox restore.

Art that is wider than 2:3 (e.g. a square 1024² generation) is not cropped hard. It is scaled to
`H − extendTop` (170 px by default), and the sky is continued upward with a feathered blend.

## Manifest fields

| Field | Meaning |
|---|---|
| `key` | short ASCII id; the art file is `<key>.png` |
| `id`, `slug` | `books.id` / `books.slug`; the output file is `<slug>.webp` |
| `title`, `author` | exactly as in the database |
| `authorDisplay`, `titleDisplay` | optional text shown on the cover instead (e.g. Devanagari for a Latin DB author) |
| `font` | foil layout: `vesper` (default), `vesperxb sahitya kadwa sura martel rozha tillana tiro`. `rozha` is swapped for `vesper` when the title has इ, because its इ reads like ड़. Other layouts: `martel eczar notoserif mukta laila rozha yatra khand kalam amita tiro` (Devanagari + Latin), `cinzel playfair cormorant oswald teko` (Latin only) |
| `layout` | `foil` (default, approved look), `summary` or `classic` |
| `mode` | `light` for pale artwork with ink-coloured type, `dark` for gold type. Default is auto (luminance of the top band) |
| `theme` | the cover's colour family, e.g. `yellow · light`, `blue · dark`, `red · dark`. Kept different from book to book |
| `ink` | title colour on light art (default: a deep shade of the sky's hue) |
| `extendTop` | px of sky to add above wide art (0 = plain cover crop) |
| `style` | `pulp` adds the noir pulp-thriller framing to the prompt |
| `palette`, `concept` | the theme colour and the story motif. Each book gets its own |
| `seam` | optional fraction of the height where the art has a hard horizontal edge, hidden under a soft gradient |
| `status` | `done` once composed, `redo` if it must be remade. `uploadedUrl` / `uploadedAt` are written by `upload.mjs` |

## Upload safety

`upload.mjs` is a dry run unless `--apply` is passed. It skips every book that already
has a `cover_url`, and checks again just before writing, so covers that were already made
are never replaced. Use `--force --only <slug>` to replace one on purpose. Each file goes
to a new object `book-covers/hindi-story-covers/<book-id>/<timestamp>.webp`, which is
the same layout the Admin "HD Cover" button uses, under its own folder. Keys come
from the shell or the repo-root `.env` (git-ignored). Never commit them.
