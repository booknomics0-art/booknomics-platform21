#!/usr/bin/env python3
"""Generate compact vector mind maps from an authoritative JSON book list."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from content import build_mindmap  # noqa: E402
from render_svg import render_mindmap_svg  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True, help="Authoritative JSON array of books")
    p.add_argument("--out", required=True)
    p.add_argument("--lang", choices=("en", "hi"), default="en")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--skip-existing", action="store_true")
    args = p.parse_args()

    payload = json.loads(Path(args.json).read_text(encoding="utf-8"))
    books = payload if isinstance(payload, list) else payload.get("books", [])
    books = [b for b in books if isinstance(b, dict) and b.get("slug")]
    if args.limit:
        books = books[: args.limit]
    if not books:
        raise SystemExit("No books found in JSON")

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    ok = failed = 0
    total_bytes = 0
    t0 = time.time()

    for i, raw in enumerate(books, 1):
        book = dict(raw)
        book["lang"] = args.lang
        slug = str(book["slug"]).strip().lower().strip("/")
        dest = out / f"{slug}.svg"
        if args.skip_existing and dest.exists():
            ok += 1
            total_bytes += dest.stat().st_size
            continue
        try:
            mind = build_mindmap(book)
            render_mindmap_svg(mind, dest)
            ok += 1
            total_bytes += dest.stat().st_size
            if i <= 5 or i % 250 == 0 or i == len(books):
                print(f"[{i}/{len(books)}] {dest.name} {dest.stat().st_size/1024:.1f} KB")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"FAIL {slug}: {exc}", file=sys.stderr)
            if failed >= 10:
                break

    elapsed = time.time() - t0
    print(f"done svg={ok}/{len(books)} failed={failed} size={total_bytes/1024/1024:.1f} MB time={elapsed:.1f}s")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
