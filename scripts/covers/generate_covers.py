# -*- coding: utf-8 -*-
"""
Generate the 450-book cover set for Booknomics.

Books are parsed from content-drafts/*.txt (the canonical 450-book bulk set:
Title / Author / Language / Category / Slug header). Each book gets one unique
(archetype, palette) pair out of the 15 x 30 = 450 combinatorial space, plus a
per-book seeded font, layout, noise and motifs — so no two covers share both
style and tone.

Usage:
  python3 generate_covers.py --sample 9          # quick preview + contact sheet
  python3 generate_covers.py --all               # full 450 run + INDEX.csv
  python3 generate_covers.py --slugs a,b --out /tmp/x
"""

import argparse
import csv
import os
import random
import re
import sys
import zlib
from typing import Dict, List

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cover_engine as E  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DRAFTS = os.path.join(REPO, "content-drafts")
OUT = os.path.join(DRAFTS, "covers-450")

FIELD_RE = re.compile(r"^(Title|Author|Language|Category|Slug):\s*(.+)$")


# --- ASCII slug port of src/lib/seoSlugTools.ts + bookParser.slugify ---------
DEVA_MAP = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
    "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
    "ं": "n", "ः": "h", "ँ": "n", "ऽ": "",
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    "ळ": "l", "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy",
    "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
    "ृ": "i", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "्": "",
    "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
}
# note: matra ृ maps to "ri" in TS; keep identical:
DEVA_MAP["ृ"] = "ri"
DEVA_CONSONANTS = set("कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहळक़ख़ग़ज़ड़ढ़फ़")
DEVA_VOWEL_SIGNS = set("ािीुूृेैोौ्")


def _is_deva(ch):
    return "\u0900" <= ch <= "\u097F"


def _transliterate_word(word):
    ends_conj = re.search(r"[\u0915-\u0939]\u094D[\u0915-\u0939]$", word) is not None
    word = word.replace("क्ष", "ksh").replace("त्र", "tr").replace("ज्ञ", "gy")
    chars = list(word)
    out = ""
    for i, ch in enumerate(chars):
        out += DEVA_MAP.get(ch, ch)
        if ch not in DEVA_CONSONANTS:
            continue
        nxt = chars[i + 1] if i + 1 < len(chars) else None
        if nxt is not None and nxt in DEVA_VOWEL_SIGNS:
            continue
        if nxt in ("ं", "ँ", "ः"):
            out += "a"
            continue
        is_final = nxt is None or not _is_deva(nxt)
        if is_final and len(out) > 1:
            continue
        out += "a"
    return out + ("a" if ends_conj else "")


def transliterate_devanagari(text):
    return re.sub(r"[\u0900-\u097F]+", lambda m: _transliterate_word(m.group(0)), text)


def ascii_slug(slug):
    t = transliterate_devanagari(slug).lower().strip()
    t = re.sub(r"[^a-z0-9\s-]", "", t)
    t = re.sub(r"\s+", "-", t)
    t = re.sub(r"-+", "-", t)
    t = t.strip("-")[:80].rstrip("-")
    return t or "book"


