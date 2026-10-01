# -*- coding: utf-8 -*-
"""
Booknomics cover engine — deterministic, painted-look book covers at 800x1200.

Every cover is built from:
  * one of 15 composition archetypes (the "art")
  * one of 30 colour palettes (the "tone")
  * one of 6 Devanagari display faces + 5 text layouts
  * per-book seeded noise, motifs and texture

15 x 30 = 450 unique (archetype, palette) pairs -> one per book, so no two
books in a 450-book run share both style and tone.

Devanagari is shaped with uharfbuzz and rasterised with freetype-py, because
Pillow's wheels ship without libraqm and would render conjuncts (क्त, द्वि…)
broken.
"""

import math
import os
import random
from typing import Dict, List, Tuple

import numpy as np
import freetype as ft
import uharfbuzz as hb
from PIL import Image, ImageDraw, ImageFilter

W, H = 800, 1200
FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
LATIN_FALLBACK = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

DEV_FONTS = [
    "RozhaOne-Regular.ttf",             # high-contrast didone display
    "YatraOne-Regular.ttf",             # brushy display
    "TiroDevanagariHindi-Regular.ttf",  # literary serif
    "Martel-Bold.ttf",                  # sturdy serif
    "Khand-Bold.ttf",                   # condensed sans display
    "Hind-Bold.ttf",                    # clean sans
]

# ----------------------------------------------------------------------------
# text: shaping + raster
# ----------------------------------------------------------------------------


class ShapedFont:
    def __init__(self, path: str):
        self.path = path
        self.ft_face = ft.Face(path)
        with open(path, "rb") as fh:
            self._blob = hb.Blob(fh.read())
        self.hb_face = hb.Face(self._blob)
        self.hb_font = hb.Font(self.hb_face)
        self.upem = self.hb_face.upem

    def covers(self, ch: str) -> bool:
        return self.ft_face.get_char_index(ord(ch)) != 0

    def measure(self, text: str, size: float, fallback: "ShapedFont" = None) -> float:
        """Advance width in px, without rasterising."""
        fb = fallback or get_latin()
        pen = 0.0
        runs: List[Tuple["ShapedFont", str]] = []
        for ch in text:
            f = self if self.covers(ch) else fb
            if runs and runs[-1][0] is f:
                runs[-1][1] += ch
            else:
                runs.append([f, ch])  # type: ignore
        for font, run_text in runs:
            buf = hb.Buffer()
            buf.add_str(run_text)
            buf.guess_segment_properties()
            hb.shape(font.hb_font, buf)
            s = size / font.upem
            pen += sum(p.x_advance for p in buf.glyph_positions) * s
        return pen

    def render_line(self, text: str, size: float, fallback: "ShapedFont" = None):
        """Return (alpha ndarray float32 0..1, advance_width, asc, desc)."""
        fb = fallback or get_latin()
        self.ft_face.set_char_size(int(size * 64))
        asc = self.ft_face.size.ascender / 64.0
        desc = self.ft_face.size.descender / 64.0
        runs: List[Tuple["ShapedFont", str]] = []
        for ch in text:
            f = self if self.covers(ch) else fb
            if runs and runs[-1][0] is f:
                runs[-1][1] += ch
            else:
                runs.append([f, ch])  # type: ignore
        glyphs = []
        pen = 0.0
        for font, run_text in runs:
            buf = hb.Buffer()
            buf.add_str(run_text)
            buf.guess_segment_properties()
            hb.shape(font.hb_font, buf)
            s = size / font.upem
            for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
                glyphs.append((font, info.codepoint, pen + pos.x_offset * s, pos.y_offset * s))
                pen += pos.x_advance * s
        width = int(math.ceil(pen)) + 10
        hpx = int(math.ceil(asc - desc)) + 12
        canvas = np.zeros((hpx, max(width, 8)), dtype=np.float32)
        baseline = int(math.ceil(asc)) + 6
        for font, gid, gx, gy in glyphs:
            font.ft_face.set_char_size(int(size * 64))
            font.ft_face.load_glyph(gid, ft.FT_LOAD_RENDER | ft.FT_LOAD_NO_HINTING)
            bmp = font.ft_face.glyph.bitmap
            bw, rows, pitch = bmp.width, bmp.rows, bmp.pitch
            if bw == 0 or rows == 0:
                continue
            arr = _bmp_arr(bmp)
            x0 = int(round(gx + font.ft_face.glyph.bitmap_left))
            y0 = int(round(baseline - gy - font.ft_face.glyph.bitmap_top))
            cx0, cy0 = max(0, x0), max(0, y0)
            cx1, cy1 = min(canvas.shape[1], x0 + bw), min(canvas.shape[0], y0 + rows)
            if cx1 <= cx0 or cy1 <= cy0:
                continue
            sub = arr[cy0 - y0: cy1 - y0, cx0 - x0: cx1 - x0].astype(np.float32) / 255.0
            np.maximum(canvas[cy0:cy1, cx0:cx1], sub, out=canvas[cy0:cy1, cx0:cx1])
        return canvas, pen, asc, desc


_FONT_CACHE: Dict[str, ShapedFont] = {}
_LATIN: Dict[str, ShapedFont] = {}


def get_font(name: str) -> ShapedFont:
    if name not in _FONT_CACHE:
        _FONT_CACHE[name] = ShapedFont(os.path.join(FONT_DIR, name))
    return _FONT_CACHE[name]


def get_latin() -> ShapedFont:
    if "latin" not in _LATIN:
        _LATIN["latin"] = ShapedFont(LATIN_FALLBACK)
    return _LATIN["latin"]


def _bmp_arr(bmp):
    buf = bmp.buffer
    if not isinstance(buf, (bytes, bytearray, memoryview)):
        buf = bytes(bytearray(buf))
    return np.frombuffer(buf, dtype=np.uint8)[: bmp.rows * bmp.pitch].reshape(bmp.rows, bmp.pitch)[:, : bmp.width]


def wrap_lines(text: str, max_lines: int = 2) -> List[str]:
    words = text.split()
    if len(words) <= max_lines:
        return words if len(words) > 1 else [text]
    best = None
    n = len(words)
    for split in _splits(n, max_lines):
        lines, i = [], 0
        for k in split:
            lines.append(" ".join(words[i:i + k]))
            i += k
        score = max(len(l) for l in lines)
        if best is None or score < best[0]:
            best = (score, lines)
    return best[1]


def _splits(n, k):
    if k == 1:
        yield (n,)
        return
    for first in range(1, n - (k - 1) + 1):
        for rest in _splits(n - first, k - 1):
            yield (first,) + rest


def fit_size(font: ShapedFont, lines: List[str], max_w: float, start: float,
             floor: float = 56.0) -> float:
    size = start
    while size > floor:
        if max(font.measure(l, size) for l in lines) <= max_w:
            return size
        size -= 4
    return floor


