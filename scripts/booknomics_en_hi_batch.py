#!/usr/bin/env python3
"""Offline, resumable Booknomics English→Hindi draft generator.

No translation API is called. A *downloaded local* Marian model performs
inference. Published source may be fetched from Supabase, but this program
never writes to Supabase, Cloudflare, or the original English records.

Output is unapproved machine draft content and MUST NOT be published without
independent editorial review and Cloudflare D1 source-hash verification.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Protocol


FIELDS = (
    "overview", "deep_summary", "key_ideas", "deep_analysis",
    "daily_application", "action_system", "practice_tracker",
    "reflection_questions", "real_life_example",
)
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
DEVANAGARI = re.compile(r"[\u0900-\u097f]")
HEADING = re.compile(r"^\s{0,3}#{1,6}\s+", re.M)
LIST_PREFIX = re.compile(r"^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+))")
MARKDOWN_SPAN = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\[[^]]+\]\([^)]+\)|https?://\S+)")
SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?।])\s+(?=[\"'“(A-Z0-9])")
MODEL_NAME = "Helsinki-NLP/opus-mt-en-hi"
GENERIC_SOURCE_MARKERS = (
    "Fast critical summary:",
    "This Booknomics guide treats the work as more than a plot container",
    "The strongest way into",
    "as a practice case for distinguishing",
)


class Translator(Protocol):
    def translate_batch(self, segments: list[str]) -> list[str]: ...


class LocalMarianTranslator:
    """Hugging Face model loaded from disk only; never invokes hosted inference."""

    def __init__(self, model_dir: Path, device: str = "cpu", batch_size: int = 8):
        if not model_dir.is_dir():
            raise ValueError(f"Offline model directory not found: {model_dir}")
        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except ImportError as exc:
            raise RuntimeError("Install scripts/translation/requirements-offline.txt") from exc
        self.torch = torch
        self.device = device
        self.batch_size = batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_dir), local_files_only=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(str(model_dir), local_files_only=True)
        self.model.to(device)
        self.model.eval()

    def translate_batch(self, segments: list[str]) -> list[str]:
        result: list[str] = []
        for start in range(0, len(segments), self.batch_size):
            group = segments[start : start + self.batch_size]
            encoded = self.tokenizer(group, padding=True, truncation=False, return_tensors="pt")
            if encoded["input_ids"].shape[1] > 490:
                raise ValueError("Source segment exceeds model length; reduce --max-chars")
            encoded = {key: value.to(self.device) for key, value in encoded.items()}
            with self.torch.inference_mode():
                tokens = self.model.generate(**encoded, num_beams=4, max_new_tokens=480)
            result.extend(self.tokenizer.batch_decode(tokens, skip_special_tokens=True))
        return result


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows or len(rows) > 500:
        raise ValueError("A cohort manifest must contain between 1 and 500 records")
    seen: set[str] = set()
    for row in rows:
        book_id = (row.get("book_id") or "").lower()
        if not UUID.fullmatch(book_id) or book_id in seen:
            raise ValueError("Invalid or duplicate book_id in manifest")
        if row.get("source_language") != "en" or row.get("target_language") != "hi":
            raise ValueError("Manifest is not an English→Hindi cohort")
        seen.add(book_id)
    return rows


def source_from_jsonl(path: Path) -> dict[str, dict]:
    sources: dict[str, dict] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                item = json.loads(line)
                if item["id"] in sources:
                    raise ValueError(f"Duplicate source ID: {item['id']}")
                sources[item["id"]] = item
    return sources


def source_from_supabase(ids: list[str], base_url: str, key: str) -> dict[str, dict]:
    base = base_url.rstrip("/")
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("SUPABASE_URL must be HTTPS")
    fields = "id,slug,title,author,language,is_draft,status," + ",".join(FIELDS)
    result: dict[str, dict] = {}
    for offset in range(0, len(ids), 20):
        subids = ids[offset : offset + 20]
        params = urllib.parse.urlencode({"select": fields, "id": "in.(" + ",".join(subids) + ")"})
        request = urllib.request.Request(
            f"{base}/rest/v1/books?{params}",
            headers={"apikey": key, "Accept": "application/json"},
        )
        # Legacy JWT service-role keys work with Bearer too; new sb_secret keys
        # are sent only in the apikey header.
        if key.count(".") == 2:
            request.add_header("Authorization", "Bearer " + key)
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    data = json.loads(response.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as exc:
                if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise RuntimeError(f"Supabase source read returned HTTP {exc.code}") from None
                time.sleep(2 ** attempt)
            except urllib.error.URLError:
                if attempt == 2:
                    raise RuntimeError("Supabase source connection failed") from None
                time.sleep(2 ** attempt)
        if not isinstance(data, list):
            raise ValueError("Supabase did not return an array of books")
        for book in data:
            if book["id"] not in subids or book["id"] in result:
                raise ValueError("Unexpected or duplicate book returned by Supabase")
            result[book["id"]] = book
    return result


def check_source(book: dict, manifest_row: dict[str, str]) -> list[str]:
    problems: list[str] = []
    if book.get("id") != manifest_row["book_id"]:
        problems.append("book_id mismatch")
    if book.get("language") != "en" or book.get("is_draft") is not False or book.get("status") != "published":
        problems.append("Source must be a published, non-draft English book")
    if book.get("slug") != manifest_row.get("slug"):
        problems.append("Source slug changed since manifest")
    if book.get("title") != manifest_row.get("title"):
        problems.append("Source title changed since manifest")
    if book.get("author") != manifest_row.get("author"):
        problems.append("Source author changed since manifest")
    for field in FIELDS:
        value = book.get(field) or ""
        if not isinstance(value, str):
            problems.append(f"Non-string {field}")
            continue
        expected = manifest_row.get(field + "_chars")
        if expected and len(value) != int(expected):
            # DB length() counts Unicode code points; Python len does likewise.
            problems.append(f"Source changed: {field} char count")
        if any(marker.casefold() in value.casefold() for marker in GENERIC_SOURCE_MARKERS):
            problems.append(f"{field} contains a known generic source template")
        if field in ("action_system", "practice_tracker", "reflection_questions", "real_life_example") and 0 < len(value.strip()) < 80:
            problems.append(f"{field} is too short to be meaningful book-specific content")
        # Detect empty-placeholder heading sequences seen in some legacy books.
        if field in ("deep_summary", "deep_analysis"):
            lines = value.splitlines()
            empty_sections = 0
            for index, line in enumerate(lines):
                if not line.lstrip().startswith("### "):
                    continue
                j = index + 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j == len(lines) or lines[j].lstrip().startswith("### "):
                    empty_sections += 1
            if empty_sections >= 3:
                problems.append(f"{field} may contain template-only headings")
    if not any(isinstance(book.get(f), str) and book[f].strip() for f in FIELDS):
        problems.append("No English source text")
    return problems


def chunk_text(text: str, max_chars: int = 340) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text.strip() else []
    sentences = SENTENCE_BOUNDARY.split(text)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        words = sentence.split()
        parts: list[str] = []
        part = ""
        for word in words:
            if len(word) > max_chars:
                raise ValueError("An unbroken source token exceeds max_chars")
            if part and len(part) + 1 + len(word) > max_chars:
                parts.append(part)
                part = word
            else:
                part = (part + " " + word).strip()
        if part:
            parts.append(part)
        for item in parts:
            if current and len(current) + 1 + len(item) > max_chars:
                chunks.append(current)
                current = item
            else:
                current = (current + " " + item).strip()
    if current:
        chunks.append(current)
    return chunks


def translate_inline(text: str, engine: Translator, max_chars: int) -> str:
    if not text.strip():
        return text
    pieces = MARKDOWN_SPAN.split(text)
    units: list[str] = []
    spans: list[tuple[str, int, str, str]] = []
    for part in pieces:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            chunks = chunk_text(part[2:-2], max_chars)
            spans.append(("bold", len(chunks), "", ""))
            units.extend(chunks)
        elif part.startswith("[") and "](" in part:
            label, url = part[1:].split("](", 1)
            chunks = chunk_text(label, max_chars)
            spans.append(("link:" + url[:-1], len(chunks), "", ""))
            units.extend(chunks)
        elif part.startswith("`") or part.startswith("http"):
            spans.append(("literal:" + part, 0, "", ""))
        else:
            leading = part[:len(part) - len(part.lstrip())]
            trailing = part[len(part.rstrip()):]
            chunks = chunk_text(part.strip(), max_chars)
            spans.append(("plain", len(chunks), leading, trailing))
            units.extend(chunks)
    translated = engine.translate_batch(units) if units else []
    if len(translated) != len(units):
        raise ValueError("Offline engine did not return one output per source segment")
    result = []
    position = 0
    for kind, count, leading, trailing in spans:
        content = " ".join(translated[position : position + count])
        position += count
        if kind == "bold":
            result.append("**" + content + "**")
        elif kind.startswith("link:"):
            result.append("[" + content + "](" + kind[5:] + ")")
        elif kind.startswith("literal:"):
            result.append(kind[8:])
        else:
            result.append(leading + content + trailing)
    return "".join(result)


def translate_markdown(text: str, engine: Translator, max_chars: int = 340) -> str:
    result = []
    in_code_fence = False
    for line in text.splitlines(keepends=True):
        ending = "\n" if line.endswith("\n") else ""
        body = line.rstrip("\r\n")
        if body.lstrip().startswith("```"):
            in_code_fence = not in_code_fence
            result.append(body + ending)
            continue
        if in_code_fence or not body.strip():
            result.append(body + ending)
            continue
        match = LIST_PREFIX.match(body)
        prefix = match.group(1) if match else ""
        segment = body[len(prefix):]
        result.append(prefix + translate_inline(segment, engine, max_chars) + ending)
    return "".join(result)


def source_hash(sections: dict[str, str]) -> str:
    # Matches JSON.stringify({source:'en',sections}) key order in Worker code.
    payload = json.dumps({"source": "en", "sections": sections}, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def quality_checks(source: dict[str, str], translated: dict[str, str]) -> list[str]:
    problems = []
    if set(source) != set(translated):
        return ["Missing or unexpected translated fields"]
    for field, original in source.items():
        target = translated[field]
        if not target.strip():
            problems.append(f"{field}: empty translation")
            continue
        ratio = len(target) / max(1, len(original))
        if ratio < 0.35 or ratio > 3.5:
            problems.append(f"{field}: suspicious length ratio {ratio:.2f}")
        devanagari = len(DEVANAGARI.findall(target)) / max(1, len(target))
        if devanagari < 0.30:
            problems.append(f"{field}: insufficient Hindi characters")
        if len(HEADING.findall(original)) != len(HEADING.findall(target)):
            problems.append(f"{field}: Markdown heading count changed")
        if len(re.findall(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)", original, re.M)) != len(re.findall(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)", target, re.M)):
            problems.append(f"{field}: list marker count changed")
        if original.strip() == target.strip():
            problems.append(f"{field}: source copied unchanged")
    return problems


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        tmp = Path(handle.name)
    tmp.replace(path)


def existing_manual_ids(directory: Path) -> set[str]:
    seen: set[str] = set()
    if not directory.is_dir():
        return seen
    for path in directory.rglob("*.hi.json"):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
            book_id = doc.get("bookId")
            if book_id and UUID.fullmatch(book_id):
                seen.add(book_id)
        except (OSError, ValueError):
            continue
    return seen


def process_book(book: dict, output: Path, engine: Translator, max_chars: int = 340) -> dict:
    sections = {field: book[field] for field in FIELDS if isinstance(book.get(field), str) and book[field].strip()}
    digest = source_hash(sections)
    if output.exists():
        doc = json.loads(output.read_text(encoding="utf-8"))
        if doc.get("bookId") != book["id"] or doc.get("sourceHash") != digest:
            raise ValueError("Existing checkpoint has a different book ID or English source hash")
        if doc.get("approved") is True:
            raise ValueError("Refusing to overwrite an approved document")
    else:
        doc = {"bookId": book["id"], "bookTitle": book["title"], "author": book.get("author", ""),
               "sourceLanguage": "en", "targetLanguage": "hi", "sourceHash": digest,
               "status": "offline_machine_draft_in_progress", "approved": False,
               "sourceSections": sections, "translatedSections": {},
               "generator": {"engine": "local-marian", "model": MODEL_NAME, "license": "Apache-2.0", "externalTranslationApi": False}}
    translated = doc.get("translatedSections", {})
    for field in sections:
        if field in translated and translated[field].strip():
            continue
        translated[field] = translate_markdown(sections[field], engine, max_chars=max_chars)
        doc["translatedSections"] = translated
        atomic_json(output, doc)  # Can resume after a crash, even mid-book.
    problems = quality_checks(sections, translated)
    doc["completedFields"] = list(translated)
    doc["qualityChecks"] = {"structuralPassed": not problems, "problems": problems,
                            "semanticVerified": False,
                            "requiresHumanEditorialApproval": True, "requiresCloudflareD1SourceParity": True}
    doc["status"] = "offline_machine_draft_needs_editorial_review" if not problems else "offline_machine_draft_needs_rework"
    doc["approved"] = False
    atomic_json(output, doc)
    return {"status": doc["status"], "fields": len(translated), "problems": problems}


def run(args: argparse.Namespace, engine: Translator | None = None) -> dict:
    manifest = read_manifest(args.manifest)
    if args.pending_only:
        manifest = [row for row in manifest if row.get("translation_status") == "pending_translation"]
    records = manifest[args.offset : args.offset + args.limit]
    if not records:
        # Shards may be empty after excluding already authored Hindi drafts.
        report = {"manifest": str(args.manifest), "offset": args.offset, "size": 0,
                  "counts": {}, "items": [],
                  "warning": "Machine drafts are never approved or published automatically."}
        atomic_json(args.out_dir / "report.json", report)
        return report
    if args.source_jsonl:
        sources = source_from_jsonl(args.source_jsonl)
    else:
        api_key = os.environ.get("SUPABASE_SERVER_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        api_url = os.environ.get("SUPABASE_URL")
        if not api_key or not api_url:
            raise ValueError("Set SUPABASE_URL and SUPABASE_SERVER_KEY (or SUPABASE_SERVICE_ROLE_KEY) in the runner only")
        sources = source_from_supabase([r["book_id"] for r in records], api_url, api_key)
    manual = existing_manual_ids(args.manual_drafts_dir)
    counters = Counter()
    detail = []
    for i, row in enumerate(records):
        book_id = row["book_id"]
        book = sources.get(book_id)
        if book is None:
            status, problems = "source_missing", ["Published source not found"]
        elif book_id in manual:
            status, problems = "skipped_existing_manual_draft", []
        else:
            problems = check_source(book, row)
            if problems:
                status = "source_needs_rework"
            elif args.dry_run:
                status = "source_validated_dry_run"
            else:
                if engine is None:
                    engine = LocalMarianTranslator(args.model_dir, args.device, args.model_batch_size)
                path = args.out_dir / f"{book_id}.hi.draft.json"
                try:
                    result = process_book(book, path, engine, args.max_chars)
                    status, problems = result["status"], result["problems"]
                except (ValueError, RuntimeError, OSError) as exc:
                    status, problems = "translation_failed", [str(exc)]
        counters[status] += 1
        detail.append({"book_id": book_id, "title": row.get("title"), "status": status, "problems": problems})
        print(json.dumps({"index": args.offset + i + 1, "book_id": book_id, "status": status}, ensure_ascii=False), flush=True)
    report = {"manifest": str(args.manifest), "offset": args.offset, "size": len(records),
              "counts": dict(counters), "items": detail,
              "warning": "Machine drafts are never approved or published automatically."}
    atomic_json(args.out_dir / "report.json", report)
    return report


def cli() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--source-jsonl", type=Path, help="Offline source snapshot; otherwise fetch from Supabase")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--manual-drafts-dir", type=Path, default=Path("content/translations/drafts"))
    parser.add_argument("--model-dir", type=Path, default=Path(".models/opus-mt-en-hi"))
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--model-batch-size", type=int, default=8)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--max-chars", type=int, default=340)
    parser.add_argument("--dry-run", action="store_true", help="Verify sources; do not load any model or translate")
    parser.add_argument("--pending-only", action="store_true", help="Filter existing manual/partial/complete records from the input manifest")
    return parser


if __name__ == "__main__":
    parser = cli()
    args = parser.parse_args()
    if not 0 <= args.offset < 500 or not 1 <= args.limit <= 500 or not 150 <= args.max_chars <= 450:
        parser.error("offset must be 0–499, limit 1–500, max-chars 150–450")
    try:
        outcome = run(args)
        print(json.dumps({"summary": outcome["counts"], "report": str(args.out_dir / "report.json")}, ensure_ascii=False))
    except (ValueError, RuntimeError, OSError) as exc:
        print("Batch failed: " + str(exc), file=sys.stderr)
        sys.exit(1)
