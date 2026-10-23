#!/usr/bin/env python3
"""Offline validation/export of manually authored Hindi Phase 1 drafts.

No AI/translation API, database connection, deployment, or network access.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SOURCE_MANIFEST = ROOT / "source_500" / "progress_manifest.csv"
SEED_GLOB = "seed_*.md"
OUT_DRAFT_DIR = HERE / "drafts"


def parse_seeds() -> dict[int, str]:
    drafts = {}
    for path in sorted(HERE.glob(SEED_GLOB)):
        raw = path.read_text(encoding="utf-8")
        blocks = re.split(r"(?m)^## (\d{3})\s*$", raw)
        if len(blocks) < 3:
            raise ValueError(f"No entries in {path}")
        for i in range(1, len(blocks), 2):
            num = int(blocks[i])
            value = re.sub(r"\s+", " ", blocks[i + 1]).strip()
            if num in drafts:
                raise ValueError(f"Duplicate draft queue #{num:03d}")
            if not value:
                raise ValueError(f"Empty body for #{num:03d}")
            drafts[num] = value
    return drafts


def hindi_char_fraction(body: str) -> float:
    letters = [c for c in body if c.isalpha()]
    return round(sum("\u0900" <= c <= "\u097f" for c in letters) / max(1, len(letters)), 3)


def main() -> None:
    with SOURCE_MANIFEST.open(encoding="utf-8-sig", newline="") as f:
        source = list(csv.DictReader(f))
    if len(source) != 500:
        raise ValueError(f"Expected exactly 500 entries, found {len(source)}")

    ids = [int(row["queue_no"]) for row in source]
    routes = [row["english_route"] for row in source]
    if ids != list(range(1, 501)) or len(routes) != len(set(routes)):
        raise ValueError("Queue IDs and/or English routes are not unique/sequential")

    drafts = parse_seeds()
    if not all(1 <= n <= 500 for n in drafts):
        raise ValueError("Draft queue ID out of bounds")

    OUT_DRAFT_DIR.mkdir(exist_ok=True)
    used_text_hashes = set()
    qa = []
    output_rows = []
    jsonl_rows = []
    for src in source:
        n = int(src["queue_no"])
        body = drafts.get(n)
        word_count = len(body.split()) if body else 0
        devanagari_fraction = hindi_char_fraction(body) if body else 0
        word_pass = 100 <= word_count <= 140
        script_pass = devanagari_fraction >= 0.55
        slug = re.sub(r"[^a-z0-9]+", "_", src["english_title"].lower()).strip("_")[:66]
        relpath = f"drafts/{n:03d}_{slug}_hi.md" if body else ""
        issues = []
        if body:
            digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
            if digest in used_text_hashes:
                issues.append("exact_content_duplicate")
            used_text_hashes.add(digest)
            if not word_pass:
                issues.append("word_count_outside_100_to_140")
            if not script_pass:
                issues.append("insufficient_devanagari")
            md = (
                f"# {src['english_title']} — हिंदी संक्षिप्त सारांश\n\n"
                f"**लेखक:** {src['author']}\n\n"
                f"**मूल अंग्रेज़ी पुस्तक पेज:** {src['english_url']}\n\n"
                f"**लंबाई:** {word_count} शब्द (पहला चरण; अंतिम 2500+ शब्द वाला लेख नहीं)\n\n"
                f"## हिंदी सारांश\n\n{body}\n\n"
                "---\n"
                "**संपादकीय स्थिति:** ड्राफ्ट; अंतिम तथ्य-जाँच और पुस्तक-ID मिलान शेष।\n"
                "**प्रकाशन:** वेबसाइट पर अपलोड/डिप्लॉय नहीं किया गया।\n"
            )
            (HERE / relpath).write_text(md, encoding="utf-8")
            jsonl_rows.append(
                {
                    "queue_no": n,
                    "english_title": src["english_title"],
                    "author": src["author"],
                    "english_route": src["english_route"],
                    "source_url": src["english_url"],
                    "language": "hi",
                    "hindi_summary": body,
                    "hindi_word_count": word_count,
                    "editorial_status": "draft_factcheck_pending",
                    "publish_status": "not_deployed",
                    "hindi_book_id": None,
                }
            )

        output_rows.append(
            {
                "queue_no": n,
                "source_batch": src["source_batch"],
                "english_title": src["english_title"],
                "author": src["author"],
                "original_language": src["original_language"],
                "english_route": src["english_route"],
                "english_url": src["english_url"],
                "phase1_100_word_status": (
                    "draft_wordcount_pass_factcheck_pending" if body and not issues
                    else "draft_qa_attention" if body
                    else "not_started"
                ),
                "phase1_file": relpath,
                "phase1_word_count": word_count if body else "",
                "phase1_target_words": 100,
                "phase2_target_min_words": 2500,
                "hindi_book_id": "",
                "toggle_mapping_status": "not_mapped",
                "publication_status": "not_deployed",
            }
        )
        qa.append(
            {
                "queue_no": n,
                "draft_exists": bool(body),
                "word_count": word_count,
                "hindi_character_fraction": devanagari_fraction,
                "issues": issues,
            }
        )

    with (HERE / "phase1_500_progress.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(output_rows[0]))
        writer.writeheader()
        writer.writerows(output_rows)

    with (HERE / "phase1_drafts.jsonl").open("w", encoding="utf-8") as f:
        for obj in jsonl_rows:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    failing = [r for r in qa if r["draft_exists"] and r["issues"]]
    report = {
        "batch_goal": 500,
        "phase1_target_words_per_book": 100,
        "phase2_minimum_words_per_book": 2500,
        "source_records": len(source),
        "drafts_written": len(drafts),
        "drafts_pass_basic_automated_checks": len(drafts) - len(failing),
        "drafts_needing_basic_qa_attention": len(failing),
        "not_started": 500 - len(drafts),
        "drafts_editorial_factcheck_complete": 0,
        "deployed": 0,
        "generated_via_translation_or_llm_api": False,
        "individual_qa": qa,
    }
    (HERE / "QA_REPORT.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(
        f"Source books {len(source)} | Drafts {len(drafts)} | Basic QA pass "
        f"{len(drafts) - len(failing)} | QA attention {len(failing)} | Not started {500 - len(drafts)} | Deployed 0"
    )
    if failing:
        print("QA issues:", [(r["queue_no"], r["word_count"], r["issues"]) for r in failing])


if __name__ == "__main__":
    main()