def render_block(lines: List[str], font_name: str, size: float, gap: float = 1.30):
    """Stacked lines, each centred inside the returned canvas."""
    font = get_font(font_name)
    latin = get_latin()
    rendered = [font.render_line(l, size, latin) for l in lines]
    maxw = max(r[0].shape[1] for r in rendered) + 2
    asc, desc = rendered[0][2], rendered[0][3]
    line_h = size * gap
    total_h = int(math.ceil(line_h * (len(lines) - 1) + (asc - desc))) + 14
    canvas = np.zeros((total_h, maxw), dtype=np.float32)
    for i, (alpha, wdt, _a, _d) in enumerate(rendered):
        y = int(round(i * line_h))
        x = max(0, (maxw - alpha.shape[1]) // 2)
        hgt = min(alpha.shape[0], total_h - y)
        wdt_i = min(alpha.shape[1], maxw - x)
        np.maximum(canvas[y:y + hgt, x:x + wdt_i], alpha[:hgt, :wdt_i],
                   out=canvas[y:y + hgt, x:x + wdt_i])
    return canvas, line_h, asc


def spaced_wordmark(text: str, size: float, tracking: float = 0.62):
    """Letter-spaced latin wordmark alpha canvas."""
    font = get_latin()
    font.ft_face.set_char_size(int(size * 64))
    asc = font.ft_face.size.ascender / 64.0
    desc = font.ft_face.size.descender / 64.0
    glyphs = []
    pen = 0.0
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font.hb_font, buf)
    s = size / font.upem
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        glyphs.append((info.codepoint, pen))
        pen += pos.x_advance * s + size * tracking
    width = int(math.ceil(pen)) + 8
    hpx = int(math.ceil(asc - desc)) + 8
    canvas = np.zeros((hpx, width), dtype=np.float32)
    baseline = int(math.ceil(asc)) + 4
    for gid, gx in glyphs:
        font.ft_face.load_glyph(gid, ft.FT_LOAD_RENDER | ft.FT_LOAD_NO_HINTING)
        bmp = font.ft_face.glyph.bitmap
        bw, rows, pitch = bmp.width, bmp.rows, bmp.pitch
        if bw == 0 or rows == 0:
            continue
        arr = _bmp_arr(bmp)
        x0 = int(round(gx + font.ft_face.glyph.bitmap_left))
        y0 = int(round(baseline - font.ft_face.glyph.bitmap_top))
        cx0, cy0 = max(0, x0), max(0, y0)
        cx1, cy1 = min(width, x0 + bw), min(hpx, y0 + rows)
        if cx1 <= cx0 or cy1 <= cy0:
            continue
        sub = arr[cy0 - y0: cy1 - y0, cx0 - x0: cx1 - x0].astype(np.float32) / 255.0
        np.maximum(canvas[cy0:cy1, cx0:cx1], sub, out=canvas[cy0:cy1, cx0:cx1])
    return canvas


# ----------------------------------------------------------------------------
# colour helpers
# ----------------------------------------------------------------------------


def hx(c: str) -> np.ndarray:
    c = c.lstrip("#")
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0


def lum(c) -> float:
    c = np.asarray(c, dtype=np.float32)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])


# ----------------------------------------------------------------------------
# canvas
# ----------------------------------------------------------------------------


class Canvas:
    def __init__(self, rng: random.Random):
        self.rng = rng
        self.np_rng = np.random.default_rng(rng.getrandbits(64))
        self.a = np.zeros((H, W, 3), dtype=np.float32)

    # -- fills ------------------------------------------------------------
    def vgrad(self, c_top, c_bot, gamma: float = 1.0):
        t = np.linspace(0, 1, H, dtype=np.float32)[:, None] ** gamma
        top, bot = hx(c_top), hx(c_bot)
        self.a[:] = top[None, None, :] * (1 - t)[..., None] + bot[None, None, :] * t[..., None]

    def diag_grad(self, c0, c1, angle: float = 0.35):
        y = np.linspace(0, 1, H)[:, None] * np.ones((1, W), np.float32)
        x = np.ones((H, 1), np.float32) * np.linspace(0, 1, W)[None, :]
        t = (y * (1 - angle) + x * angle)
        t = (t - t.min()) / max(1e-6, (t.max() - t.min()))
        a, b = hx(c0), hx(c1)
        self.a[:] = a[None, None, :] * (1 - t)[..., None] + b[None, None, :] * t[..., None]

    def flat(self, c):
        self.a[:] = hx(c)[None, None, :]

    # -- noise / masks ----------------------------------------------------
    def fbm(self, cells: int = 6, octaves: int = 4, seed_off: int = 0) -> np.ndarray:
        out = np.zeros((H, W), np.float32)
        amp, tot = 1.0, 0.0
        for o in range(octaves):
            gh, gw = max(2, cells * (2 ** o) // 2), max(2, cells * (2 ** o))
            g = self.np_rng.random((gh + 1, gw + 1)).astype(np.float32)
            im = Image.fromarray((g * 255).astype(np.uint8))
            im = im.resize((W, H), Image.BICUBIC)
            out += amp * (np.asarray(im, np.float32) / 255.0)
            tot += amp
            amp *= 0.55
        return out / tot

    def blur_mask(self, mask: np.ndarray, radius: float) -> np.ndarray:
        im = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), "L")
        if radius > 0:
            im = im.filter(ImageFilter.GaussianBlur(radius))
        return np.asarray(im, np.float32) / 255.0

    def glow(self, cx, cy, r, color, strength=1.0, hard=2.0):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(1.0, r)
        m = np.exp(-(d ** 2) * hard) * strength
        self.overlay(np.asarray(hx(color))[None, None, :], m)

    def overlay(self, color, mask, mode="over"):
        mask = np.asarray(mask, np.float32)
        while mask.ndim > 2:
            mask = mask[..., 0]
        m = np.clip(mask, 0, 1)[..., None]
        if isinstance(color, str):
            color = hx(color)
        color = np.asarray(color, np.float32)
        if color.ndim == 2:
            color = color[..., None]
        if mode == "over":
            self.a = self.a * (1 - m) + color * m
        elif mode == "screen":
            self.a = 1 - (1 - self.a) * (1 - color * m)
        elif mode == "multiply":
            self.a = self.a * (1 - m + m * color)
        elif mode == "add":
            self.a = np.clip(self.a + color * m, 0, 1)

    def mask_draw(self):
        """Context: PIL L-mode mask + draw, blurred on exit via helper."""
        im = Image.new("L", (W, H), 0)
        return im, ImageDraw.Draw(im)

    def stamp(self, mask_im: Image.Image, color, alpha=1.0, blur=0.0, mode="over"):
        if blur > 0:
            mask_im = mask_im.filter(ImageFilter.GaussianBlur(blur))
        m = np.asarray(mask_im, np.float32) / 255.0 * alpha
        self.overlay(color, m, mode)

    # -- finish -----------------------------------------------------------
    def grain(self, amount=0.035):
        n = self.np_rng.normal(0, 1, (H, W)).astype(np.float32)
        n = self.blur_mask(n[..., 0], 0.6)[..., None]
        self.a = np.clip(self.a + n * amount, 0, 1)

    def paper(self, amount=0.05):
        n = self.fbm(cells=90, octaves=2)
        self.a = np.clip(self.a * (1 - amount * 0.5 + amount * n[..., None]), 0, 1)

    def brush_streaks(self, amount=0.04):
        g = self.np_rng.random((H, 6)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        n = np.asarray(im, np.float32) / 255.0
        self.a = np.clip(self.a * (1 - amount * 0.5 + amount * n[..., None]), 0, 1)

    def vignette(self, strength=0.32):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        dx = (xx - W / 2) / (W / 2)
        dy = (yy - H / 2) / (H / 2)
        d = np.sqrt(dx * dx + dy * dy) / math.sqrt(2)
        m = np.clip((d - 0.55) / 0.45, 0, 1) ** 1.6 * strength
        self.a *= (1 - m[..., None])

    def image(self) -> Image.Image:
        return Image.fromarray((np.clip(self.a, 0, 1) * 255).astype(np.uint8), "RGB")


# ----------------------------------------------------------------------------
# silhouette / motif helpers (all return PIL L masks or draw directly)
# ----------------------------------------------------------------------------


def ridge_points(rng, y_base, amp, rough=0.55, n=9):
    xs = np.linspace(0, W, n + 1)
    ys = y_base - amp * (0.35 + 0.65 * np.array([rng.random() for _ in range(n + 1)], np.float32))
    # smooth-ish
    for _ in range(2):
        ys[1:-1] = (ys[:-2] + ys[2:]) / 2 * rough + ys[1:-1] * (1 - rough)
    return xs, ys


def ridge_mask(rng, y_base, amp, rough=0.5, blur=0.0):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    xs, ys = ridge_points(rng, y_base, amp, rough)
    pts = [(0, H)] + list(zip(xs, ys)) + [(W, H)]
    d.polygon(pts, fill=255)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return im


def tree_mask(rng, x, y, height, lean=0.0):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)

    def branch(px, py, ang, ln, wd, depth):
        if depth == 0 or ln < 4:
            return
        ex = px + math.cos(ang) * ln
        ey = py + math.sin(ang) * ln
        d.line([(px, py), (ex, ey)], fill=255, width=max(1, int(wd)))
        kids = rng.randint(2, 3)
        for _ in range(kids):
            na = ang + rng.uniform(-0.65, 0.65)
            branch(ex, ey, na, ln * rng.uniform(0.62, 0.78), wd * 0.62, depth - 1)

    branch(x, y, -math.pi / 2 + lean, height * 0.32, height * 0.055, 6)
    # foliage blobs
    for _ in range(rng.randint(9, 15)):
        cx = x + rng.uniform(-height * 0.26, height * 0.26)
        cy = y - height * rng.uniform(0.52, 0.98)
        r = rng.uniform(height * 0.055, height * 0.115)
        d.ellipse([cx - r, cy - r * 0.82, cx + r, cy + r * 0.82], fill=255)
    return im.filter(ImageFilter.GaussianBlur(1.2))


