#!/usr/bin/env python3
"""Reconcile a 500-book English→Hindi batch against its exact manifest.

This is an accounting report, NOT an editorial approval or publishing gate.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path


def aggregate(manifest_path: Path, reports_dir: Path) -> dict:
    with manifest_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not 1 <= len(rows) <= 500:
        raise ValueError("Cohort must have 1–500 rows")
    book_ids = [row["book_id"] for row in rows]
    if len(set(book_ids)) != len(book_ids):
        raise ValueError("Duplicate IDs in source cohort")
    pending = {row["book_id"] for row in rows if row["translation_status"] == "pending_translation"}
    seen: dict[str, dict] = {}
    duplicates: set[str] = set()
    unknown: set[str] = set()
    counts: Counter[str] = Counter()
    reports = sorted(reports_dir.rglob("report.json"))
    for path in reports:
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("items", []):
            bid = item["book_id"]
            if bid not in pending:
                unknown.add(bid)
                continue
            if bid in seen:
                duplicates.add(bid)
                continue
            seen[bid] = {"status": item["status"], "problems": item.get("problems", [])}
            counts[item["status"]] += 1
    missing = sorted(pending - set(seen))
    return {
        "manifest": str(manifest_path),
        "totalEnglishBooks": len(rows),
        "previouslyAuthoredOrPartial": len(rows) - len(pending),
        "pendingAtStart": len(pending),
        "accountedFor": len(seen),
        "machineDraftsCreated": counts.get("offline_machine_draft_needs_editorial_review", 0)
            + counts.get("offline_machine_draft_needs_rework", 0),
        "statuses": dict(counts),
        "reportFiles": len(reports),
        "missingBookIds": missing,
        "duplicateBookIds": sorted(duplicates),
        "unexpectedBookIds": sorted(unknown),
        "coverageComplete": not (missing or duplicates or unknown),
        "editorialApproved": 0,
        "published": 0,
        "note": "Structural checks never guarantee faithful Hindi; every draft needs editorial review.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--reports-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = aggregate(args.manifest, args.reports_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["coverageComplete"]:
        print("WARNING: incomplete or inconsistent batch coverage", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
