# Cover studio

Makes 800×1200 Booknomics covers. The default **`summary` layout** matches the covers already
on the site (`public/book-covers/`, Supabase `book-covers`):
- a cinematic character scene from the story
- a small `— BOOKNOMICS SUMMARY —` label
- a big heavy title: metallic gold on dark art, a deep ink colour on light art
- the author underneath

The older `classic` layout is still available per entry (`layout: "classic"`). It uses a
symbolic painting, a cream title and a BOOKNOMICS wordmark at the foot.

**The artwork is generated without any text, and the typography is set here in code.** Image
models regularly garble Devanagari conjuncts (क्त, श्र, ह्य, र्ब). Setting the text with
real fonts through sharp (pango + harfbuzz) means every title is spelled exactly as it
is in the `books` table.

```
manifest.json ──► prompts.mjs ──► AI artwork (text-free) ──► compose.mjs ──► qa.mjs / sheet.mjs ──► upload.mjs
 (one entry       (same prompt     ~/.cache/cover-art/        <slug>.webp      duplicates +         Supabase
  per book)        recipe)         <key>.png                  800×1200         contact sheet        book-covers
```

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
| `font` | `martel eczar notoserif mukta laila rozha yatra khand kalam amita tiro` (Devanagari + Latin; the first five use their heaviest cut in the summary layout), `cinzel playfair cormorant oswald teko` (Latin only) |
| `layout` | `summary` (default, site style) or `classic` |
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