def birds_draw(d, cx, cy, n, spread, size, width=3):
    for _ in range(n):
        x = cx + random.uniform(-spread, spread)
        y = cy + random.uniform(-spread * 0.4, spread * 0.4)
        s = size * random.uniform(0.7, 1.3)
        d.arc([x - s, y - s * 0.7, x, y + s * 0.2], 200, 340, fill=255, width=width)
        d.arc([x, y - s * 0.7, x + s, y + s * 0.2], 200, 340, fill=255, width=width)


def moon_mask(cx, cy, r, phase=0.0):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    if phase > 0:
        d.ellipse([cx - r + phase * r * 1.4, cy - r, cx + r + phase * r * 1.4, cy + r], fill=0)
    return im


def stars_layer(cv, n, y_max, bright=0.9):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = cv.rng.uniform(0, W)
        y = cv.rng.uniform(0, y_max)
        r = cv.rng.uniform(0.6, 2.2)
        a = int(255 * cv.rng.uniform(0.35, bright))
        d.ellipse([x - r, y - r, x + r, y + r], fill=a)
    return im


def rain_mask(rng, n, slant=0.22, y0=0, y1=H):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = rng.uniform(-100, W)
        y = rng.uniform(y0, y1)
        ln = rng.uniform(26, 70)
        d.line([(x, y), (x + slant * ln, y + ln)], fill=int(255 * rng.uniform(0.25, 0.7)), width=2)
    return im


def embers_mask(rng, n, cx, cy, spread, rise):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = cx + rng.gauss(0, spread)
        y = cy - rng.uniform(0, rise)
        r = rng.uniform(1.2, 4.0) * max(0.35, 1 - (cy - y) / rise)
        d.ellipse([x - r, y - r, x + r, y + r], fill=int(255 * rng.uniform(0.4, 1.0)))
    return im.filter(ImageFilter.GaussianBlur(1.1))


def lotus_mask(cx, cy, r, petals=9):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for i in range(petals):
        t = i / (petals - 1)
        ang = math.pi * (1.08 - 0.16 * t) + t * math.pi * (-0.08)  # fan upwards
        ang = math.pi + t * math.pi  # pi..2pi (upper half)
        tilt = (t - 0.5) * 2.2  # -1.1..1.1
        ln = r * (1.0 - 0.28 * abs(t - 0.5) * 2)
        bw = r * 0.30
        tipx = cx + math.sin(tilt) * ln
        tipy = cy - math.cos(tilt) * ln
        bx = cx + math.sin(tilt) * ln * 0.25
        by = cy - math.cos(tilt) * ln * 0.25
        px_, py_ = -math.cos(tilt), -math.sin(tilt)  # perpendicular
        d.polygon([(bx + px_ * bw, by + py_ * bw),
                   (tipx, tipy),
                   (bx - px_ * bw, by - py_ * bw),
                   (bx - px_ * bw * 0.6, by + r * 0.12)], fill=255)
    d.ellipse([cx - r * 0.34, cy - r * 0.16, cx + r * 0.34, cy + r * 0.30], fill=255)
    return im


def diya_mask(cx, cy, r):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    d.pieslice([cx - r, cy - r * 0.62, cx + r, cy + r * 0.62], 0, 180, fill=255)
    d.ellipse([cx - r * 1.05, cy - r * 0.20, cx + r * 1.05, cy + r * 0.16], fill=255)
    return im


def flame_mask(cx, cy, h):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    w = h * 0.42
    pts = [(cx, cy - h)]
    for t in np.linspace(0, 1, 14):
        pts.append((cx + w * math.sin(t * math.pi) * (1 - t * 0.25), cy - h + t * h))
    for t in np.linspace(1, 0, 14):
        pts.append((cx - w * math.sin(t * math.pi) * (1 - t * 0.25), cy - h + t * h))
    d.polygon(pts, fill=255)
    return im


def arch_mask(x0, y0, x1, y1, point=0.55):
    """Pointed jharokha arch opening."""
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    cx = (x0 + x1) / 2
    rw = (x1 - x0) / 2
    spring = y0 + (y1 - y0) * 0.30
    d.rectangle([x0, spring, x1, y1], fill=255)
    d.pieslice([cx - rw, y0 - rw * point, cx + rw, y0 + rw * (2 - point)], 180, 360, fill=255)
    d.polygon([(x0, spring), (cx, y0 - rw * point * 0.2), (x1, spring)], fill=255)
    return im


def rays_mask(cx, cy, n, r0, r1, width_frac=0.5):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for i in range(n):
        a0 = i * 2 * math.pi / n
        a1 = a0 + width_frac * 2 * math.pi / n
        pts = [(cx + math.cos(a0) * r0, cy + math.sin(a0) * r0),
               (cx + math.cos(a0) * r1, cy + math.sin(a0) * r1),
               (cx + math.cos(a1) * r1, cy + math.sin(a1) * r1),
               (cx + math.cos(a1) * r0, cy + math.sin(a1) * r0)]
        d.polygon(pts, fill=255)
    return im


def warli_figure(d, x, y, s):
    d.ellipse([x - s * 0.16, y - s, x + s * 0.16, y - s * 0.68], outline=255, width=3)
    d.polygon([(x, y - s * 0.68), (x - s * 0.22, y - s * 0.34), (x, y), (x + s * 0.22, y - s * 0.34)], outline=255)
    d.line([(x - s * 0.42, y - s * 0.62), (x + s * 0.42, y - s * 0.62)], fill=255, width=3)
    d.line([(x, y), (x - s * 0.24, y + s * 0.42)], fill=255, width=3)
    d.line([(x, y), (x + s * 0.24, y + s * 0.42)], fill=255, width=3)


def block_motif(d, cx, cy, r):
    for i in range(4):
        ang = i * math.pi / 2
        px, py = cx + math.cos(ang) * r * 0.62, cy + math.sin(ang) * r * 0.62
        d.ellipse([px - r * 0.42, py - r * 0.42, px + r * 0.42, py + r * 0.42], outline=255, width=3)
    d.ellipse([cx - r * 0.2, cy - r * 0.2, cx + r * 0.2, cy + r * 0.2], fill=255)


def peacock_eye(cv, cx, cy, r, P):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - r, cy - r * 1.25, cx + r, cy + r * 0.75], fill=255)
    cv.stamp(im, P["a1"], blur=r * 0.10)
    im2 = Image.new("L", (W, H), 0)
    d2 = ImageDraw.Draw(im2)
    d2.ellipse([cx - r * 0.66, cy - r * 0.9, cx + r * 0.66, cy + r * 0.42], fill=255)
    cv.stamp(im2, P["a2"], blur=r * 0.08)
    im3 = Image.new("L", (W, H), 0)
    d3 = ImageDraw.Draw(im3)
    d3.ellipse([cx - r * 0.32, cy - r * 0.52, cx + r * 0.32, cy + r * 0.10], fill=255)
    cv.stamp(im3, P["a3"], blur=r * 0.05)


# ----------------------------------------------------------------------------
# palettes (30 tones)
# ----------------------------------------------------------------------------

def _pal(name, bg0, bg1, a1, a2, a3, glow, light, dark):
    return dict(name=name, bg0=bg0, bg1=bg1, a1=a1, a2=a2, a3=a3, glow=glow,
                light=light, dark=dark)


