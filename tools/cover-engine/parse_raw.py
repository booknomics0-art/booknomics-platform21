#!/usr/bin/env python3
"""Turn a raw 'Title — Author' list into manifest-style TSV for procedural.py.
Usage: python3 parse_raw.py raw/<file>.txt manifest-<name>.tsv
"""
import html, re, sys, unicodedata

src, dst = sys.argv[1], sys.argv[2]
seen, out = set(), []
for line in open(src, encoding="utf-8"):
    line = line.strip()
    if not line or " — " not in line:
        continue
    title, author = (html.unescape(p.strip()) for p in line.split(" — ", 1))
    author = author.split(", ")[0].strip()  # first author only
    s = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:70] or "book"
    base, n = s, 2
    while s in seen:
        s = f"{base}-{n}"
        n += 1
    seen.add(s)
    out.append(f"{s}\t{title}\t{author}\t")
open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")
print(len(out), "books ->", dst)
