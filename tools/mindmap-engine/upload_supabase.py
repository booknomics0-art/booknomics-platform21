#!/usr/bin/env python3
"""Upload rendered mind-map PNGs into Supabase storage + book_assets.mindmap_url.

Matches local `{slug}.png` files to live `books.slug` rows (with/without
`-summary` / `-hindi-summary` / `-saransh`). Uploads to the public
`book-assets` bucket and upserts only `mindmap_url` so audio/quiz rows stay.

Does not invent books. Unmatched PNGs are skipped.
# Trigger: repository secret SUPABASE_SERVICE_ROLE_KEY.

  SUPABASE_URL=https://….supabase.co \\
  SUPABASE_SERVICE_ROLE_KEY=… \\
  python upload_supabase.py --lang hi --dir ../../out/mindmaps-hi

  python upload_supabase.py --lang hi --dir ../../out/mindmaps-hi --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUFFIXES = ("-hindi-summary", "-saransh", "-summary")
BUCKET = "book-assets"


def env_url() -> str:
    return (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")


def env_key() -> str:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""


def require_env() -> tuple[str, str]:
    url, key = env_url(), env_key()
    missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
    if missing:
        raise SystemExit(
            "Missing " + ", ".join(missing) + ". Set them in the environment "
            "(GitHub Actions secrets, never commit the service role key)."
        )
    return url, key


def core_slug(slug: str) -> str:
    s = (slug or "").strip().lower().strip("/")
    s = urllib.parse.unquote(s)
    for suf in SUFFIXES:
        if s.endswith(suf):
            return s[: -len(suf)]
    if s.endswith("-सारांश"):
        return s[: -len("-सारांश")]
    return s


def rest(
    url: str,
    key: str,
    method: str,
    path: str,
    *,
    body: bytes | None = None,
    content_type: str = "application/json",
    extra: dict[str, str] | None = None,
    timeout: int = 120,
) -> tuple[int, bytes, dict[str, str]]:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type,
    }
    if extra:
        headers.update(extra)
    req = urllib.request.Request(f"{url}{path}", data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), dict(exc.headers)


def fetch_books(url: str, key: str, lang: str | None) -> list[dict]:
    rows: list[dict] = []
    start = 0
    page = 1000
    while True:
        qs = ["select=id,slug,language,title", "order=slug"]
        if lang in {"en", "hi"}:
            qs.append(f"language=eq.{lang}")
        code, raw, hdrs = rest(
            url,
            key,
            "GET",
            "/rest/v1/books?" + "&".join(qs),
            extra={"Range": f"{start}-{start + page - 1}", "Prefer": "count=exact"},
        )
        if code >= 400:
            raise SystemExit(f"books fetch failed {code}: {raw[:400]!r}")
        batch = json.loads(raw.decode("utf-8") or "[]")
        rows.extend(batch)
        if len(batch) < page:
            break
        start += page
    return rows


def fetch_existing_maps(url: str, key: str) -> dict[str, str]:
    out: dict[str, str] = {}
    start = 0
    page = 1000
    while True:
        code, raw, _ = rest(
            url,
            key,
            "GET",
            "/rest/v1/book_assets?select=book_id,mindmap_url",
            extra={"Range": f"{start}-{start + page - 1}"},
        )
        if code >= 400:
            raise SystemExit(f"book_assets fetch failed {code}: {raw[:400]!r}")
        batch = json.loads(raw.decode("utf-8") or "[]")
        for row in batch:
            if row.get("book_id") and row.get("mindmap_url"):
                out[row["book_id"]] = row["mindmap_url"]
        if len(batch) < page:
            break
        start += page
    return out


def index_books(books: list[dict]) -> tuple[dict[str, dict], dict[str, list[dict]]]:
    by_slug: dict[str, dict] = {}
    by_core: dict[str, list[dict]] = {}
    for book in books:
        slug = (book.get("slug") or "").strip().lower()
        if not slug:
            continue
        by_slug[slug] = book
        by_core.setdefault(core_slug(slug), []).append(book)
    return by_slug, by_core


def match_book(stem: str, by_slug: dict[str, dict], by_core: dict[str, list[dict]]) -> dict | None:
    s = stem.strip().lower()
    if not s:
        return None
    if s in by_slug:
        return by_slug[s]
    for suf in SUFFIXES:
        hit = by_slug.get(s + suf)
        if hit:
            return hit
    hits = by_core.get(s) or by_core.get(core_slug(s)) or []
    if len(hits) == 1:
        return hits[0]
    return None


def object_path(language: str, book_id: str) -> str:
    lang = language if language in {"en", "hi"} else "en"
    return f"mindmaps/{lang}/{book_id}.png"


def public_url(url: str, path: str) -> str:
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))
    return f"{url}/storage/v1/object/public/{BUCKET}/{encoded}"


def ensure_bucket(url: str, key: str) -> None:
    code, raw, _ = rest(url, key, "GET", f"/storage/v1/bucket/{BUCKET}")
    if code < 400:
        return
    payload = json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode("utf-8")
    code, raw, _ = rest(url, key, "POST", "/storage/v1/bucket", body=payload)
    if code >= 400 and code != 409:
        raise SystemExit(f"create bucket {BUCKET} failed {code}: {raw[:400]!r}")


def upload_png(url: str, key: str, path: str, png: Path) -> str:
    data = png.read_bytes()
    extra = {"x-upsert": "true", "cache-control": "31536000"}
    code, raw, _ = rest(
        url, key, "POST", f"/storage/v1/object/{BUCKET}/{path}",
        body=data, content_type="image/png", extra=extra, timeout=180,
    )
    if code >= 400:
        code, raw, _ = rest(
            url, key, "PUT", f"/storage/v1/object/{BUCKET}/{path}",
            body=data, content_type="image/png", extra=extra, timeout=180,
        )
    if code >= 400:
        raise RuntimeError(f"storage upload {code}: {raw[:500]!r}")
    return public_url(url, path)


def upsert_mindmap(url: str, key: str, book_id: str, mindmap_url: str) -> None:
    payload = json.dumps({"book_id": book_id, "mindmap_url": mindmap_url}).encode("utf-8")
    code, raw, _ = rest(
        url, key, "POST", "/rest/v1/book_assets?on_conflict=book_id",
        body=payload,
        extra={"Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    if code >= 400:
        code, raw, _ = rest(
            url, key, "PATCH", f"/rest/v1/book_assets?book_id=eq.{book_id}",
            body=json.dumps({"mindmap_url": mindmap_url}).encode("utf-8"),
            extra={"Prefer": "return=minimal"},
        )
    if code >= 400:
        raise RuntimeError(f"book_assets upsert {code}: {raw[:500]!r}")


def main() -> int:
    p = argparse.ArgumentParser(description="Upload mind-map PNGs to Supabase book_assets.")
    p.add_argument("--lang", choices=("en", "hi", "both"), default="hi")
    p.add_argument("--dir", help="PNG folder (default out/mindmaps or out/mindmaps-hi)")
    p.add_argument("--dry-run", action="store_true", help="Match only; do not upload or write DB")
    p.add_argument("--force", action="store_true", help="Replace mindmap_url even when already set")
    p.add_argument("--limit", type=int, default=0, help="Stop after N successful uploads (0 = all)")
    args = p.parse_args()

    jobs: list[tuple[str, Path]] = []
    langs = ("en", "hi") if args.lang == "both" else (args.lang,)
    for lang in langs:
        folder = Path(args.dir) if args.dir and args.lang != "both" else None
        if folder is None:
            folder = HERE.parents[1] / ("out/mindmaps-hi" if lang == "hi" else "out/mindmaps")
        folder = folder.resolve()
        if not folder.is_dir():
            print(f"skip missing dir {folder}", file=sys.stderr)
            continue
        pngs = sorted(folder.glob("*.png"))
        print(f"{lang}: {len(pngs)} PNGs in {folder}")
        jobs.append((lang, folder))

    if not jobs:
        raise SystemExit("no PNG folders found")

    url, key = require_env()
    if key.startswith("sb_publishable"):
        raise SystemExit("Got a publishable/anon key. SUPABASE_SERVICE_ROLE_KEY must be the service_role / sb_secret_ key.")
    ensure_bucket(url, key)
    wanted_lang = None if args.lang == "both" else args.lang
    books = fetch_books(url, key, wanted_lang)
    if wanted_lang and not books:
        print(f"no books with language={wanted_lang}; fetching full catalog")
        books = fetch_books(url, key, None)
    print(f"catalog {len(books)} books" + (f" language={wanted_lang}" if wanted_lang else ""))
    existing = {} if args.force else fetch_existing_maps(url, key)
    print(f"existing mindmap_url rows: {len(existing)}")

    matched = skipped_exist = unmatched = uploaded = failed = 0
    t0 = time.time()
    for lang, folder in jobs:
        subset = [b for b in books if b.get("language") == lang] if args.lang == "both" else books
        by_slug, by_core = index_books(subset)
        for png in sorted(folder.glob("*.png")):
            book = match_book(png.stem, by_slug, by_core)
            if not book:
                unmatched += 1
                print(f"UNMATCHED {lang} {png.name}")
                continue
            matched += 1
            book_id = book["id"]
            if book_id in existing and not args.force:
                skipped_exist += 1
                continue
            dest = object_path(book.get("language") or lang, book_id)
            pub = public_url(url, dest)
            if args.dry_run:
                print(f"DRY {png.name} → {book.get('slug')} ({book_id[:8]}…) {pub}")
                if args.limit and matched >= args.limit:
                    break
                continue
            try:
                pub = upload_png(url, key, dest, png)
                upsert_mindmap(url, key, book_id, pub)
                uploaded += 1
                print(f"OK {png.name} → {book.get('slug')}")
            except Exception as exc:  # noqa: BLE001 — batch must continue
                failed += 1
                print(f"FAIL {png.name} {book.get('slug')}: {exc}", file=sys.stderr)
                if failed == 1:
                    print(f"::error::{exc}")
                if failed >= 5:
                    print("aborting after 5 storage/DB failures", file=sys.stderr)
                    break
            if args.limit and uploaded >= args.limit:
                break

    elapsed = time.time() - t0
    print(
        f"done matched={matched} uploaded={uploaded} already={skipped_exist} "
        f"unmatched={unmatched} failed={failed} in {elapsed:.1f}s"
    )
    if failed:
        return 1
    if not args.dry_run and uploaded == 0 and matched and not skipped_exist:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