PALETTES = [
    _pal("indigo_gold",   "#0e1330", "#25315e", "#3a4a8c", "#8ea0d8", "#d9c27a", "#ffd98a", "#f3ecd8", "#10142b"),
    _pal("terracotta_dusk","#2b1310", "#7a2e1d", "#a8442a", "#d97b4f", "#f2c078", "#ffcf87", "#f7e8d3", "#2a120c"),
    _pal("monsoon_teal",  "#062a2b", "#0f4c4a", "#177067", "#4fa893", "#cfe8d8", "#bff0d9", "#eef7ee", "#062a2b"),
    _pal("marigold",      "#4a2c07", "#8a5a10", "#c98a1b", "#e8b54a", "#f7dfa0", "#ffe9a8", "#fff6e0", "#3c2506"),
    _pal("rose_madder",   "#33101c", "#6d1f36", "#a3324e", "#d4607a", "#f2b8c6", "#ffd3da", "#fdeef4", "#2c0d18"),
    _pal("sepia_archive", "#2e2620", "#5c4a38", "#8a7358", "#bda483", "#e6d3b3", "#f0dfc0", "#f2e7d0", "#241d15"),
    _pal("emerald_court", "#06231a", "#0d4634", "#1a6b4a", "#48a06f", "#bfe3c0", "#d8f5c8", "#eef8e8", "#06231a"),
    _pal("royal_plum",    "#1d0f2e", "#3c2160", "#5b3390", "#8f66c9", "#d9c2f0", "#e8d4ff", "#f3ecff", "#170b26"),
    _pal("charcoal_ember","#101010", "#262626", "#3d3d3d", "#6e6e6e", "#c9c9c9", "#ff8c42", "#f2f2f2", "#141414"),
    _pal("ivory_mint",    "#e8f0e4", "#c2d8c6", "#9dc0a4", "#6f9a7c", "#38604a", "#fff8dc", "#f7fbf4", "#1e3a2c"),
    _pal("sindoor_crimson","#3a0a06", "#7e1408", "#b0200f", "#e04b24", "#ff9d66", "#ffd0a0", "#ffece0", "#300804"),
    _pal("peacock_blue",  "#04222e", "#0a4a5c", "#0f7285", "#2ba3a8", "#9adbc8", "#c8f0e0", "#eafaf2", "#032029"),
    _pal("sandstone",     "#d9c7a7", "#b39b78", "#8f7654", "#6b563c", "#463627", "#fff2d0", "#f6ecd8", "#33261a"),
    _pal("olive_khadi",   "#2c2b1a", "#4d4a2a", "#6f6a3c", "#9a9458", "#cfc78a", "#efe6b0", "#f2ecd2", "#23220f"),
    _pal("navy_gold",     "#0a1a33", "#123059", "#1d4d8c", "#3f7ec2", "#d9b45a", "#ffd77a", "#f0ead6", "#0a1a33"),
    _pal("plum_twilight", "#241026", "#4a2547", "#6d3a63", "#a05c88", "#e0a8c0", "#ffd0e0", "#fbeef5", "#200e21"),
    _pal("forest_fog",    "#16211c", "#2c4034", "#44604c", "#74907c", "#b8ccb4", "#e0ecd8", "#eef4ea", "#141d18"),
    _pal("copper_rust",   "#1f1a17", "#43302a", "#6d4a3a", "#a06a4a", "#4f8a7a", "#e8b48a", "#f4e8dc", "#1c1512"),
    _pal("coral_dawn",    "#361a20", "#7a3a44", "#c06a5a", "#e89a7a", "#ffd0a8", "#ffe0c0", "#fff0e4", "#2e151b"),
    _pal("slate_rain",    "#1a2026", "#33404a", "#4a5a66", "#7a8c98", "#b8c8d2", "#d8e4ec", "#eef2f5", "#161c22"),
    _pal("saffron_temple","#4d1c02", "#93400a", "#c96a10", "#e89a2a", "#f7ce6a", "#ffe08a", "#fff4dc", "#3a1502"),
    _pal("jade_museum",   "#e4ece6", "#bcd0c4", "#8aab98", "#5d8471", "#2f5244", "#fffbe8", "#f8fcf8", "#1c332a"),
    _pal("wine_cellar",   "#200a12", "#46152a", "#6d2044", "#9c3a62", "#d4889c", "#f0c0cc", "#f8ecf0", "#1c0810"),
    _pal("mustard_village","#3a3010", "#6b5a1c", "#9a8428", "#c2aa44", "#e8d478", "#f8eca0", "#f8f2d8", "#2c2408"),
    _pal("ice_pale",      "#dfe8ee", "#b8ccd8", "#8caabc", "#5d849c", "#2f5068", "#ffffff", "#f8fcff", "#16303f"),
    _pal("black_gold_deco","#0c0c0e", "#1c1c22", "#2e2c38", "#57536a", "#d4af37", "#f0d060", "#f0e6c8", "#0c0c0e"),
    _pal("dusty_pink",    "#3a2430", "#6d4a58", "#9c7284", "#c49aa8", "#e8c8d0", "#f8e0e4", "#faf0f4", "#2e1c26"),
    _pal("ocean_deep",    "#02121f", "#063049", "#0a4d6e", "#12799c", "#6ec4d4", "#b8ecf0", "#e8f8fa", "#02121f"),
    _pal("burnt_umber",   "#241410", "#4a2c1c", "#6e4426", "#9c6a3c", "#d4a868", "#f0d098", "#f4e8d4", "#1e100c"),
    _pal("basant_spring", "#2e3a10", "#556b1c", "#7c9a28", "#a8c244", "#e8e08a", "#f8f0a0", "#f8f8dc", "#242e08"),
]

ARCHETYPES = [
    "dawn_village", "moon_river", "diya_night", "monsoon_tree", "mist_mountains",
    "lotus_pond", "jharokha_arch", "wheat_noon", "ink_brush", "deco_city",
    "warli_folk", "sufi_stars", "ember_pyre", "block_print", "minimal_wave",
]


# ----------------------------------------------------------------------------
# the 15 composition archetypes
# ----------------------------------------------------------------------------

