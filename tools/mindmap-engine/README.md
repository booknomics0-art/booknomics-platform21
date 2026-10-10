# Booknomics mind-map engine

Python batch renderer for **16:9 PNG Visual Knowledge Maps**. Built to generate **300+ English books** and **Hindi Devanagari maps** in one command, with real type (Pillow + HarfBuzz) — not AI image text.

This is **not** the disabled `generate-batch*.cjs` content mill. It does not invent chapter plots. Thin catalog rows use honest genre reading-lenses. Overlay real `overview` / `key_ideas` via JSON when you have them.

## Install

```bash
pip install -r tools/mindmap-engine/requirements.txt
```

## Render everything

From the repo root:

```bash
python tools/mindmap-engine/generate.py --out out/mindmaps --manifest
python tools/mindmap-engine/generate.py --lang hi --out out/mindmaps-hi --manifest
```

Useful flags:

| Flag | Meaning |
|---|---|
| `--limit 20` | First N books only |
| `--skip-existing` | Resume a long run |
| `--json path.json` | Merge/override catalog (title, author, category, overview, key_ideas, …) |
| `--slugs-file path.txt` | Merge more `/books/{slug}-summary` lines |
| `--self-test` | Catalog size + one PNG smoke test |

## JSON overlay shape

```json
[
  {
    "title": "Atomic Habits",
    "author": "James Clear",
    "category": "Self-Help",
    "tagline": "Tiny changes, remarkable results.",
    "overview": "…",
    "key_ideas": "- Identity first — …\n- Four Laws — …",
    "daily_application": "- Pick one identity sentence."
  }
]
```

## Output

Each PNG is **2560×1440** (16:9): hero, 8 genre-colored branches, quick recall, `booknomics` mark.

Default English catalog is the seed plus extra ASCII `*-summary` slugs from the live Booknomics sitemap (`extra_slugs.py` + `data/batch*.txt`). Hindi (`--lang hi`) uses Devanagari Noto fonts, HarfBuzz shaping, and `hindi_slugs.py` + `data/hindi*.txt` (`*-saransh`, Devanagari titles). Thin rows use genre reading-lenses; overlay real notes via `--json` when you have them.
