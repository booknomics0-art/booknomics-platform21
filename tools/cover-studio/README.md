# Cover studio

Makes 800×1200 Booknomics covers in the house style of
`content-drafts/covers/raktakarabi-cover.jpg` and `chitra-cover.jpg`: a painterly,
story-specific illustration, a cream title in the top third, the author in gold
below it, and a letter-spaced BOOKNOMICS wordmark at the foot.

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

Artwork is read from `~/.cache/cover-art/<key>.png` (override with `--art-dir`). Raw art
is kept out of git on purpose, because only the composed WebP files are committed.

## Manifest fields

| Field | Meaning |
|---|---|
| `key` | short ASCII id; the art file is `<key>.png` |
| `id`, `slug` | `books.id` / `books.slug`; the output file is `<slug>.webp` |
| `title`, `author` | exactly as in the database |
| `authorDisplay`, `titleDisplay` | optional text shown on the cover instead (e.g. Devanagari for a Latin DB author) |
| `font` | `mukta muktaxb tiro rozha yatra khand eczar laila notoserif kalam amita martel` (Devanagari + Latin), `cinzel playfair cormorant oswald teko` (Latin only) |
| `mode` | `light` for pale artwork with dark type; default is auto (luminance of the top band) |
| `style` | `pulp` adds the noir pulp-thriller framing to the prompt |
| `palette`, `concept` | the theme colour and the story motif. Each book gets its own |
| `seam` | optional fraction of the height where the art has a hard horizontal edge, hidden under a soft gradient |
| `status` | `done` once composed; `uploadedUrl` / `uploadedAt` are written by `upload.mjs` |

## Upload safety

`upload.mjs` is a dry run unless `--apply` is passed. It skips every book that already
has a `cover_url`, and checks again just before writing, so covers that were already made
are never replaced. Use `--force --only <slug>` to replace one on purpose. Each file goes
to a new object `book-covers/hindi-story-covers/<book-id>/<timestamp>.webp`, which is
the same layout the Admin "HD Cover" button uses, under its own folder. Keys come
from the shell or the repo-root `.env` (git-ignored). Never commit them.