def art_dawn_village(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"], gamma=0.9)
    sx, sy = focal
    cv.glow(sx, sy, 300, P["glow"], 0.85)
    cv.stamp(moon_mask(sx, sy, 52), P["a3"], blur=2)
    im, d = cv.mask_draw()
    birds_draw(d, W * 0.3, H * 0.30, rng.randint(3, 5), 150, 14)
    cv.stamp(im, P["dark"], alpha=0.75, blur=0.8)
    cv.stamp(ridge_mask(rng, H * 0.66, 90, blur=6), P["a1"], alpha=0.9)
    cv.stamp(ridge_mask(rng, H * 0.78, 70, blur=2), P["a2"], alpha=0.55)
    # hut + tree silhouette
    im, d = cv.mask_draw()
    hx0 = rng.uniform(120, 520)
    hy = H * 0.86
    d.rectangle([hx0, hy - 70, hx0 + 150, hy], fill=255)
    d.polygon([(hx0 - 18, hy - 66), (hx0 + 75, hy - 128), (hx0 + 168, hy - 66)], fill=255)
    cv.stamp(im, P["dark"], alpha=0.95, blur=1)
    cv.stamp(tree_mask(rng, hx0 + 260, H * 0.88, 300), P["dark"], alpha=0.95)
    mist, _ = cv.mask_draw()
    dm = ImageDraw.Draw(mist)
    for _ in range(3):
        y = rng.uniform(H * 0.60, H * 0.72)
        dm.ellipse([rng.uniform(-100, 200), y - 26, rng.uniform(500, 900), y + 26], fill=90)
    cv.stamp(mist, P["a3"], alpha=0.30, blur=18)


def art_moon_river(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"])
    cv.stamp(stars_layer(cv, rng.randint(70, 110), H * 0.5), P["light"], alpha=0.8, blur=0.4)
    mx, my = focal
    cv.glow(mx, my, 240, P["glow"], 0.8)
    cv.stamp(moon_mask(mx, my, 58, phase=rng.choice([0, 0, 0.35])), P["light"], blur=1.5)
    ry = max(H * rng.uniform(0.60, 0.68), my + 190)
    im, d = cv.mask_draw()
    d.rectangle([0, ry, W, H], fill=255)
    cv.stamp(im, P["a1"], alpha=0.85)
    # moon path on water
    im, d = cv.mask_draw()
    y = ry + 10
    while y < H - 30:
        wdt = rng.uniform(30, 130) * (1 - (y - ry) / (H - ry) * 0.4)
        d.line([(mx - wdt / 2, y), (mx + wdt / 2, y)], fill=int(255 * rng.uniform(0.3, 0.9)), width=rng.randint(2, 5))
        y += rng.uniform(10, 22)
    cv.stamp(im, P["glow"], alpha=0.75, blur=2.5, mode="screen")
    # ripples
    im, d = cv.mask_draw()
    for _ in range(26):
        y = rng.uniform(ry + 8, H - 10)
        x = rng.uniform(0, W - 160)
        d.arc([x, y, x + rng.uniform(60, 160), y + 10], 10, 170, fill=int(255 * rng.uniform(0.2, 0.5)), width=2)
    cv.stamp(im, P["a3"], alpha=0.5, blur=0.8)
    cv.stamp(ridge_mask(rng, ry + 6, 26, blur=3), P["dark"], alpha=0.9)


def art_diya_night(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"], gamma=1.25)
    n = cv.fbm(cells=10, octaves=3)
    cv.overlay(np.array(hx(P["a1"]))[None, None, :], n * 0.25, mode="multiply")
    cx = min(max(focal[0], W * 0.38), W * 0.62)
    cy = min(max(focal[1], H * 0.30), H * 0.72)
    cv.glow(cx, cy - 40, 330, P["glow"], 0.95, hard=1.6)
    cv.stamp(diya_mask(cx, cy, 92), P["a2"], blur=1)
    cv.stamp(diya_mask(cx, cy + 6, 92), P["dark"], alpha=0.35, blur=2)
    fm = flame_mask(cx, cy - 6, 96)
    cv.stamp(fm, P["a3"], blur=2.5, mode="screen")
    cv.stamp(flame_mask(cx, cy - 14, 62), P["light"], blur=2, mode="screen")
    cv.stamp(embers_mask(rng, 34, cx, cy - 60, 130, 420), P["glow"], alpha=0.8, mode="screen")
    # shelf + rangoli dots
    im, d = cv.mask_draw()
    d.rectangle([cx - 220, cy + 46, cx + 220, cy + 60], fill=255)
    cv.stamp(im, P["dark"], alpha=0.8, blur=1)
    im, d = cv.mask_draw()
    for i in range(9):
        ang = math.pi * (0.15 + 0.7 * i / 8)
        x = cx + math.cos(ang) * 300
        y = cy + 120 + math.sin(ang) * 60
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=200)
    cv.stamp(im, P["a3"], alpha=0.5, blur=1.5)


def art_monsoon_tree(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"])
    im, d = cv.mask_draw()
    for _ in range(rng.randint(5, 8)):
        x = rng.uniform(-80, W)
        y = rng.uniform(-40, H * 0.30)
        r = rng.uniform(90, 190)
        d.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5], fill=int(255 * rng.uniform(0.3, 0.7)))
    cv.stamp(im, P["a2"], alpha=0.55, blur=26)
    cv.stamp(rain_mask(rng, rng.randint(120, 180)), P["a3"], alpha=0.4, blur=0.6)
    cv.stamp(ridge_mask(rng, H * 0.84, 40, blur=2), P["dark"], alpha=0.95)
    cv.stamp(tree_mask(rng, W * rng.uniform(0.30, 0.70), H * 0.86, 480, lean=rng.uniform(-0.12, 0.12)), P["dark"], alpha=0.96)
    im, d = cv.mask_draw()
    for _ in range(4):
        x = rng.uniform(60, W - 200)
        y = rng.uniform(H * 0.88, H * 0.96)
        d.ellipse([x, y, x + rng.uniform(90, 190), y + 14], fill=120)
    cv.stamp(im, P["a3"], alpha=0.35, blur=4)


def art_mist_mountains(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"], gamma=0.85)
    sx, sy = focal
    cv.glow(sx, sy, 260, P["glow"], 0.7)
    cv.stamp(moon_mask(sx, sy, 44), P["a3"], blur=2)
    ys = [0.52, 0.66, 0.80]
    cols = [P["a2"], P["a1"], P["dark"]]
    blurs = [10, 5, 1]
    for y, c, b in zip(ys, cols, blurs):
        cv.stamp(ridge_mask(rng, H * y, H * 0.16, rough=0.7, blur=b), c, alpha=0.92)
        mist, d = cv.mask_draw()
        dm = ImageDraw.Draw(mist)
        for _ in range(2):
            my = H * y + rng.uniform(-30, 30)
            dm.ellipse([rng.uniform(-150, 250), my - 22, rng.uniform(520, 950), my + 22], fill=110)
        cv.stamp(mist, P["a3"], alpha=0.28, blur=20)
    im, d = cv.mask_draw()
    birds_draw(d, W * 0.62, H * 0.42, 3, 90, 11)
    cv.stamp(im, P["dark"], alpha=0.7, blur=0.7)


def art_lotus_pond(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"], gamma=1.1)
    wy = H * rng.uniform(0.52, 0.60)
    im, d = cv.mask_draw()
    d.rectangle([0, wy, W, H], fill=255)
    cv.stamp(im, P["a1"], alpha=0.75)
    im, d = cv.mask_draw()
    for _ in range(30):
        y = rng.uniform(wy + 10, H - 12)
        x = rng.uniform(-40, W - 120)
        d.arc([x, y, x + rng.uniform(80, 200), y + 12], 8, 172, fill=int(255 * rng.uniform(0.15, 0.45)), width=2)
    cv.stamp(im, P["a3"], alpha=0.5, blur=1)
    for _ in range(rng.randint(2, 4)):
        x = rng.uniform(80, W - 80)
        y = rng.uniform(wy + 60, H - 60)
        r = rng.uniform(50, 90)
        im, d = cv.mask_draw()
        d.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5], fill=255)
        d.line([(x, y), (x + r * 0.95, y + r * 0.18)], fill=0, width=3)
        cv.stamp(im, P["a2"], alpha=0.8, blur=1.2)
    lx, ly = W * rng.uniform(0.35, 0.65), wy + rng.uniform(50, 120)
    cv.glow(lx, ly - 30, 150, P["glow"], 0.42)
    cv.stamp(lotus_mask(lx, ly, 130), P["a2"], blur=0.8)
    cv.stamp(lotus_mask(lx, ly + 6, 88), P["a3"], blur=0.8)
    cv.stamp(lotus_mask(lx, ly + 12, 52), P["light"], alpha=0.9, blur=0.8)


def art_jharokha_arch(cv, P, rng, focal):
    cv.flat(P["bg0"])
    n = cv.fbm(cells=14, octaves=3)
    cv.overlay(np.array(hx(P["a1"]))[None, None, :], n * 0.35, mode="multiply")
    x0, y0, x1, y1 = 130, 500, W - 130, H - 130
    am = arch_mask(x0, y0, x1, y1)
    # inner scene
    inner = Canvas(rng)
    inner.vgrad(P["a2"], P["a3"], gamma=0.8)
    inner.glow(W * 0.5, H * 0.42, 240, P["glow"], 0.8)
    inner.stamp(moon_mask(W * 0.5, H * 0.40, 46), P["light"], blur=2)
    inner.stamp(ridge_mask(rng, H * 0.72, 60, blur=2), P["dark"], alpha=0.9)
    im, d = inner.mask_draw()
    # domes skyline
    for _ in range(rng.randint(3, 5)):
        cx = rng.uniform(120, W - 120)
        cy = H * rng.uniform(0.66, 0.74)
        r = rng.uniform(34, 62)
        d.rectangle([cx - r * 0.8, cy, cx + r * 0.8, cy + 90], fill=255)
        d.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=255)
        d.line([(cx, cy - r - 26), (cx, cy - r)], fill=255, width=4)
    inner.stamp(im, P["dark"], alpha=0.95, blur=1)
    inner_img = np.asarray(inner.image(), np.float32) / 255.0
    m = (np.asarray(am, np.float32) / 255.0)[..., None]
    cv.a = cv.a * (1 - m) + inner_img * m
    # arch frame stroke
    im, d = cv.mask_draw()
    d.bitmap((0, 0), am, fill=0)
    am2 = arch_mask(x0 - 14, y0 - 14, x1 + 14, y1 + 14)
    d.bitmap((0, 0), am2, fill=255)
    d.bitmap((0, 0), am, fill=0)
    cv.stamp(im, P["a3"], alpha=0.95, blur=1)
    # spandrel motifs + border dots
    im, d = cv.mask_draw()
    for (mx, my) in [(90, 150), (W - 90, 150), (90, H - 130), (W - 90, H - 130)]:
        block_motif(d, mx, my, 34)
    for i in range(24):
        x = 60 + i * (W - 120) / 23
        d.ellipse([x - 4, 60 - 4, x + 4, 60 + 4], fill=255)
        d.ellipse([x - 4, H - 60 - 4, x + 4, H - 60 + 4], fill=255)
    cv.stamp(im, P["a3"], alpha=0.6, blur=0.6)


