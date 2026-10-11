#!/usr/bin/env python3
"""Rough phonetic Latin -> Devanagari for romanized Indian titles and author names.

This is a heuristic, not a scholarly transliteration. Names from Telugu,
Malayalam, Kannada, Bengali etc. have no single canonical Devanagari spelling,
so output should be reviewed before upload. Rules:
  - digraphs first (chh, th, dh, ph, bh, gh, kh, jh, sh, ch, ng, ny, ksh)
  - vowels: a=inherent, aa, i/ee, u/oo, e, ai, o, au/ou
  - consonant with no following vowel gets virama, except the last letter
  - word-final 'a' after a consonant becomes ा (aa), final 'i' becomes ी
"""
import re

CONS = {
    "chh": "छ", "ksh": "क्ष", "ch": "च", "sh": "श", "th": "थ", "dh": "ध",
    "ph": "फ", "bh": "भ", "gh": "घ", "kh": "ख", "jh": "झ", "ng": "ंग",
    "ny": "ञ", "k": "क", "g": "ग", "j": "ज", "t": "त", "d": "द", "n": "न",
    "p": "प", "b": "ब", "m": "म", "y": "य", "r": "र", "l": "ल", "v": "व",
    "w": "व", "s": "स", "h": "ह", "c": "क", "q": "क", "f": "फ", "z": "ज़",
    "x": "क्स",
}
VOW_IND = {"aa": "आ", "ai": "ऐ", "au": "औ", "ou": "औ", "ee": "ई", "ii": "ई",
           "oo": "ऊ", "uu": "ऊ", "a": "अ", "i": "इ", "u": "उ", "e": "ए", "o": "ओ"}
VOW_MAT = {"aa": "ा", "ai": "ै", "au": "ौ", "ou": "ौ", "ee": "ी", "ii": "ी",
           "oo": "ू", "uu": "ू", "a": "", "i": "ि", "u": "ु", "e": "े", "o": "ो"}
CONS_KEYS = sorted(CONS, key=len, reverse=True)
VOW_KEYS = sorted(VOW_IND, key=len, reverse=True)
DIGITS = {c: str(i) for i, c in enumerate("0123456789")}


def _word(w):
    out, i, n = [], 0, len(w)
    prev_consonant = False  # last emitted unit is a consonant awaiting vowel
    while i < n:
        ch = w[i]
        vk = next((v for v in VOW_KEYS if w.startswith(v, i)), None)
        if vk and not (vk == "y"):
            # vowel
            if prev_consonant:
                out.append(VOW_MAT[vk])
            else:
                out.append(VOW_IND[vk])
            i += len(vk)
            prev_consonant = False
            continue
        ck = next((c for c in CONS_KEYS if w.startswith(c, i)), None)
        if ck:
            if prev_consonant:
                out.append("्")  # virama between consonants
            out.append(CONS[ck])
            i += len(ck)
            prev_consonant = True
            continue
        out.append(ch)
        prev_consonant = False
        i += 1
    if prev_consonant:
        # word ends on consonant: keep inherent vowel (no virama)
        pass
    s = "".join(out)
    # word-final 'a' after consonant handled above via inherent; tweak final
    return s


def to_deva(text):
    text = text.lower()
    # word-final 'a' -> aa matra (typical for names like Sujatha, Kalki)
    parts = re.split(r"(\s+)", text)
    res = []
    for p in parts:
        if not p or p.isspace():
            res.append(p)
            continue
        m = re.match(r"^(.*?)([^a-z]*)$", p)
        core, tail = (m.group(1), m.group(2)) if m else (p, "")
        if core.endswith("a") and len(core) > 2 and not core.endswith(("aa",)):
            core = core[:-1] + "aa"
        elif core.endswith("i") and len(core) > 2 and not core.endswith("ai"):
            core = core[:-1] + "ee"
        res.append(_word(core) + tail)
    return "".join(res)


if __name__ == "__main__":
    import sys
    for line in sys.stdin:
        print(to_deva(line.rstrip("\n")))
