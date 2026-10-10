#!/usr/bin/env python3
"""Upload vector SVG mind maps and set book_assets.mindmap_url.

Designed for the English catalog: compact SVG assets avoid exhausting Supabase
Storage while remaining compatible with both the legacy image section and the
new Interactive/Illustrated mind-map UI.
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

from upload_supabase import (
    BUCKET,
    ensure_bucket,
    fetch_books,
    fetch_existing_maps,
    index_books,
    match_book,
    public_url,
    require_env,
    rest,
    upsert_mindmap,
)


def upload_svg(url: str, key: str, path: str, svg: Path) -> str:
    data = svg.read_bytes()
    extra = {"x-upsert": "true", "cache-control": "31536000"}
    code, raw, _ = rest(
        url,
        key,
        "POST",
        f"/storage/v1/object/{BUCKET}/{path}",
        body=data,
        content_type="image/svg+xml; charset=utf-8",
        extra=extra,
        timeout=180,
    )
    if code >= 400:
        code, raw, _ = rest(
            url,
            key,
            "PUT",
            f"/storage/v1/object/{BUCKET}/{path}",
            body=data,
            content_type="image/svg+xml; charset=utf-8",
            extra=extra,
            timeout=180,
        )
    if code >= 400:
        raise RuntimeError(f"storage SVG upload {code}: {raw[:500]!r}")
    return public_url(url, path)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--lang", choices=("en", "hi"), default="en")
    p.add_argument("--dir", required=True)
    p.add_argument("--force", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    folder = Path(args.dir).resolve()
    svgs = sorted(folder.glob("*.svg"))
    if not svgs:
        raise SystemExit(f"No SVG files in {folder}")

    url, key = require_env()
    if key.startswith("sb_publishable"):
        raise SystemExit("Service-role/secret Supabase key required")
    ensure_bucket(url, key)

    books = fetch_books(url, key, args.lang)
    by_slug, by_core = index_books(books)
    existing = {} if args.force else fetch_existing_maps(url, key)
    print(f"{len(svgs)} SVGs, {len(books)} catalog rows, {len(existing)} existing maps")

    matched = uploaded = already = unmatched = failed = 0
    bytes_uploaded = 0
    t0 = time.time()
    for svg in svgs:
        book = match_book(svg.stem, by_slug, by_core)
        if not book:
            unmatched += 1
            print(f"UNMATCHED {svg.name}")
            continue
        matched += 1
        book_id = book["id"]
        if book_id in existing and not args.force:
            already += 1
            continue
        dest = f"mindmaps/{args.lang}/{book_id}.svg"
        if args.dry_run:
            print(f"DRY {svg.name} -> {book.get('slug')}")
            if args.limit and matched >= args.limit:
                break
            continue
        try:
            pub = upload_svg(url, key, dest, svg)
            upsert_mindmap(url, key, book_id, pub)
            uploaded += 1
            bytes_uploaded += svg.stat().st_size
            if uploaded <= 5 or uploaded % 250 == 0:
                print(f"OK {uploaded}: {svg.name} -> {book.get('slug')}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"FAIL {svg.name}: {exc}")
            if failed == 1:
                print(f"::error::{exc}")
            if failed >= 5:
                print("aborting after 5 failures")
                break
        if args.limit and uploaded >= args.limit:
            break

    print(
        f"done matched={matched} uploaded={uploaded} already={already} unmatched={unmatched} "
        f"failed={failed} bytes={bytes_uploaded} time={time.time()-t0:.1f}s"
    )
    if failed:
        return 1
    if not args.dry_run and matched and uploaded == 0 and already == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