def art_wheat_noon(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["a2"], gamma=0.7)
    sx = focal[0]
    fy = H * rng.uniform(0.58, 0.64)
    sy = min(focal[1], fy - 130)
    cv.glow(sx, sy, 320, P["glow"], 0.95, hard=1.4)
    cv.stamp(moon_mask(sx, sy, 60), P["light"], blur=2)
    im, d = cv.mask_draw()
    d.rectangle([0, fy, W, H], fill=255)
    cv.stamp(im, P["a1"], alpha=0.95, blur=3)
    # vertical wheat strokes
    g = cv.np_rng.random((12, W)).astype(np.float32)
    imv = Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    strokes = np.asarray(imv, np.float32) / 255.0
    band = np.zeros((H, W), np.float32)
    band[int(fy):, :] = 1
    cv.overlay(np.array(hx(P["a3"]))[None, None, :], strokes * band * 0.5)
    cv.glow(sx, fy, 260, P["glow"], 0.5)
    im, d = cv.mask_draw()
    birds_draw(d, W * 0.26, sy + 90, 4, 120, 12)
    cv.stamp(im, P["dark"], alpha=0.7, blur=0.7)
    cv.stamp(tree_mask(rng, W * rng.uniform(0.12, 0.24), fy + 40, 240), P["dark"], alpha=0.9)


def art_ink_brush(cv, P, rng, focal):
    paper = P["light"]
    cv.flat(paper)
    cv.paper(0.10)
    cv.overlay(np.array(hx(P["a2"]))[None, None, :], cv.fbm(8, 3)[..., None] * 0.10, mode="multiply")
    ink = P["dark"]
    for i, (yb, amp, al) in enumerate([(0.52, 150, 0.55), (0.66, 120, 0.75), (0.82, 90, 0.95)]):
        im = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(im)
        xs, ys = ridge_points(rng, H * yb, amp, rough=0.8, n=7)
        pts = [(0, H)] + list(zip(xs, ys)) + [(W, H)]
        d.polygon(pts, fill=255)
        dry = np.asarray(im, np.float32) / 255.0
        dry *= (0.75 + 0.25 * cv.fbm(60, 2))
        cv.stamp(Image.fromarray((np.clip(dry, 0, 1) * 255).astype(np.uint8), "L"), ink, alpha=al, blur=1.2)
    # boat stroke
    im, d = cv.mask_draw()
    bx, by = W * rng.uniform(0.3, 0.6), H * rng.uniform(0.44, 0.50)
    d.pieslice([bx - 70, by - 26, bx + 70, by + 26], 0, 180, fill=255)
    d.line([(bx, by - 8), (bx, by - 60)], fill=255, width=5)
    cv.stamp(im, ink, alpha=0.9, blur=1)
    # vermilion seal
    im, d = cv.mask_draw()
    sx, sy = W - 130, H * 0.20
    d.rounded_rectangle([sx - 34, sy - 34, sx + 34, sy + 34], 6, fill=255)
    cv.stamp(im, "#b0200f", alpha=0.85, blur=0.8)


def art_deco_city(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"])
    cx, cy = focal
    cv.stamp(rays_mask(cx, cy, rng.choice([16, 24]), 90, 900), P["a2"], alpha=0.35, blur=3)
    cv.glow(cx, cy, 220, P["glow"], 0.8)
    im, d = cv.mask_draw()
    for r in (70, 110, 150):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=255, width=3)
    cv.stamp(im, P["a3"], alpha=0.8, blur=0.8)
    cv.stamp(moon_mask(cx, cy, 46), P["a3"], blur=1.5)
    # stepped skyline
    im, d = cv.mask_draw()
    x = 0
    base = H * rng.uniform(0.72, 0.80)
    while x < W:
        wdt = rng.uniform(50, 110)
        hgt = rng.uniform(60, 220) * (1 - abs(x + wdt / 2 - W / 2) / W * 0.9)
        d.rectangle([x, H - hgt - (H - base), x + wdt - 6, H], fill=255)
        x += wdt
    cv.stamp(im, P["dark"], alpha=0.96, blur=0.8)
    # windows
    im, d = cv.mask_draw()
    for _ in range(60):
        x = rng.uniform(20, W - 20)
        y = rng.uniform(base - 40, H - 30)
        d.rectangle([x, y, x + 5, y + 8], fill=int(255 * rng.uniform(0.3, 1)))
    cv.stamp(im, P["glow"], alpha=0.8, blur=0.6, mode="screen")


def art_warli_folk(cv, P, rng, focal):
    cv.flat(P["bg1"])
    cv.paper(0.08)
    lt = P["light"]
    im, d = cv.mask_draw()
    for yb in (90, H - 90):
        for x in range(20, W - 20, 26):
            d.polygon([(x, yb), (x + 13, yb - 14), (x + 26, yb)], outline=255)
            d.polygon([(x, yb + (22 if yb < H / 2 else -22)), (x + 13, yb + (8 if yb < H / 2 else -8)), (x + 26, yb + (22 if yb < H / 2 else -22))], outline=255)
    cv.stamp(im, lt, alpha=0.75, blur=0.5)
    im, d = cv.mask_draw()
    n = rng.randint(4, 6)
    for i in range(n):
        x = 110 + i * (W - 220) / max(1, n - 1)
        warli_figure(d, x, H * 0.52, rng.uniform(70, 95))
    # sun & moon
    d.ellipse([90, 190, 190, 290], outline=255, width=4)
    for a in range(12):
        ang = a * math.pi / 6
        d.line([(140 + math.cos(ang) * 58, 240 + math.sin(ang) * 58), (140 + math.cos(ang) * 74, 240 + math.sin(ang) * 74)], fill=255, width=3)
    d.ellipse([W - 190, 190, W - 90, 290], outline=255, width=4)
    # animal
    ax, ay = W * 0.5, H * 0.70
    d.polygon([(ax - 60, ay), (ax + 60, ay), (ax, ay - 44)], outline=255)
    for lx in (-48, -20, 20, 48):
        d.line([(ax + lx, ay), (ax + lx, ay + 40)], fill=255, width=3)
    d.line([(ax + 60, ay), (ax + 84, ay - 26)], fill=255, width=3)
    cv.stamp(im, lt, alpha=0.9, blur=0.5)
    cv.stamp(ridge_mask(rng, H * 0.88, 30, blur=1), P["a1"], alpha=0.5)


