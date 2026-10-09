#!/usr/bin/env python3
"""Upload Booknomics MP3s to any S3-compatible object store.

Works with Cloudflare R2, Backblaze B2 S3-compatible API, and similar services.
It never sends book text or prompts anywhere; only generated MP3 files are uploaded.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from urllib.parse import quote

UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def main() -> int:
    p = argparse.ArgumentParser(description="Upload Booknomics MP3s to S3-compatible object storage")
    p.add_argument("--input", default="audio-out/mp3")
    p.add_argument("--manifest", default="booknomics-audio-urls.json")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--skip-existing", action=argparse.BooleanOptionalAction, default=True)
    args = p.parse_args()

    try:
        import boto3  # type: ignore
        from botocore.config import Config  # type: ignore
        from botocore.exceptions import ClientError  # type: ignore
    except Exception as exc:
        raise RuntimeError("Install boto3 first: python -m pip install boto3") from exc

    endpoint = env("S3_ENDPOINT_URL").rstrip("/")
    access_key = env("S3_ACCESS_KEY_ID")
    secret_key = env("S3_SECRET_ACCESS_KEY")
    bucket = env("S3_BUCKET")
    public_base = env("S3_PUBLIC_BASE_URL").rstrip("/")
    region = os.environ.get("S3_REGION", "auto")
    prefix = os.environ.get("S3_PREFIX", "book-audio").strip("/")

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=Config(signature_version="s3v4", retries={"max_attempts": 8, "mode": "standard"}),
    )

    files = sorted(Path(args.input).glob("*.mp3"))
    if args.limit > 0:
        files = files[: args.limit]
    rows = []
    failed = 0

    for idx, path in enumerate(files, 1):
        book_id = path.stem
        if not UUID_RE.match(book_id):
            print(f"[{idx}/{len(files)}] skip invalid filename: {path.name}")
            continue
        key = f"{prefix}/{book_id}.mp3" if prefix else f"{book_id}.mp3"
        print(f"[{idx}/{len(files)}] {path.name} -> {key}", flush=True)
        try:
            exists = False
            if args.skip_existing:
                try:
                    client.head_object(Bucket=bucket, Key=key)
                    exists = True
                except ClientError as e:
                    status = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                    code = str(e.response.get("Error", {}).get("Code", ""))
                    if status not in (403, 404) and code not in ("404", "NoSuchKey", "NotFound"):
                        raise
            if not exists:
                client.upload_file(
                    str(path), bucket, key,
                    ExtraArgs={
                        "ContentType": "audio/mpeg",
                        "CacheControl": "public, max-age=31536000, immutable",
                    },
                )
            url = f"{public_base}/{quote(key, safe='/')}"
            rows.append({"book_id": book_id, "url": url, "filename": path.name})
        except Exception as exc:
            failed += 1
            print(f"  FAILED: {exc}")

        Path(args.manifest).write_text(
            json.dumps({"version": 1, "files": rows}, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    print(f"Finished. uploaded_or_existing={len(rows)} failed={failed}")
    print(f"URL manifest: {args.manifest}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
