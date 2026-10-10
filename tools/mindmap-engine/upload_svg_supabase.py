#!/usr/bin/env python3
"""Upload vector SVG mind maps and set book_assets.mindmap_url.

Use --catalog-json when available so the upload stage does not query the books
catalog again. Existing mindmap_url rows are skipped. Upload concurrency and
DB reads are deliberately bounded for the Supabase Free project.
"""
from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from upload_supabase import (
    BUCKET,
    ensure_bucket,
    fetch_books,
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
        url, key, "POST", f"/storage/v1/object/{BUCKET}/{path}",
        body=data, content_type="image/svg+xml; charset=utf-8", extra=extra, timeout=180,
    )
    if code >= 400:
        code, raw, _ = rest(
            url, key, "PUT", f"/storage/v1/object/{BUCKET}/{path}",
            body=data, content_type="image/svg+xml; charset=utf-8", extra=extra, timeout=180,
        )
    if code >= 400:
        raise RuntimeError(f"storage SVG upload {code}: {raw[:500]!r}")
    return public_url(url, path)


def load_catalog(path: str, lang: str) -> list[dict]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = payload if isinstance(payload, list) else payload.get("books", [])
    return [
        row for row in rows
        if isinstance(row, dict)
        and row.get("id") and row.get("slug")
        and str(row.get("language") or lang).lower() == lang
    ]


def fetch_existing_maps_safe(url: str, key: str) -> dict[str, str]:
    out: dict[str, str] = {}
    start = 0
    page = 250
    while True:
        batch = None
        for attempt in range(1, 6):
            try:
                code, raw, _ = rest(
                    url,
                    key,
                    "GET",
                    "/rest/v1/book_assets?select=book_id,mindmap_url",
                    extra={"Range": f"{start}-{start + page - 1}"},
                    timeout=60,
                )
                if code >= 500:
                    raise RuntimeError(f"book_assets temporary HTTP {code}: {raw[:160]!r}")
                if code >= 400:
                    raise RuntimeError(f"book_assets fetch HTTP {code}: {raw[:300]!r}")
                batch = json.loads(raw.decode("utf-8") or "[]")
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 5:
                    raise
                delay = attempt * 2
                print(f"book_assets range {start}: retry {attempt}/5 after {exc}; sleep={delay}s", flush=True)
                time.sleep(delay)
        assert batch is not None
        for row in batch:
            if row.get("book_id") and row.get("mindmap_url"):
                out[row["book_id"]] = row["mindmap_url"]
        print(f"existing mindmaps scanned: {start + len(batch)} rows", flush=True)
        if len(batch) < page:
            break
        start += page
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--lang", choices=("en", "hi"), default="en")
    p.add_argument("--dir", required=True)
    p.add_argument("--catalog-json", help="Authoritative local book catalog; avoids re-reading books from Supabase")
    p.add_argument("--force", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--workers", type=int, default=2, help="Bounded upload workers (default 2; max 4)")
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

    books = load_catalog(args.catalog_json, args.lang) if args.catalog_json else fetch_books(url, key, args.lang)
    by_slug, by_core = index_books(books)
    existing = {} if args.force else fetch_existing_maps_safe(url, key)
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

    workers = max(1, min(args.workers, 4))
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
                if uploaded <= 5 or uploaded % 100 == 0 or uploaded == len(jobs):
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