def art_sufi_stars(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["bg1"], gamma=1.2)
    cv.stamp(stars_layer(cv, rng.randint(90, 130), H * 0.75), P["light"], alpha=0.7, blur=0.4)
    cx, cy = focal
    cv.stamp(moon_mask(cx, cy, 42, phase=0.38), P["light"], blur=1.5)
    # spiral of stars
    im, d = cv.mask_draw()
    for t in np.linspace(0, 5.4 * math.pi, 160):
        r = 16 + t * 22
        x = cx + math.cos(t) * r
        y = cy + math.sin(t) * r * 0.82
        if 0 <= x < W and 0 <= y < H:
            s = rng.uniform(1.0, 2.6)
            d.ellipse([x - s, y - s, x + s, y + s], fill=int(255 * rng.uniform(0.35, 1)))
    cv.stamp(im, P["glow"], alpha=0.85, blur=0.8, mode="screen")
    # whirling rings
    im, d = cv.mask_draw()
    for i, r in enumerate((90, 150, 210)):
        d.arc([cx - r, cy - r * 0.8, cx + r, cy + r * 0.8], rng.uniform(0, 90), rng.uniform(200, 300), fill=255, width=2)
    cv.stamp(im, P["a2"], alpha=0.6, blur=1.2)
    cv.glow(cx, cy, 200, P["glow"], 0.45)
    # dome silhouette
    im, d = cv.mask_draw()
    dy = H * 0.88
    d.rectangle([0, dy, W, H], fill=255)
    d.pieslice([W * 0.5 - 110, dy - 130, W * 0.5 + 110, dy + 90], 180, 360, fill=255)
    for mx in (W * 0.22, W * 0.78):
        d.rectangle([mx - 12, dy - 150, mx + 12, dy], fill=255)
        d.polygon([(mx - 16, dy - 148), (mx, dy - 190), (mx + 16, dy - 148)], fill=255)
    cv.stamp(im, P["dark"], alpha=0.96, blur=1)


def art_ember_pyre(cv, P, rng, focal):
    cv.vgrad(P["bg0"], P["a1"], gamma=1.3)
    fx = min(max(focal[0], W * 0.38), W * 0.62)
    fy = min(max(focal[1] + H * 0.12, H * 0.44), H * 0.76)
    cv.glow(fx, fy - 60, 340, P["glow"], 0.9, hard=1.5)
    for scale, col, blur in ((1.0, P["a1"], 6), (0.68, P["a2"], 4), (0.40, P["a3"], 2.5), (0.20, P["light"], 1.5)):
        cv.stamp(flame_mask(fx + rng.uniform(-6, 6), fy, 240 * scale), col, blur=blur, mode="screen")
    cv.stamp(embers_mask(rng, 46, fx, fy - 120, 160, 560), P["glow"], alpha=0.85, mode="screen")
    cv.stamp(ridge_mask(rng, fy + 60, 60, rough=0.8, blur=1.5), P["dark"], alpha=0.97)
    # logs
    im, d = cv.mask_draw()
    for _ in range(4):
        x0 = fx + rng.uniform(-110, 60)
        y0 = fy + rng.uniform(20, 50)
        d.line([(x0, y0), (x0 + rng.uniform(60, 140), y0 + rng.uniform(-16, 16))], fill=255, width=14)
    cv.stamp(im, P["dark"], alpha=0.95, blur=1)


