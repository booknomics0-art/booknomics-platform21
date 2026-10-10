#!/usr/bin/env python3
"""Upload vector SVG mind maps and set book_assets.mindmap_url.

Designed for the English catalog: compact SVG assets avoid exhausting Supabase
Storage while remaining compatible with both the legacy image section and the
new Interactive/Illustrated mind-map UI.
"""
from __future__ import annotations

import argparse
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    p.add_argument("--workers", type=int, default=8, help="Bounded parallel upload workers (default 8)")
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

    matched = already = unmatched = 0
    jobs: list[tuple[Path, dict]] = []
    for svg in svgs:
        book = match_book(svg.stem, by_slug, by_core)
        if not book:
            unmatched += 1
            print(f"UNMATCHED {svg.name}")
            continue
        matched += 1
        if book["id"] in existing and not args.force:
            already += 1
            continue
        jobs.append((svg, book))

    if args.limit:
        jobs = jobs[: args.limit]

    if args.dry_run:
        for svg, book in jobs:
            print(f"DRY {svg.name} -> {book.get('slug')}")
        print(f"done matched={matched} pending={len(jobs)} already={already} unmatched={unmatched}")
        return 0

    workers = max(1, min(args.workers, 12))
    uploaded = failed = bytes_uploaded = 0
    t0 = time.time()

    def one(job: tuple[Path, dict]) -> tuple[str, int]:
        svg, book = job
        book_id = book["id"]
        dest = f"mindmaps/{args.lang}/{book_id}.svg"
        pub = upload_svg(url, key, dest, svg)
        upsert_mindmap(url, key, book_id, pub)
        return svg.name, svg.stat().st_size

    print(f"uploading {len(jobs)} missing SVGs with {workers} workers")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(one, job): job for job in jobs}
        for future in as_completed(futures):
            svg, book = futures[future]
            try:
                name, size = future.result()
                uploaded += 1
                bytes_uploaded += size
                if uploaded <= 5 or uploaded % 250 == 0 or uploaded == len(jobs):
                    print(f"OK {uploaded}/{len(jobs)}: {name} -> {book.get('slug')}")
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"FAIL {svg.name}: {exc}")
                if failed == 1:
                    print(f"::error::{exc}")

    print(
        f"done matched={matched} uploaded={uploaded} already={already} unmatched={unmatched} "
        f"failed={failed} bytes={bytes_uploaded} time={time.time()-t0:.1f}s"
    )
    if failed:
        return 1
    if jobs and uploaded == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
