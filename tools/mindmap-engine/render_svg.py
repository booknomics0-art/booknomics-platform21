"""Lightweight premium SVG renderer for Booknomics mind maps.

Used for the large English catalog so every published book can have an
illustrated mind map without consuming hundreds of MB of PNG storage.
The output is pure vector SVG and works in a normal <img> tag.
"""
from __future__ import annotations

from html import escape
from pathlib import Path
import re

W, H = 1920, 1080
BG = "#F7F4EC"
INK = "#18212F"
MUTED = "#67707E"
CARD = "#FFFDF8"
LINE = "#D6D0C2"
ACCENTS = ["#6C63FF", "#2684FF", "#00A884", "#E59B2F", "#E45D75", "#7A5AF8", "#3B82A0", "#8A6A42"]


def _plain(value: object) -> str:
    text = "" if value is None else str(value)
    return re.sub(r"\s+", " ", text).strip()


def _wrap(text: str, width: int, max_lines: int) -> list[str]:
    text = _plain(text)
    if not text:
        return []
    words = text.split()
    lines, cur = [], ""
    for word in words:
        candidate = word if not cur else f"{cur} {word}"
        if len(candidate) <= width:
            cur = candidate
        else:
            if cur:
                lines.append(cur)
            cur = word
            if len(lines) >= max_lines:
                break
    if len(lines) < max_lines and cur:
        lines.append(cur)
    consumed = " ".join(lines)
    if len(consumed) < len(text) and lines:
        lines[-1] = lines[-1].rstrip(" .,…") + "…"
    return lines[:max_lines]


def _text(lines: list[str], x: int, y: int, *, size: int, weight: int = 400,
          fill: str = INK, line_h: int | None = None, anchor: str = "start") -> str:
    if not lines:
        return ""
    line_h = line_h or int(size * 1.28)
    chunks = [f'<text x="{x}" y="{y}" font-family="Inter,Arial,sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">']
    for i, line in enumerate(lines):
        chunks.append(f'<tspan x="{x}" dy="{0 if i == 0 else line_h}">{escape(line)}</tspan>')
    chunks.append("</text>")
    return "".join(chunks)


def _card(x: int, y: int, w: int, h: int, radius: int = 22) -> str:
    return (f'<rect x="{x+5}" y="{y+7}" width="{w}" height="{h}" rx="{radius}" fill="#000" opacity="0.06"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{CARD}" stroke="{LINE}" stroke-width="2"/>')