def art_block_print(cv, P, rng, focal):
    cv.flat(P["bg0"])
    cv.paper(0.09)
    step = rng.choice([110, 130])
    im, d = cv.mask_draw()
    for iy, y in enumerate(range(60, H, step)):
        for x in range(60 + (step // 2 if iy % 2 else 0), W, step):
            block_motif(d, x + rng.uniform(-4, 4), y + rng.uniform(-4, 4), step * 0.30)
    cv.stamp(im, P["a2"], alpha=0.55, blur=0.7)
    im, d = cv.mask_draw()
    for iy, y in enumerate(range(60, H, step)):
        for x in range(60 + (step // 2 if iy % 2 else 0), W, step):
            block_motif(d, x + 7, y + 7, step * 0.30)
    cv.stamp(im, P["a1"], alpha=0.28, blur=1.2)  # misregistered overprint
    # central medallion
    cx = W / 2
    cy = min(max(focal[1], H * 0.56), H * 0.66)
    cv.glow(cx, cy, 240, P["glow"], 0.35)
    im, d = cv.mask_draw()
    d.ellipse([cx - 190, cy - 190, cx + 190, cy + 190], outline=255, width=6)
    d.ellipse([cx - 168, cy - 168, cx + 168, cy + 168], outline=255, width=3)
    for a in range(12):
        ang = a * math.pi / 6
        px, py = cx + math.cos(ang) * 128, cy + math.sin(ang) * 128
        d.ellipse([px - 34, py - 34, px + 34, py + 34], outline=255, width=4)
    d.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], fill=255)
    cv.stamp(im, P["a3"], alpha=0.92, blur=0.8)
    im, d = cv.mask_draw()
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=255)
    cv.stamp(im, P["bg0"], alpha=0.9, blur=0.6)


def art_minimal_wave(cv, P, rng, focal):
    cv.flat(P["bg0"])
    split = H * rng.uniform(0.52, 0.64)
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    pts = [(0, H)]
    n = 9
    ys = [split + rng.uniform(-70, 70) for _ in range(n + 1)]
    for _ in range(3):
        ys[1:-1] = [(ys[i - 1] + ys[i + 1]) / 2 for i in range(1, n)]
    xs = np.linspace(0, W, n + 1)
    pts += list(zip(xs, ys)) + [(W, H)]
    d.polygon(pts, fill=255)
    cv.stamp(im, P["a1"], alpha=1.0, blur=2)
    # offset echo curve
    im2 = Image.new("L", (W, H), 0)
    d2 = ImageDraw.Draw(im2)
    pts2 = [(0, H)] + [(x, y + 46) for x, y in list(zip(xs, ys))] + [(W, H)]
    d2.polygon(pts2, fill=255)
    cv.stamp(im2, P["a2"], alpha=0.5, blur=3)
    sx, sy = focal
    cv.glow(sx, sy, 170, P["glow"], 0.7)
    cv.stamp(moon_mask(sx, sy, rng.choice([34, 42, 50])), P["a3"], blur=1.5)
    im, d = cv.mask_draw()
    birds_draw(d, W * 0.5, split - 120, 2, 90, 12)
    cv.stamp(im, P["dark"], alpha=0.65, blur=0.7)
    cv.brush_streaks(0.05)


ART = {
    "dawn_village": art_dawn_village,
    "moon_river": art_moon_river,
    "diya_night": art_diya_night,
    "monsoon_tree": art_monsoon_tree,
    "mist_mountains": art_mist_mountains,
    "lotus_pond": art_lotus_pond,
    "jharokha_arch": art_jharokha_arch,
    "wheat_noon": art_wheat_noon,
    "ink_brush": art_ink_brush,
    "deco_city": art_deco_city,
    "warli_folk": art_warli_folk,
    "sufi_stars": art_sufi_stars,
    "ember_pyre": art_ember_pyre,
    "block_print": art_block_print,
    "minimal_wave": art_minimal_wave,
}


# ----------------------------------------------------------------------------
# text placement
# ----------------------------------------------------------------------------

def stamp_alpha(cv, alpha, x, y, color, mult=1.0, shadow=None):
    """Paste a text alpha canvas onto the cover at (x, y)."""
    hgt, wdt = alpha.shape
    x0, y0 = int(round(x)), int(round(y))
    col = np.asarray(hx(color), np.float32)[None, None, :]
    if shadow is not None:
        s_col, s_off, s_blur, s_str = shadow
        sh = cv.blur_mask(alpha, s_blur)
        _paste_box(cv, sh, x0, y0 + s_off, np.asarray(hx(s_col), np.float32)[None, None, :], s_str)
    _paste_box(cv, alpha, x0, y0, col, mult)


def _paste_box(cv, alpha, x0, y0, col, mult):
    hgt, wdt = alpha.shape
    cx0, cy0 = max(0, x0), max(0, y0)
    cx1, cy1 = min(W, x0 + wdt), min(H, y0 + hgt)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    sub = alpha[cy0 - y0: cy1 - y0, cx0 - x0: cx1 - x0] * mult
    m = sub[..., None]
    cv.a[cy0:cy1, cx0:cx1, :] = cv.a[cy0:cy1, cx0:cx1, :] * (1 - m) + col * m


def region_lum(cv, y0, y1, x0=0, x1=W):
    return float(cv.a[y0:y1, x0:x1].mean(axis=(0, 1)).dot(np.array([0.2126, 0.7152, 0.0722], np.float32)))


def pick_ink(cv, P, y0, y1, x0=60, x1=W - 60):
    """Ink colour + shadow for a text block, from the luminance behind it."""
    light_bg = region_lum(cv, int(y0), int(y1), int(x0), int(x1)) > 0.50
    if light_bg:
        return P["dark"], (P["light"], 0, 7, 0.50)   # soft light halo
    return P["light"], (P["dark"], 4, 5, 0.5)          # soft dark shadow


def place_wordmark(cv, color, y=None, x=None, mult=0.62):
    wm = spaced_wordmark("BOOKNOMICS", 24, 0.62)
    y = H - 66 if y is None else y
    x = (W - wm.shape[1]) / 2 if x is None else x
    stamp_alpha(cv, wm, x, y, color, mult)


def layout_top(cv, P, title_lines, author, font_name, rng):
    size = fit_size(get_font(font_name), title_lines, 660, 148)
    block, line_h, asc = render_block(title_lines, font_name, size)
    y = 92
    col, sh = pick_ink(cv, P, y, y + block.shape[0])
    stamp_alpha(cv, block, (W - block.shape[1]) / 2, y, col, shadow=sh)
    a_size = fit_size(get_font(font_name), [author], 520, 46, floor=30)
    ab, _, _ = render_block([author], font_name, a_size, gap=1.2)
    ay = y + block.shape[0] + 26
    acol, ash = pick_ink(cv, P, ay, ay + ab.shape[0])
    stamp_alpha(cv, ab, (W - ab.shape[1]) / 2, ay, acol, 0.92, shadow=ash)
    place_wordmark(cv, pick_ink(cv, P, H - 70, H - 30)[0])


def layout_bottom(cv, P, title_lines, author, font_name, rng):
    g = np.zeros((H, W), np.float32)
    y0 = H * 0.48
    t = np.clip((np.arange(H) - y0) / (H - y0), 0, 1) ** 1.4
    g[:] = t[:, None]
    cv.overlay(np.array(hx(P["dark"]))[None, None, :], g * 0.86)
    col = P["light"]
    size = fit_size(get_font(font_name), title_lines, 660, 132)
    block, line_h, asc = render_block(title_lines, font_name, size)
    a_size = fit_size(get_font(font_name), [author], 520, 44, floor=30)
    ab, _, _ = render_block([author], font_name, a_size, gap=1.2)
    wm_y = H - 64
    ab_y = wm_y - ab.shape[0] - 30
    t_y = ab_y - block.shape[0] - 26
    stamp_alpha(cv, block, (W - block.shape[1]) / 2, t_y, col)
    stamp_alpha(cv, ab, (W - ab.shape[1]) / 2, ab_y, col, 0.92)
    place_wordmark(cv, col, y=wm_y)


def layout_topleft(cv, P, title_lines, author, font_name, rng):
    size = fit_size(get_font(font_name), title_lines, 560, 132)
    font = get_font(font_name)
    y = 100
    col, sh = pick_ink(cv, P, y, y + size * 1.26 * len(title_lines), 40, 620)
    for ln in title_lines:
        al, wdt, asc, desc = font.render_line(ln, size, get_latin())
        stamp_alpha(cv, al, 74, y, col, shadow=sh)
        y += size * 1.26
    im, d = cv.mask_draw()
    d.rectangle([52, 108, 60, y - 20], fill=255)
    cv.stamp(im, P["a3"], alpha=0.9, blur=0.6)
    a_size = fit_size(get_font(font_name), [author], 480, 42, floor=28)
    ab, _, _ = render_block([author], font_name, a_size, gap=1.2)
    ay = y + 18
    acol, ash = pick_ink(cv, P, ay, ay + ab.shape[0], 40, 620)
    stamp_alpha(cv, ab, 74, ay, acol, 0.92, shadow=ash)
    place_wordmark(cv, pick_ink(cv, P, H - 70, H - 30, 40, 400)[0], x=74)


def layout_framed(cv, P, title_lines, author, font_name, rng):
    im, d = cv.mask_draw()
    d.rectangle([44, 44, W - 44, H - 44], outline=255, width=4)
    d.rectangle([58, 58, W - 58, H - 58], outline=255, width=2)
    cv.stamp(im, P["a3"], alpha=0.85, blur=0.5)
    size = fit_size(get_font(font_name), title_lines, 600, 128)
    block, line_h, asc = render_block(title_lines, font_name, size)
    y = 108
    col, sh = pick_ink(cv, P, y, y + block.shape[0])
    stamp_alpha(cv, block, (W - block.shape[1]) / 2, y, col, shadow=sh)
    a_size = fit_size(get_font(font_name), [author], 480, 42, floor=28)
    ab, _, _ = render_block([author], font_name, a_size, gap=1.2)
    acol, ash = pick_ink(cv, P, H - 168, H - 168 + ab.shape[0])
    stamp_alpha(cv, ab, (W - ab.shape[1]) / 2, H - 168, acol, 0.92, shadow=ash)
    place_wordmark(cv, pick_ink(cv, P, H - 108, H - 70)[0], y=H - 108)


def layout_band(cv, P, title_lines, author, font_name, rng):
    dark_bg = region_lum(cv, 100, 400) <= 0.52
    band_col = P["light"] if dark_bg else P["dark"]
    text_col = P["dark"] if dark_bg else P["light"]
    size = fit_size(get_font(font_name), title_lines, 620, 124)
    block, line_h, asc = render_block(title_lines, font_name, size)
    a_size = fit_size(get_font(font_name), [author], 500, 40, floor=28)
    ab, _, _ = render_block([author], font_name, a_size, gap=1.2)
    y0 = 130
    band_h = block.shape[0] + ab.shape[0] + 92
    im, d = cv.mask_draw()
    d.rectangle([0, y0 - 34, W, y0 - 34 + band_h], fill=255)
    cv.stamp(im, band_col, alpha=0.94, blur=0.5)
    stamp_alpha(cv, block, (W - block.shape[1]) / 2, y0, text_col)
    stamp_alpha(cv, ab, (W - ab.shape[1]) / 2, y0 + block.shape[0] + 26, text_col, 0.88)
    place_wordmark(cv, P["light"] if dark_bg else P["dark"])


LAYOUTS = ["top", "bottom", "topleft", "framed", "band"]
LAYOUT_FN = {
    "top": layout_top,
    "bottom": layout_bottom,
    "topleft": layout_topleft,
    "framed": layout_framed,
    "band": layout_band,
}


# ----------------------------------------------------------------------------
# top level
# ----------------------------------------------------------------------------

def render_cover(title: str, author: str, arch: str, pal_idx: int, seed: int,
                 font_name: str = None, layout: str = None) -> Image.Image:
    rng = random.Random(seed)
    random.seed(seed)  # module-level helpers (birds_draw) stay deterministic too
    P = PALETTES[pal_idx]
    if font_name is None:
        font_name = rng.choice(DEV_FONTS)
    if layout is None:
        layout = rng.choices(LAYOUTS, weights=[0.42, 0.20, 0.14, 0.12, 0.12])[0]
    # keep the sky focal out of whichever zone the text will occupy
    if layout in ("top", "framed", "band"):
        focal = (W * rng.uniform(0.35, 0.65), H * rng.uniform(0.48, 0.62))
    elif layout == "bottom":
        focal = (W * rng.uniform(0.30, 0.70), H * rng.uniform(0.26, 0.38))
    else:  # topleft
        focal = (W * rng.uniform(0.55, 0.75), H * rng.uniform(0.40, 0.58))
    cv = Canvas(rng)
    ART[arch](cv, P, rng, focal)
    cv.brush_streaks(0.03)
    cv.paper(0.045)
    cv.grain(0.030)
    cv.vignette(0.30)
    title_lines = wrap_lines(title, 2)
    LAYOUT_FN[layout](cv, P, title_lines, author, font_name, rng)
    return cv.image(), dict(arch=arch, palette=P["name"], font=font_name, layout=layout)