def parse_books() -> List[Dict[str, str]]:
    """Two header formats exist in content-drafts:
    A) #BOOK_START + "Title:/Author:/.../Slug:" fields (bulk batch)
    B) markdown drafts: "# <title>" then "## <author> (year)" (early batch)
    Both are canonical parts of the 450-book set."""
    books = []
    for fn in sorted(os.listdir(DRAFTS)):
        if not fn.endswith(".txt"):
            continue
        meta = {}
        head = []
        with open(os.path.join(DRAFTS, fn), encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if len(head) < 6:
                    head.append(line)
                m = FIELD_RE.match(line)
                if m:
                    meta[m.group(1)] = m.group(2).strip()
                if line.startswith("#HOOK"):
                    break
        if not meta.get("Title"):
            # format B
            for line in head:
                if line.startswith("# ") and not line.startswith("## "):
                    meta.setdefault("Title", line[2:].strip())
                elif line.startswith("## ") and not meta.get("Author"):
                    auth = line[3:].strip()
                    auth = re.sub(r"\s*\(\d{4}.*?\)\s*$", "", auth)
                    meta["Author"] = auth
        if not meta.get("Slug"):
            stem = fn[:-4]
            meta["Slug"] = stem if stem.endswith("-saransh") else stem + "-saransh"
        meta.setdefault("Author", "")
        if meta.get("Title"):
            meta["file"] = fn
            books.append(meta)
    return books


def _unique(name, seen):
    if name not in seen:
        seen[name] = 0
        return name
    seen[name] += 1
    return f"{name}-{seen[name] + 1}"


def assign(books: List[Dict[str, str]]):
    """Deterministic unique (archetype, palette) pair per book."""
    books = sorted(books, key=lambda b: b["Slug"])
    perm = list(range(len(E.ARCHETYPES) * len(E.PALETTES)))
    random.Random(450450).shuffle(perm)
    out = []
    seen = {}
    for i, b in enumerate(books):
        pair = perm[i % len(perm)]
        seed = zlib.crc32(b["Slug"].encode("utf-8"))
        rng = random.Random(seed)
        out.append(dict(
            book=b,
            arch=E.ARCHETYPES[pair % len(E.ARCHETYPES)],
            pal=pair // len(E.ARCHETYPES),
            seed=seed,
            fname=_unique(ascii_slug(b["Slug"]), seen),
            font=rng.choice(E.DEV_FONTS),
            layout=rng.choices(E.LAYOUTS, weights=[0.42, 0.20, 0.14, 0.12, 0.12])[0],
        ))
    return out


def render_one(spec, out_dir):
    img, info = E.render_cover(spec["book"]["Title"], spec["book"]["Author"],
                               spec["arch"], spec["pal"], spec["seed"],
                               font_name=spec["font"], layout=spec["layout"])
    path = os.path.join(out_dir, spec["fname"] + ".jpg")
    img.save(path, "JPEG", quality=86, progressive=True, optimize=True)
    return path, info


def contact_sheet(paths_labels, out_path, cols=3, thumb_w=300):
    n = len(paths_labels)
    rows = (n + cols - 1) // cols
    th = int(thumb_w * 1.5)
    cap = 26
    sheet = Image.new("RGB", (cols * thumb_w + (cols + 1) * 8, rows * (th + cap) + (rows + 1) * 8), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for i, (p, label) in enumerate(paths_labels):
        im = Image.open(p).resize((thumb_w, th), Image.LANCZOS)
        x = 8 + (i % cols) * (thumb_w + 8)
        y = 8 + (i // cols) * (th + cap + 8)
        sheet.paste(im, (x, y))
        d.text((x + 2, y + th + 6), label[:44], fill=(210, 210, 215))
    sheet.save(out_path, "JPEG", quality=88, optimize=True)
    return out_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--slugs", type=str, default="")
    ap.add_argument("--out", type=str, default=OUT)
    args = ap.parse_args()

    books = parse_books()
    print(f"parsed {len(books)} books")
    specs = assign(books)

    os.makedirs(args.out, exist_ok=True)
    if args.slugs:
        want = set(args.slugs.split(","))
        specs = [s for s in specs if s["fname"] in want or s["book"]["Slug"] in want]
    elif args.sample:
        step = max(1, len(specs) // args.sample)
        specs = [specs[i % len(specs)] for i in range(0, len(specs), step)][:args.sample]

    done = []
    for i, s in enumerate(specs):
        path, info = render_one(s, args.out)
        kb = os.path.getsize(path) // 1024
        done.append((path, s["fname"]))
        print(f"[{i + 1}/{len(specs)}] {s['fname']}  {info['arch']}/{info['palette']}/{info['font'][:12]}/{info['layout']}  {kb}KB")

    if args.all:
        idx = os.path.join(args.out, "INDEX.csv")
        with open(idx, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["slug", "title", "author", "category", "archetype", "palette", "font", "layout", "file"])
            for s in specs:
                w.writerow([s["fname"], s["book"]["Title"], s["book"]["Author"],
                            s["book"].get("Category", ""), s["arch"], E.PALETTES[s["pal"]]["name"],
                            s["font"], s["layout"], s["fname"] + ".jpg"])
        print("wrote", idx)

    if done and (args.sample or args.slugs):
        contact_sheet(done, os.path.join(args.out, "_contact_sheet.jpg"))
        print("sheet:", os.path.join(args.out, "_contact_sheet.jpg"))


if __name__ == "__main__":
    main()