def render_mindmap_svg(mind, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    left_x, right_x, card_w, card_h = 80, 1380, 460, 170
    ys = [150, 355, 560, 765]
    center_x, center_y, center_w, center_h = 665, 315, 590, 385
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="{escape(_plain(mind.title))} mind map">',
           f'<rect width="{W}" height="{H}" fill="{BG}"/>',
           '<defs><filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="7" stdDeviation="10" flood-opacity="0.07"/></filter></defs>',
           '<text x="80" y="68" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" fill="#6C63FF" letter-spacing="3">BOOKNOMICS · MIND MAP</text>',
           _text(_wrap(mind.title, 48, 2), 80, 115, size=38, weight=800, line_h=44),
           _text([f"{mind.author} · {mind.category}"], 1840, 72, size=19, weight=600, fill=MUTED, anchor="end"),
           '<line x1="80" y1="132" x2="1840" y2="132" stroke="#D9D3C7" stroke-width="2"/>']
    branches = list(mind.branches)[:8]
    while len(branches) < 8:
        branches.append(None)
    for i, branch in enumerate(branches):
        if branch is None:
            continue
        side_left = i < 4
        y = ys[i if side_left else i - 4]
        accent = ACCENTS[i]
        sx, sy = (left_x + card_w if side_left else right_x), y + card_h // 2
        ex, ey = (center_x if side_left else center_x + center_w), center_y + 85 + (i % 4) * 70
        c1, c2 = sx + (110 if side_left else -110), ex + (-110 if side_left else 110)
        out.append(f'<path d="M {sx} {sy} C {c1} {sy}, {c2} {ey}, {ex} {ey}" fill="none" stroke="{accent}" stroke-width="4" opacity="0.45"/>')
        out.append(f'<circle cx="{sx}" cy="{sy}" r="6" fill="{accent}"/>')
    out.append(f'<g filter="url(#soft)">{_card(center_x, center_y, center_w, center_h, 30)}</g>')
    out.append(f'<rect x="{center_x}" y="{center_y}" width="{center_w}" height="9" rx="5" fill="#6C63FF"/>')
    out.append(_text(["THE BOOK IN ONE MAP"], center_x + 36, center_y + 55, size=17, weight=800, fill="#6C63FF"))
    out.append(_text(_wrap(mind.title, 28, 2), center_x + 36, center_y + 105, size=33, weight=800, line_h=38))
    out.append(_text(_wrap(mind.one_liner, 58, 3), center_x + 36, center_y + 205, size=20, weight=500, fill="#374151", line_h=27))
    out.append(f'<rect x="{center_x+35}" y="{center_y+292}" width="{center_w-70}" height="1" fill="#E4DED2"/>')
    out.append(_text(["WHY IT MATTERS"], center_x + 36, center_y + 326, size=14, weight=800, fill=MUTED))
    out.append(_text(_wrap(mind.why_it_matters, 62, 2), center_x + 36, center_y + 356, size=17, weight=600, line_h=23))
    for i, branch in enumerate(branches):
        if branch is None:
            continue
        side_left = i < 4
        x, y, accent = (left_x if side_left else right_x), ys[i if side_left else i - 4], ACCENTS[i]
        out.append(f'<g filter="url(#soft)">{_card(x, y, card_w, card_h)}</g>')
        out.append(f'<rect x="{x}" y="{y}" width="8" height="{card_h}" rx="4" fill="{accent}"/>')
        out.append(f'<circle cx="{x+38}" cy="{y+35}" r="18" fill="{accent}" opacity="0.13"/>')
        out.append(_text([str(i+1).zfill(2)], x + 38, y + 42, size=14, weight=800, fill=accent, anchor="middle"))
        out.append(_text(_wrap(branch.title, 30, 1), x + 68, y + 42, size=21, weight=800))
        if _wrap(branch.question, 54, 1):
            out.append(_text(_wrap(branch.question, 54, 1), x + 26, y + 74, size=14, weight=500, fill=MUTED))
        node_y = y + 105
        for n, node in enumerate(list(branch.nodes)[:3]):
            label = _wrap(getattr(node, "label", ""), 48, 1)
            if label:
                out.append(f'<circle cx="{x+31}" cy="{node_y+n*25-5}" r="4" fill="{accent}"/>')
                out.append(_text(label, x + 44, node_y + n*25, size=15, weight=600, fill="#303846"))
    out.append('<line x1="80" y1="963" x2="1840" y2="963" stroke="#D9D3C7" stroke-width="2"/>')
    out.append(_text(["5 TAKEAWAYS"], 80, 1002, size=16, weight=800, fill="#6C63FF"))
    for i, item in enumerate(list(mind.takeaways)[:5]):
        x = 250 + i * 315
        out.append(f'<circle cx="{x}" cy="996" r="14" fill="{ACCENTS[i]}" opacity="0.16"/>')
        out.append(_text([str(i+1)], x, 1002, size=12, weight=800, fill=ACCENTS[i], anchor="middle"))
        out.append(_text(_wrap(item, 27, 2), x + 24, 991, size=14, weight=600, fill="#374151", line_h=18))
    out.append(_text(["Read smarter. Apply faster."], 1840, 1047, size=14, weight=700, fill=MUTED, anchor="end"))
    out.append("</svg>")
    path.write_text("\n".join(out), encoding="utf-8")
    return path
