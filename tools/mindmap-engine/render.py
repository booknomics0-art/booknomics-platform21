"""16:9 premium editorial PNG renderer (Pillow). Readable type, no AI text."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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

    layer = canvas_wash(theme.canvas_from, theme.canvas_to).convert("RGBA")
    d = ImageDraw.Draw(layer, "RGBA")
    ink = hex_to_rgb(theme.hero_ink)
    muted = hex_to_rgb(theme.hero_muted)
    dark = hex_to_rgb(theme.ink)
    cx = W // 2

    hero_h = 292
    hero = gradient_h((W - PAD * 2, hero_h), theme.hero_from, theme.hero_via, theme.hero_to).convert("RGBA")
    draw_dots(hero)
    paste_round(layer, hero, (PAD, PAD), 28)
    d = ImageDraw.Draw(layer, "RGBA")

    kicker_f = font("sans_b", 15)
    kicker = "VISUAL  KNOWLEDGE  MAP"
    kw, kh = _size(d, kicker, kicker_f)
    d.rounded_rectangle((cx - kw // 2 - 16, PAD + 22, cx + kw // 2 + 16, PAD + 22 + kh + 14), 16, outline=(*muted, 200), width=2)
    d.text((cx - kw // 2, PAD + 28), kicker, font=kicker_f, fill=muted)

    title_f, title_lines = fit_title(d, map_.title, W - 280, 56, 30)
    ty = PAD + 58
    for line in title_lines:
        tw, th = _size(d, line, title_f)
        d.text((cx - tw // 2, ty), line, font=title_f, fill=ink)
        ty += th + 2

    by_f = font("sans", 20)
    by = f"by {map_.author}"
    bw, _ = _size(d, by, by_f)
    d.text((cx - bw // 2, ty + 4), by, font=by_f, fill=muted)

    chip_f = font("sans_b", 15)
    chips = [theme.label, "Story map" if map_.fiction else "Ideas map", "8 branches"]
    chip_y = ty + 40
    widths = [_size(d, c, chip_f)[0] + 32 for c in chips]
    total = sum(widths) + 14 * (len(chips) - 1)
    x = cx - total // 2
    for c, cw in zip(chips, widths):
        d.rounded_rectangle((x, chip_y, x + cw, chip_y + 30), 15, fill=(255, 255, 255, 220))
        d.text((x + 16, chip_y + 6), c, font=chip_f, fill=dark)
        x += cw + 14

    quote_f = font("serif", 22)
    qy = chip_y + 42
    for ln in wrap(d, f"“{map_.one_liner}”", quote_f, 1700)[:2]:
        qw, qh = _size(d, ln, quote_f)
        d.text((cx - qw // 2, qy), ln, font=quote_f, fill=ink)
        qy += qh + 2

    gap = 18
    grid_x = PAD
    grid_y = PAD + hero_h + 22
    grid_w = W - PAD * 2
    recall_h = 300
    grid_h = H - grid_y - recall_h - PAD - 8
    col_w = (grid_w - gap * 3) // 4
    row_h = (grid_h - gap) // 2

    for i, branch in enumerate(map_.branches[:8]):
        col, row = i % 4, i // 4
        x0 = grid_x + col * (col_w + gap)
        y0 = grid_y + row * (row_h + gap)
        x1, y1 = x0 + col_w, y0 + row_h
        color = hex_to_rgb(theme.branches[i])
        d.rounded_rectangle((x0 + 4, y0 + 8, x1 + 4, y1 + 8), 20, fill=(20, 16, 8, 28))
        d.rounded_rectangle((x0, y0, x1, y1), 20, fill=(255, 253, 248, 255))
        d.rectangle((x0 + 1, y0 + 1, x1 - 1, y0 + 8), fill=color)
        d.ellipse((x0 + 16, y0 + 20, x0 + 42, y0 + 46), fill=color)
        nf = font("sans_b", 14)
        nw, _ = _size(d, str(i + 1), nf)
        d.text((x0 + 29 - nw // 2, y0 + 25), str(i + 1), font=nf, fill=(255, 255, 255))
        d.text((x0 + 50, y0 + 22), branch.title, font=font("sans_b", 19), fill=dark)
        d.text((x0 + 50, y0 + 46), branch.question, font=font("sans", 13), fill=(138, 125, 99))

        ny = y0 + 72
        inner_w = col_w - 28
        node_f = font("sans", 15)
        for node in branch.nodes[:4]:
            prefix = f"{node.step} · " if node.step else ""
            use = wrap(d, prefix + node.label, node_f, inner_w - 18)[:2]
            hgt = 10 + 17 * max(len(use), 1)
            if ny + hgt > y1 - 56:
                break
            d.rounded_rectangle((x0 + 14, ny, x1 - 14, ny + hgt), 9, fill=(*color, 28))
            yy = ny + 5
            for ln in use:
                d.text((x0 + 24, yy), ln, font=node_f, fill=dark)
                yy += 17
            ny += hgt + 6

        if branch.callout_text:
            cy0 = y1 - 50
            d.rectangle((x0 + 14, cy0, x0 + 18, y1 - 14), fill=color)
            d.text((x0 + 26, cy0 - 2), branch.callout_title.upper(), font=font("sans_b", 11), fill=color)
            cl = wrap(d, branch.callout_text, font("sans", 13), inner_w - 20)
            d.text((x0 + 26, cy0 + 14), cl[0] if cl else "", font=font("sans", 13), fill=(74, 68, 54))

    ry = H - PAD - recall_h
    rec = gradient_h((W - PAD * 2, recall_h), theme.hero_from, theme.hero_via, theme.hero_to).convert("RGBA")
    draw_dots(rec, alpha=16)
    paste_round(layer, rec, (PAD, ry), 24)
    d = ImageDraw.Draw(layer, "RGBA")

    d.text((PAD + 40, ry + 22), "QUICK RECALL  ·  REMEMBER THIS", font=font("sans_b", 14), fill=muted)
    tf = font("sans", 18)
    left_x, right_x = PAD + 40, W // 2 + 10
    for i, t in enumerate(map_.takeaways[:5]):
        col = 0 if i < 3 else 1
        row = i if i < 3 else i - 3
        tx = left_x if col == 0 else right_x
        ty = ry + 56 + row * 52
        d.ellipse((tx, ty, tx + 28, ty + 28), fill=(255, 255, 255, 230))
        nw, _ = _size(d, str(i + 1), font("sans_b", 14))
        d.text((tx + 14 - nw // 2, ty + 5), str(i + 1), font=font("sans_b", 14), fill=dark)
        lines = wrap(d, t, tf, W // 2 - 140)
        d.text((tx + 40, ty + 4), lines[0] if lines else t, font=tf, fill=ink)

    box_y = ry + recall_h - 78
    d.rounded_rectangle((PAD + 36, box_y, W - PAD - 36, ry + recall_h - 22), 14, fill=(20, 12, 8, 70), outline=(*ink, 80), width=1)
    d.text((PAD + 56, box_y + 8), "ONE-LINE SUMMARY", font=font("sans_b", 12), fill=muted)
    ol = wrap(d, f"“{map_.one_liner}”", font("serif", 20), W - PAD * 2 - 140)
    d.text((PAD + 56, box_y + 26), ol[0] if ol else map_.one_liner, font=font("serif", 20), fill=ink)

    brand = "booknomics"
    bf = font("sans_b", 13)
    bw, _ = _size(d, brand, bf)
    d.text((W - PAD - 36 - bw, ry + 22), brand, font=bf, fill=muted)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    layer.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path
