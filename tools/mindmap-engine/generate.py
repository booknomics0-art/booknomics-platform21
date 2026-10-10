#!/usr/bin/env python3
"""Booknomics English mind-map engine — render 300+ 16:9 PNGs in one run.

Usage:
  python generate.py --out ../../out/mindmaps
  python generate.py --out ../../out/mindmaps --limit 20
  python generate.py --json books.json --out ./pngs
  python generate.py --self-test

Does not invent plot facts. Thin catalog rows use genre reading-lenses,
not fake chapter claims. Extra JSON can overlay real summary fields.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from catalog import load_books  # noqa: E402
from content import build_mindmap  # noqa: E402
from render import render_mindmap  # noqa: E402


def slugify(title: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]


def self_test() -> int:
    books = load_books()
    assert len(books) >= 300, f"catalog too small: {len(books)}"
    sample = next(b for b in books if b["title"] == "Atomic Habits")
    m = build_mindmap(sample)
    assert len(m.branches) == 8, m.branches
    assert len(m.takeaways) == 5
    tmp = HERE / "_selftest.png"
    path = render_mindmap(m, tmp)
    assert path.exists() and path.stat().st_size > 20_000, path
    tmp.unlink(missing_ok=True)
    print(f"self-test ok  catalog={len(books)}  branches={len(m.branches)}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Render Booknomics 16:9 mind-map PNGs in batch.")
    p.add_argument("--out", default="../../out/mindmaps", help="Output folder for PNGs")
    p.add_argument("--json", dest="extra_json", help="Optional JSON list of books (merges/overrides catalog)")
    p.add_argument("--slugs-file", help="Text file of extra English /books/{slug}-summary lines")
    p.add_argument("--limit", type=int, default=0, help="Render only the first N books (0 = all)")
    p.add_argument("--skip-existing", action="store_true", help="Do not overwrite existing PNGs")
    p.add_argument("--manifest", action="store_true", help="Write manifest.json next to PNGs")
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()

    if args.self_test:
        return self_test()

    books = load_books(args.extra_json)
    if args.slugs_file:
        from extra_slugs import parse_english_slug
        seen = {b["slug"] for b in books}
        for line in Path(args.slugs_file).read_text(encoding="utf-8").splitlines():
            item = parse_english_slug(line.strip())
            if not item or item["slug"] in seen:
                continue
            seen.add(item["slug"])
            books.append(item)
    if args.limit and args.limit > 0:
        books = books[: args.limit]

    out = Path(args.out)
    if not out.is_absolute():
        out = (Path.cwd() / out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    print(f"Rendering {len(books)} English mind maps → {out}")
    t0 = time.time()
    ok = 0
    rows = []
    for i, book in enumerate(books, 1):
        slug = book.get("slug") or slugify(book.get("title") or f"book-{i}")
        dest = out / f"{slug}.png"
        if args.skip_existing and dest.exists():
            print(f"[{i}/{len(books)}] skip {slug}")
            ok += 1
            continue
        try:
            mind = build_mindmap(book)
            render_mindmap(mind, dest)
            ok += 1
            rows.append({"slug": slug, "title": book.get("title"), "author": book.get("author"), "category": book.get("category"), "file": dest.name})
            print(f"[{i}/{len(books)}] {slug}.png")
        except Exception as exc:  # noqa: BLE001 — batch must continue
            print(f"[{i}/{len(books)}] FAIL {slug}: {exc}", file=sys.stderr)

    elapsed = time.time() - t0
    if args.manifest:
        (out / "manifest.json").write_text(json.dumps({"count": ok, "books": rows}, indent=2), encoding="utf-8")
    print(f"Done {ok}/{len(books)} in {elapsed:.1f}s  ({elapsed / max(ok, 1):.2f}s each)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
