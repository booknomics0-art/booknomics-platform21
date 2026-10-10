"""16:9 premium editorial PNG renderer (Pillow). Readable type, no AI text."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import devanagari as dv
import hindi_copy as hi
from content import Mindmap
from genres import GenreTheme, hex_to_rgb, mix, resolve_theme

FONTS = {
    "serif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "serif_b": "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "sans": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "sans_b": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
}

W, H = 2560, 1440
PAD = 48


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    path = FONTS.get(kind) or FONTS["sans"]
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def _size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_w: int) -> list[str]:
    words = (text or "").split()
    if not words:
        return []
    lines: list[str] = []
    cur = words[0]
    for w in words[1:]:
        trial = f"{cur} {w}"
        if _size(draw, trial, fnt)[0] <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


class Pen:
    """Text helper: Devanagari via HarfBuzz, Latin via Pillow."""

    def __init__(self, layer: Image.Image, hindi: bool):
        self.layer = layer
        self.d = ImageDraw.Draw(layer, "RGBA")
        self.hi = hindi

    def refresh(self) -> None:
        self.d = ImageDraw.Draw(self.layer, "RGBA")

    def size(self, text: str, kind: str, size: int) -> tuple[int, int]:
        if self.hi:
            return dv.measure(text, kind, size, True)
        return _size(self.d, text, font(kind, size))

    def wrap(self, text: str, kind: str, size: int, max_w: int) -> list[str]:
        if self.hi:
            return dv.wrap(text, kind, size, max_w, True)
        return wrap(self.d, text, font(kind, size), max_w)

    def text(self, xy: tuple[int, int], text: str, kind: str, size: int, fill) -> tuple[int, int]:
        if self.hi:
            wh = dv.draw(self.layer, xy, text, kind, size, fill, True)
            self.refresh()
            return wh
        fnt = font(kind, size)
        col = fill[:3] if isinstance(fill, tuple) and len(fill) >= 3 else fill
        self.d.text(xy, text, font=fnt, fill=col)
        return _size(self.d, text, fnt)

    def fit_title(self, text: str, max_w: int, max_size: int, min_size: int = 28):
        for size in range(max_size, min_size - 1, -2):
            lines = self.wrap(text, "serif_b", size, max_w)
            if len(lines) <= 2:
                return size, lines
        return min_size, self.wrap(text, "serif_b", min_size, max_w)[:2]


def fit_title(draw: ImageDraw.ImageDraw, text: str, max_w: int, max_size: int, min_size: int = 28):
    for size in range(max_size, min_size - 1, -2):
        fnt = font("serif_b", size)
        lines = wrap(draw, text, fnt, max_w)
        if len(lines) <= 2:
            return fnt, lines
    fnt = font("serif_b", min_size)
    return fnt, wrap(draw, text, fnt, max_w)[:2]


def gradient_h(size: tuple[int, int], c1: str, c2: str, c3: str) -> Image.Image:
    w, h = size
    band = Image.new("RGB", (w, 1))
    px = band.load()
    for x in range(w):
        t = x / max(w - 1, 1)
        px[x, 0] = mix(c1, c2, t / 0.55) if t < 0.55 else mix(c2, c3, (t - 0.55) / 0.45)
    return band.resize((w, h), Image.Resampling.BILINEAR)


def canvas_wash(c1: str, c2: str) -> Image.Image:
    band = Image.new("RGB", (1, H))
    px = band.load()
    for y in range(H):
        px[0, y] = mix(c1, c2, y / max(H - 1, 1))
    return band.resize((W, H), Image.Resampling.BILINEAR)


def draw_dots(img: Image.Image, color=(255, 255, 255), alpha: int = 22) -> None:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for y in range(16, img.size[1], 28):
        for x in range(16, img.size[0], 28):
            d.ellipse((x, y, x + 3, y + 3), fill=(*color, alpha))
    img.alpha_composite(overlay)


def paste_round(layer: Image.Image, src: Image.Image, xy: tuple[int, int], radius: int) -> None:
    mask = Image.new("L", src.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, src.size[0] - 1, src.size[1] - 1), radius, fill=255)
    layer.paste(src, xy, mask)


def render_mindmap(map_: Mindmap, out_path: str | Path, theme: GenreTheme | None = None) -> Path:
    theme = theme or resolve_theme(map_.category)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    hindi = getattr(map_, "lang", "en") == "hi"

    layer = canvas_wash(theme.canvas_from, theme.canvas_to).convert("RGBA")
    ink = hex_to_rgb(theme.hero_ink)
    muted = hex_to_rgb(theme.hero_muted)
    dark = hex_to_rgb(theme.ink)
    cx = W // 2
    pen = Pen(layer, hindi)

    hero_h = 318 if hindi else 292
    hero = gradient_h((W - PAD * 2, hero_h), theme.hero_from, theme.hero_via, theme.hero_to).convert("RGBA")
    draw_dots(hero)
    paste_round(layer, hero, (PAD, PAD), 28)
    pen.refresh()

    kicker = hi.CHROME["kicker"] if hindi else "VISUAL  KNOWLEDGE  MAP"
    kicker_size = 16 if hindi else 15
    kw, kh = pen.size(kicker, "sans_b", kicker_size)
    pen.d.rounded_rectangle((cx - kw // 2 - 16, PAD + 22, cx + kw // 2 + 16, PAD + 22 + kh + 14), 16, outline=(*muted, 200), width=2)
    pen.text((cx - kw // 2, PAD + 28), kicker, "sans_b", kicker_size, muted)

    title_size, title_lines = pen.fit_title(map_.title, W - 280, 54 if hindi else 56, 30)
    ty = PAD + 58
    for line in title_lines:
        tw, th = pen.size(line, "serif_b", title_size)
        pen.text((cx - tw // 2, ty), line, "serif_b", title_size, ink)
        ty += th + (4 if hindi else 2)

    by = f"{hi.CHROME['by']}  {map_.author}" if hindi else f"by {map_.author}"
    bw, bh = pen.size(by, "sans", 20)
    pen.text((cx - bw // 2, ty + 4), by, "sans", 20, muted)

    genre_label = hi.GENRE_LABEL.get(map_.genre_key, hi.GENRE_LABEL["default"]) if hindi else theme.label
    map_kind = (hi.CHROME["story_map"] if map_.fiction else hi.CHROME["ideas_map"]) if hindi else ("Story map" if map_.fiction else "Ideas map")
    branches_chip = hi.CHROME["branches"] if hindi else "8 branches"
    chips = [genre_label, map_kind, branches_chip]
    chip_f_size = 15
    chip_y = ty + 40 + (4 if hindi else 0)
    widths = [pen.size(c, "sans_b", chip_f_size)[0] + 32 for c in chips]
    total = sum(widths) + 14 * (len(chips) - 1)
    x = cx - total // 2
    for c, cw in zip(chips, widths):
        pen.d.rounded_rectangle((x, chip_y, x + cw, chip_y + 32), 16, fill=(255, 255, 255, 220))
        tw, th = pen.size(c, "sans_b", chip_f_size)
        pen.text((x + (cw - tw) // 2, chip_y + 7), c, "sans_b", chip_f_size, dark)
        x += cw + 14

    quote = f"“{map_.one_liner}”"
    qy = chip_y + 44
    for ln in pen.wrap(quote, "serif", 22, 1700)[:2]:
        qw, qh = pen.size(ln, "serif", 22)
        pen.text((cx - qw // 2, qy), ln, "serif", 22, ink)
        qy += qh + 2

    gap = 18
    grid_x = PAD
    grid_y = PAD + hero_h + 22
    grid_w = W - PAD * 2
    recall_h = 318 if hindi else 300
    grid_h = H - grid_y - recall_h - PAD - 8
    col_w = (grid_w - gap * 3) // 4
    row_h = (grid_h - gap) // 2
    node_size = 15
    node_lh = 22 if hindi else 17
    title_n = 18 if hindi else 19
    q_size = 13

    for i, branch in enumerate(map_.branches[:8]):
        col, row = i % 4, i // 4
        x0 = grid_x + col * (col_w + gap)
        y0 = grid_y + row * (row_h + gap)
        x1, y1 = x0 + col_w, y0 + row_h
        color = hex_to_rgb(theme.branches[i])
        pen.d.rounded_rectangle((x0 + 4, y0 + 8, x1 + 4, y1 + 8), 20, fill=(20, 16, 8, 28))
        pen.d.rounded_rectangle((x0, y0, x1, y1), 20, fill=(255, 253, 248, 255))
        pen.d.rectangle((x0 + 1, y0 + 1, x1 - 1, y0 + 8), fill=color)
        pen.d.ellipse((x0 + 16, y0 + 20, x0 + 42, y0 + 46), fill=color)
        nw, _ = pen.size(str(i + 1), "sans_b", 14)
        pen.text((x0 + 29 - nw // 2, y0 + 25), str(i + 1), "sans_b", 14, (255, 255, 255))
        pen.text((x0 + 50, y0 + 20), branch.title, "sans_b", title_n, dark)
        pen.text((x0 + 50, y0 + 46), branch.question, "sans", q_size, (138, 125, 99))

        ny = y0 + (78 if hindi else 72)
        inner_w = col_w - 28
        for node in branch.nodes[:4]:
            prefix = f"{node.step} · " if node.step else ""
            use = pen.wrap(prefix + node.label, "sans", node_size, inner_w - 18)[:2]
            hgt = 12 + node_lh * max(len(use), 1)
            if ny + hgt > y1 - 58:
                break
            pen.d.rounded_rectangle((x0 + 14, ny, x1 - 14, ny + hgt), 9, fill=(*color, 28))
            yy = ny + 6
            for ln in use:
                pen.text((x0 + 24, yy), ln, "sans", node_size, dark)
                yy += node_lh
            ny += hgt + 6

        if branch.callout_text:
            cy0 = y1 - 52
            pen.d.rectangle((x0 + 14, cy0, x0 + 18, y1 - 14), fill=color)
            call_title = branch.callout_title if hindi else branch.callout_title.upper()
            pen.text((x0 + 26, cy0 - 2), call_title, "sans_b", 11, color)
            cl = pen.wrap(branch.callout_text, "sans", 13, inner_w - 20)
            if cl:
                pen.text((x0 + 26, cy0 + 16), cl[0], "sans", 13, (74, 68, 54))

    ry = H - PAD - recall_h
    rec = gradient_h((W - PAD * 2, recall_h), theme.hero_from, theme.hero_via, theme.hero_to).convert("RGBA")
    draw_dots(rec, alpha=16)
    paste_round(layer, rec, (PAD, ry), 24)
    pen.refresh()

    recall_label = hi.CHROME["recall"] if hindi else "QUICK RECALL  ·  REMEMBER THIS"
    pen.text((PAD + 40, ry + 22), recall_label, "sans_b", 14, muted)
    tf_size = 17 if hindi else 18
    left_x, right_x = PAD + 40, W // 2 + 10
    for i, t in enumerate(map_.takeaways[:5]):
        col = 0 if i < 3 else 1
        row = i if i < 3 else i - 3
        tx = left_x if col == 0 else right_x
        ty = ry + 56 + row * 52
        pen.d.ellipse((tx, ty, tx + 28, ty + 28), fill=(255, 255, 255, 230))
        nw, _ = pen.size(str(i + 1), "sans_b", 14)
        pen.text((tx + 14 - nw // 2, ty + 5), str(i + 1), "sans_b", 14, dark)
        lines = pen.wrap(t, "sans", tf_size, W // 2 - 140)
        if lines:
            pen.text((tx + 40, ty + 4), lines[0], "sans", tf_size, ink)

    box_y = ry + recall_h - 78
    pen.d.rounded_rectangle((PAD + 36, box_y, W - PAD - 36, ry + recall_h - 22), 14, fill=(20, 12, 8, 70), outline=(*ink, 80), width=1)
    one_label = hi.CHROME["one_line"] if hindi else "ONE-LINE SUMMARY"
    pen.text((PAD + 56, box_y + 8), one_label, "sans_b", 12, muted)
    ol = pen.wrap(f"“{map_.one_liner}”", "serif", 20, W - PAD * 2 - 140)
    if ol:
        pen.text((PAD + 56, box_y + 26), ol[0], "serif", 20, ink)

    brand = "booknomics"
    bw, _ = pen.size(brand, "sans_b", 13)
    pen.text((W - PAD - 36 - bw, ry + 22), brand, "sans_b", 13, muted)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    layer.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path
