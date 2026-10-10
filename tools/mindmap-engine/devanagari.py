"""HarfBuzz-shaped Devanagari (and mixed-script) text for Pillow.

Pillow has no raqm here, so unshaped ImageFont would split matras.
Glyph bitmaps are cached per (font, size, gid).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import freetype
import uharfbuzz as hb
from PIL import Image, ImageFont

HERE = Path(__file__).resolve().parent
FONT_DIR = HERE / "fonts"

FONTS_HI = {
    "serif": FONT_DIR / "NotoSerifDevanagari-Regular.ttf",
    "serif_b": FONT_DIR / "NotoSerifDevanagari-Bold.ttf",
    "sans": FONT_DIR / "NotoSansDevanagari-Regular.ttf",
    "sans_b": FONT_DIR / "NotoSansDevanagari-Bold.ttf",
}

FONTS_EN = {
    "serif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "serif_b": "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "sans": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "sans_b": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
}


def _path(kind: str, hindi: bool) -> str:
    table = FONTS_HI if hindi else FONTS_EN
    p = table.get(kind) or table["sans"]
    return str(p)


@lru_cache(maxsize=16)
def _hb_font(path: str) -> tuple[hb.Face, hb.Font, int]:
    blob = hb.Blob.from_file_path(path)
    face = hb.Face(blob)
    font = hb.Font(face)
    upem = face.upem
    font.scale = (upem, upem)
    return face, font, upem


@lru_cache(maxsize=16)
def _ft_face(path: str, size: int) -> freetype.Face:
    face = freetype.Face(path)
    face.set_pixel_sizes(0, size)
    return face


@lru_cache(maxsize=8)
def _pil_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


@lru_cache(maxsize=4096)
def _glyph_bitmap(path: str, size: int, gid: int) -> tuple[int, int, int, int, bytes]:
    """Return (left, top, width, rows, pitch, buffer) for a glyph id."""
    face = _ft_face(path, size)
    face.load_glyph(gid, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_NORMAL)
    glyph = face.glyph
    bmp = glyph.bitmap
    return (
        glyph.bitmap_left,
        glyph.bitmap_top,
        bmp.width,
        bmp.rows,
        bmp.pitch,
        bytes(bmp.buffer),
    )


def _shape(path: str, text: str, size: int):
    if not text:
        return [], [], 1.0
    _face, font, upem = _hb_font(path)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf)
    return buf.glyph_infos, buf.glyph_positions, size / upem


def measure(text: str, kind: str, size: int, hindi: bool = True) -> tuple[int, int]:
    """Advance width × em-box height (ascent+descent) in pixels."""
    path = _path(kind, hindi)
    if not hindi:
        fnt = _pil_font(path, size)
        # 1px dummy image for bbox
        im = Image.new("L", (1, 1))
        box = im.getbbox()  # unused; use font getbbox
        try:
            l, t, r, b = fnt.getbbox(text or " ")
            return max(1, r - l), max(1, b - t)
        except Exception:
            return max(1, size * max(len(text), 1) // 2), size
    infos, positions, scale = _shape(path, text or " ", size)
    if not infos:
        return 1, int(size * 1.35)
    w = 0.0
    for pos in positions:
        w += pos.x_advance * scale
    face = _ft_face(path, size)
    asc = face.size.ascender / 64.0
    desc = -face.size.descender / 64.0
    return max(1, int(round(w))), max(1, int(round(asc + desc)))


def wrap(text: str, kind: str, size: int, max_w: int, hindi: bool = True) -> list[str]:
    words = (text or "").split()
    if not words:
        return []
    lines: list[str] = []
    cur = words[0]
    for w in words[1:]:
        trial = f"{cur} {w}"
        if measure(trial, kind, size, hindi)[0] <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def draw(
    img: Image.Image,
    xy: tuple[int, int],
    text: str,
    kind: str,
    size: int,
    fill: tuple[int, ...],
    hindi: bool = True,
    anchor: str = "lt",
) -> tuple[int, int]:
    """Draw shaped text onto an RGB/RGBA image. Returns (width, height)."""
    if not text:
        return 0, 0
    path = _path(kind, hindi)
    tw, th = measure(text, kind, size, hindi)
    x, y = xy
    if "c" in anchor or anchor in {"mt", "mm", "mb"}:
        x -= tw // 2
    if anchor.endswith("m"):
        y -= th // 2
    if hindi:
        _blit_hb(img, (x, y), text, path, size, fill, th)
    else:
        from PIL import ImageDraw

        ImageDraw.Draw(img).text((x, y), text, font=_pil_font(path, size), fill=fill[:3] if len(fill) >= 3 else fill)
    return tw, th


def _blit_hb(
    img: Image.Image,
    xy: tuple[int, int],
    text: str,
    path: str,
    size: int,
    fill: tuple[int, ...],
    box_h: int,
) -> None:
    infos, positions, scale = _shape(path, text, size)
    if not infos:
        return
    face = _ft_face(path, size)
    asc = face.size.ascender / 64.0
    origin_x = xy[0]
    origin_y = xy[1] + asc  # baseline
    fr, fg, fb = fill[0], fill[1], fill[2]
    px = img.load()
    w, h = img.size
    mode = img.mode
    x_pen = 0.0
    y_pen = 0.0
    for info, pos in zip(infos, positions):
        left, top, gw, rows, pitch, buf = _glyph_bitmap(path, size, info.codepoint)
        gx = int(origin_x + x_pen + pos.x_offset * scale) + left
        gy = int(origin_y + y_pen - pos.y_offset * scale) - top
        for row in range(rows):
            yy = gy + row
            if yy < 0 or yy >= h:
                continue
            row_off = row * pitch
            for col in range(gw):
                a = buf[row_off + col]
                if not a:
                    continue
                xx = gx + col
                if xx < 0 or xx >= w:
                    continue
                t = a / 255.0
                pix = px[xx, yy]
                if mode == "RGBA":
                    r, g, b, src_a = pix
                    px[xx, yy] = (
                        int(r + (fr - r) * t),
                        int(g + (fg - g) * t),
                        int(b + (fb - b) * t),
                        max(src_a, a),
                    )
                else:
                    r, g, b = pix[:3]
                    px[xx, yy] = (
                        int(r + (fr - r) * t),
                        int(g + (fg - g) * t),
                        int(b + (fb - b) * t),
                    )
        x_pen += pos.x_advance * scale
        y_pen += pos.y_advance * scale
