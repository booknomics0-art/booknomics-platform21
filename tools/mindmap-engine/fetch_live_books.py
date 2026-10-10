#!/usr/bin/env python3
"""Fetch the exact published Booknomics catalog for mind-map generation.

This intentionally fetches only lean, factual identity fields plus tagline.
The mind-map engine fills missing detail with language/genre reading lenses,
never invented plot or chapter claims. Small pages + retries keep this reliable
on Supabase Free compute while other asset uploads are running.
"""
from __future__ import annotations

import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--lang", choices=("en", "hi"), required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--page", type=int, default=100)
    args = p.parse_args()

    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    fields = "id,slug,title,author,category,tagline,language"
    rows: list[dict] = []
    start = 0
    page = max(25, min(args.page, 200))

    while True:
        query = urllib.parse.urlencode({
            "select": fields,
            "language": f"eq.{args.lang}",
            "status": "eq.published",
            "is_draft": "eq.false",
            "order": "slug.asc",
        })
        batch = None
        for attempt in range(1, 7):
            try:
                req = urllib.request.Request(
                    f"{base}/rest/v1/books?{query}",
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                        "Range": f"{start}-{start + page - 1}",
                    },
                )
                with urllib.request.urlopen(req, timeout=45) as resp:
                    batch = json.loads(resp.read().decode("utf-8") or "[]")
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 6:
                    raise
                delay = min(20, attempt * 3)
                print(f"range {start}-{start+page-1}: retry {attempt}/6 after {type(exc).__name__}: {exc}; sleep={delay}s", flush=True)
                time.sleep(delay)

        assert batch is not None
        rows.extend(batch)
        print(f"{args.lang}: fetched {len(rows)} rows", flush=True)
        if len(batch) < page:
            break
        start += page

    if not rows:
        raise SystemExit(f"No published {args.lang} books returned")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"done: {len(rows)} published {args.lang} books -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
