# Cover worker

Local batch renderer for book covers. It follows the same pattern as `tools/audio-worker`: one run, up to 100 covers, no paid API and no API key.

Each cover is drawn in code: shapes, gradients and film grain, with the title, author and BOOKNOMICS wordmark set in Playfair Display and Inter. Every book gets its own colour theme, so no two covers share a palette.

**Style.** These covers are graphic and procedural. They are not painted in the style of `content-drafts/covers/raktakarabi-cover.jpg`. A local AI image model needs weights from outside the sandbox, so that route is not available here.

## Setup (once)

```bash
cd tools/cover-worker
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
./fetch_fonts.sh
```

`fetch_fonts.sh` downloads Playfair Display and Inter (SIL Open Font License) from the npm registry into `./fonts`. The `.venv` and `fonts` folders are git-ignored.

## Run

```bash
.venv/bin/python worker.py \
  --queue covers_queue_en.json \
  --out ../../content-drafts/covers/batch-en
```

Each run writes `<slug>-cover.jpg` (800x1200, under 300 KB) and `manifest.csv`. It stops if two books produce the same image. Use `--only slug-one slug-two` to render a few books.

## Queue format

`covers_queue_en.json` has a `books` list, with at most 100 entries per run.

```json
{"slug": "atomic-habits", "title": "Atomic Habits", "author": "James Clear",
 "motif": "grid", "layout": "top", "font": "sans", "mode": "light",
 "params": {"n": 6, "pattern": "stairs"}}
```

| Field | Values |
|---|---|
| `layout` | `top`, `bottom`, `center`, `left` |
| `font` | `serif` (Playfair Display) or `sans` (Inter) |
| `mode` | `dark` or `light` |
| `hue` | optional. Default: golden-angle spacing by position, so neighbouring books never share a colour |
| `motif` | `rings`, `ring`, `dots`, `waves`, `spiral`, `grid`, `stairs`, `peaks`, `rays`, `bars`, `tree`, `loop`, `path`, `eye`, `flame`, `coins`, `wings`, `petals`, `windmill`, `moon`, `shards`, `split`, `crown`, `beam`, `columns`, `iceberg`, `heartbeat`, `arch`, `strokes`, `fade`, `glyph_zero_one`, `eclipse` |

Some motifs take options in `params`. `grid` takes `pattern` (`stairs`, `checklist` or `quad`), `stairs` takes `pyramid` or `ladder`, and `path` takes `zigzag` or `obstacles`.

## Before upload

- The worker writes files only. Upload them through the Admin book row (cloud button), as described in `../../content-drafts/covers/README.md`.
- Titles and authors come from the repo catalogue. Check them against the database before upload.
