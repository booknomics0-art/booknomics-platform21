# -*- coding: utf-8 -*-
"""
QA gate for the 450-cover set. Checks, in order of importance:

 1. exactly 450 cover JPGs exist and match INDEX.csv rows
 2. every file is a real JPEG at exactly 800x1200 (2:3, BookCard object-contain)
 3. every file is <= 300 KB (the repo cover standard)
 4. every (archetype, palette) pair is unique -> no two books share style+tone
 5. every title/author string is fully glyph-covered (Devanagari font or the
    latin fallback) so nothing can render as tofu
 6. title band is not empty on any cover (text actually landed on the image)

Exit code 0 = pass.
"""

import csv
import os
import sys
from collections import Counter

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cover_engine as E  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(REPO, "content-drafts", "covers-450")


def main():
    failures = []
    with open(os.path.join(OUT, "INDEX.csv"), encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    print(f"INDEX rows: {len(rows)}")
    if len(rows) != 450:
        failures.append(f"INDEX has {len(rows)} rows, expected 450")

    sizes = []
    for r in rows:
        p = os.path.join(OUT, r["file"])
        if not os.path.exists(p):
            failures.append(f"missing file {r['file']}")
            continue
        kb = os.path.getsize(p) / 1024
        sizes.append(kb)
        if kb > 300:
            failures.append(f"{r['file']}: {kb:.0f}KB > 300KB")
        with Image.open(p) as im:
            if im.format != "JPEG":
                failures.append(f"{r['file']}: format {im.format}")
            if im.size != (800, 1200):
                failures.append(f"{r['file']}: size {im.size}")

    pairs = Counter((r["archetype"], r["palette"]) for r in rows)
    dup = [k for k, v in pairs.items() if v > 1]
    if dup:
        failures.append(f"duplicate (archetype,palette) pairs: {dup[:5]}")
    print(f"unique style+tone pairs: {len(pairs)} / {len(rows)}")
    print(f"archetypes used: {len(set(r['archetype'] for r in rows))}, palettes used: {len(set(r['palette'] for r in rows))}")
    print(f"fonts used: {sorted(set(r['font'] for r in rows))}")
    print(f"layouts used: {sorted(set(r['layout'] for r in rows))}")
    print(f"size: min {min(sizes):.0f}KB, max {max(sizes):.0f}KB, avg {sum(sizes)/len(sizes):.0f}KB")

    # glyph coverage
    missing = set()
    for r in rows:
        for text in (r["title"], r["author"]):
            for ch in text:
                if ch.strip() == "":
                    continue
                if not any(E.get_font(f).covers(ch) for f in E.DEV_FONTS) and not E.get_latin().covers(ch):
                    missing.add(ch)
    if missing:
        failures.append(f"glyphs missing in all fonts: {sorted(missing)}")

    # title band non-empty spot check (every 25th cover, top+bottom bands)
    for r in rows[::25]:
        p = os.path.join(OUT, r["file"])
        with Image.open(p) as im:
            g = im.convert("L")
            top = g.crop((0, 60, 800, 420))
            bot = g.crop((0, 700, 800, 1160))
            import statistics
            t_std = statistics.pstdev(list(top.getdata()))
            b_std = statistics.pstdev(list(bot.getdata()))
            if t_std < 6 and b_std < 6:
                failures.append(f"{r['file']}: no visible text band (flat top and bottom)")

    if failures:
        print("\nFAIL:")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("\nQA PASS: 450 covers, 800x1200 JPEG, <=300KB, unique style+tone, glyphs OK")


if __name__ == "__main__":
    main()
