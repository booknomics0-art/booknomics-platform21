#!/usr/bin/env python3
"""Booknomics cover worker: local, no API key, up to 100 covers per run.

Renders one 800x1200 (2:3) JPEG per queue entry. Artwork is procedural
(drawn from shapes, gradients and grain), typography uses Playfair Display and
Inter, and every book gets its own colour theme (golden-angle hue spacing, so
no two books share a palette). The motif is picked per book from its story.

    python worker.py --queue covers_queue_en.json --out ../../content-drafts/covers/batch-en
"""
from __future__ import annotations

import argparse
import colorsys
import csv
import hashlib
import io
import json
import math
import os
import random
import sys
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 800, 1200
MAX_PER_RUN = 100
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")
FONT_FILES = {
    "serif": "PlayfairDisplay-Bold.ttf",
    "serif_it": "PlayfairDisplay-Italic.ttf",
    "sans": "Inter-SemiBold.ttf",
    "sans_med": "Inter-Medium.ttf",
}
GOLDEN_ANGLE = 137.50776405

# Motif box and text placement per layout.
LAYOUTS = {
    "top": dict(box=(90, 520, 710, 1050), xy=(400, 100), align="center", max_w=640, lines=3, start=104, low=52),
    "bottom": dict(box=(90, 120, 710, 570), xy=(400, 0), block_bottom=1000, align="center", max_w=640, lines=3, start=100, low=52),
    "center": dict(box=(120, 440, 680, 1010), xy=(400, 96), align="center", max_w=640, lines=2, start=108, low=56),
    "left": dict(box=(300, 560, 770, 1050), xy=(80, 100), align="left", max_w=620, lines=3, start=100, low=52),
}

_fonts: dict = {}
_measure = ImageDraw.Draw(Image.new("RGB", (4, 4)))


def font(key: str, size: int) -> ImageFont.FreeTypeFont:
    if (key, size) not in _fonts:
        path = os.path.join(FONT_DIR, FONT_FILES[key])
        if not os.path.exists(path):
            sys.exit(f"Missing font file {path}. Run ./fetch_fonts.sh first.")
        _fonts[(key, size)] = ImageFont.truetype(path, size)
    return _fonts[(key, size)]


# ---------------------------------------------------------------- colour
def hsl(h: float, s: float, l: float) -> tuple:
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360.0, min(max(l, 0.0), 1.0), min(max(s, 0.0), 1.0))
    return (round(r * 255), round(g * 255), round(b * 255))


def make_palette(hue: float, mode: str) -> dict:
    if mode == "light":
        return {
            "top": hsl(hue, 0.55, 0.93), "bot": hsl(hue + 12, 0.50, 0.82),
            "glow": hsl(hue + 30, 0.85, 0.97),
            "accent": hsl(hue + 25, 0.60, 0.42), "accent2": hsl(hue - 30, 0.55, 0.62),
            "ink": hsl(hue, 0.45, 0.13), "sub": hsl(hue + 20, 0.55, 0.30),
            "dark": hsl(hue, 0.35, 0.16),
        }
    return {
        "top": hsl(hue, 0.50, 0.11), "bot": hsl(hue + 15, 0.60, 0.035),
        "glow": hsl(hue + 25, 0.85, 0.40),
        "accent": hsl(hue + 25, 0.90, 0.62), "accent2": hsl(hue - 28, 0.80, 0.58),
        "ink": (248, 243, 234), "sub": hsl(hue + 25, 0.65, 0.74),
        "dark": hsl(hue, 0.50, 0.05),
    }


def background(pal: dict, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    y = np.linspace(0.0, 1.0, H)[:, None]
    x = np.linspace(0.0, 1.0, W)[None, :]
    t = np.clip(0.8 * y + 0.2 * x, 0.0, 1.0)[..., None]
    top, bot = np.array(pal["top"], float), np.array(pal["bot"], float)
    img = top * (1 - t) + bot * t
    dist = np.sqrt((x - 0.5) ** 2 + ((y - 0.55) * 1.1) ** 2)
    glow = (np.clip(1 - dist / 0.62, 0, 1) ** 2)[..., None]
    img = img + (np.array(pal["glow"], float) - img) * 0.25 * glow
    vig = 1 - 0.5 * np.clip(((x - 0.5) ** 2 + (y - 0.5) ** 2) * 1.6, 0, 1)
    img = img * vig[..., None]
    img = img + rng.normal(0.0, 3.0, (H, W, 1))  # film grain
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def composite(base: Image.Image, layer: Image.Image, glow: float) -> None:
    if glow > 0:
        base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(glow)))
    base.alpha_composite(layer)


# ---------------------------------------------------------------- helpers
def rgba(c, a=255) -> tuple:
    return (int(c[0]), int(c[1]), int(c[2]), int(max(0, min(255, a))))


def geom(box):
    x0, y0, x1, y1 = box
    return (x0 + x1) / 2, (y0 + y1) / 2, min(x1 - x0, y1 - y0) / 2


def ellipse_poly(cx, cy, a, b, ang, n=72):
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        x, y = a * math.cos(t), b * math.sin(t)
        pts.append((cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang)))
    return pts


# ---------------------------------------------------------------- motifs
# Every motif draws into a transparent layer inside `box`. Signature:
# (draw, box, palette, random.Random, params)

def m_rings(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    n = p.get("n", 6)
    for i in range(n):
        t = i / max(n - 1, 1)
        r = R * (0.3 + 0.7 * t)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(pal["accent"], 255 * (0.95 - 0.6 * t)), width=max(2, int(R * 0.012)))
    for _ in range(p.get("dots", 3)):
        a = rnd.uniform(0, 2 * math.pi)
        r = R * rnd.choice([0.5, 0.7, 0.9])
        x, y, s = cx + r * math.cos(a), cy + r * math.sin(a), R * 0.03
        d.ellipse([x - s, y - s, x + s, y + s], fill=rgba(pal["accent2"]))
    s = R * 0.08
    d.ellipse([cx - s, cy - s, cx + s, cy + s], fill=rgba(pal["accent"]))


def m_ring(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    r = R * 0.8
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(pal["accent"]), width=max(4, int(R * 0.11)))
    r2 = R * 0.6
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=rgba(pal["accent2"], 150), width=max(2, int(R * 0.015)))


def m_dots(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cx, cy, R = geom(box)
    pts = []
    for _ in range(p.get("n", 50)):
        if p.get("cluster"):
            x = rnd.gauss(x0 + (x1 - x0) * 0.42, (x1 - x0) * 0.16)
            y = rnd.gauss(y0 + (y1 - y0) * 0.6, (y1 - y0) * 0.14)
        else:
            x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        pts.append((min(max(x, x0), x1), min(max(y, y0), y1)))
    link = p.get("link", 0)
    if link:
        for i, (xa, ya) in enumerate(pts):
            for xb, yb in pts[i + 1:]:
                if (xa - xb) ** 2 + (ya - yb) ** 2 < link ** 2 and rnd.random() < 0.35:
                    d.line([(xa, ya), (xb, yb)], fill=rgba(pal["accent"], 110), width=2)
    for x, y in pts:
        r = rnd.uniform(3, 7)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(pal["sub"], rnd.randint(90, 200)))
    if p.get("focus"):
        r = R * 0.1
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(pal["accent"]))
    if p.get("outlier"):
        ox, oy, r = x1 - (x1 - x0) * 0.1, y0 + (y1 - y0) * 0.08, R * 0.08
        d.ellipse([ox - r, oy - r, ox + r, oy + r], fill=rgba(pal["accent2"]))


def m_waves(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    n = p.get("layers", 5)
    amp = p.get("amp", 0.06) * (y1 - y0)
    freq = p.get("freq", 2.0) * 2 * math.pi / (x1 - x0)
    if p.get("sun"):
        r = (x1 - x0) * 0.16
        sx, sy = x0 + (x1 - x0) * 0.72, y0 + (y1 - y0) * 0.22
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=rgba(pal["accent2"], 235))
    for i in range(n):
        t = i / max(n - 1, 1)
        base_y = y0 + (y1 - y0) * (0.18 + 0.7 * t)
        phase = rnd.uniform(0, 2 * math.pi) + 0.5 * i
        pts = []
        for x in range(int(x0), int(x1) + 1, 3):
            u = x - x0
            y = base_y + amp * math.sin(freq * u + phase) * (0.75 + 0.25 * math.sin(0.7 * i + u / (x1 - x0) * 3.1))
            pts.append((x, y))
        alpha = 255 * (0.9 - 0.55 * t)
        if p.get("fill", False):
            d.polygon(pts + [(x1, y1 + 40), (x0, y1 + 40)], fill=rgba(pal["accent2"], alpha * 0.22))
        d.line(pts, fill=rgba(pal["accent"], alpha), width=max(2, int((y1 - y0) * 0.005)), joint="curve")


def m_spiral(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    turns = p.get("turns", 4)
    steps = 1200
    pts = []
    for k in range(steps + 1):
        t = k / steps
        a = t * turns * 2 * math.pi
        r = R * 0.92 * t
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.line(pts, fill=rgba(pal["accent"]), width=max(3, int(R * 0.022)), joint="curve")
    x, y = pts[-1]
    s = R * 0.05
    d.ellipse([x - s, y - s, x + s, y + s], fill=rgba(pal["accent2"]))


def m_grid(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    n = p.get("n", 6)
    pattern = p.get("pattern", "stairs")
    if pattern == "checklist":
        row_h = (y1 - y0) / n
        bs = row_h * 0.56
        for r in range(n):
            y = y0 + r * row_h + (row_h - bs) / 2
            d.rounded_rectangle([x0, y, x0 + bs, y + bs], radius=bs * 0.18, outline=rgba(pal["accent"]), width=max(3, int(bs * 0.08)))
            if rnd.random() < 0.7:
                d.line([(x0 + bs * 0.2, y + bs * 0.5), (x0 + bs * 0.44, y + bs * 0.76), (x0 + bs * 0.84, y + bs * 0.22)],
                       fill=rgba(pal["accent2"]), width=max(4, int(bs * 0.1)), joint="curve")
            for k in range(3):
                ly = y + bs * (0.25 + 0.25 * k)
                lx1 = x1 - (x1 - x0) * (0.12 + 0.18 * rnd.random())
                d.line([(x0 + bs + 36, ly), (lx1, ly)], fill=rgba(pal["sub"], 170), width=max(3, int(bs * 0.05)))
        return
    if pattern == "quad":
        cs = min(x1 - x0, y1 - y0) / 2.15
        ox, oy = (x0 + x1) / 2 - cs, (y0 + y1) / 2 - cs
        for i in range(2):
            for j in range(2):
                tx, ty = ox + i * cs * 1.05, oy + j * cs * 1.05
                d.rounded_rectangle([tx, ty, tx + cs * 0.92, ty + cs * 0.92], radius=cs * 0.1, outline=rgba(pal["accent"]), width=max(3, int(cs * 0.03)))
                k = i * 2 + j
                gx, gy, g = tx + cs * 0.46, ty + cs * 0.46, cs * 0.22
                if k == 0:
                    d.ellipse([gx - g, gy - g, gx + g, gy + g], fill=rgba(pal["accent2"]))
                elif k == 1:
                    d.rectangle([gx - g, gy - g, gx + g, gy + g], fill=rgba(pal["accent"]))
                elif k == 2:
                    d.polygon([(gx, gy - g), (gx + g, gy + g), (gx - g, gy + g)], fill=rgba(pal["accent2"]))
                else:
                    d.polygon([(gx, gy - g), (gx + g, gy), (gx, gy + g), (gx - g, gy)], fill=rgba(pal["accent"]))
        return
    # rising staircase of habit blocks
    cell = min((x1 - x0) / n, (y1 - y0) / n)
    gx0, gy0 = (x0 + x1) / 2 - cell * n / 2, (y0 + y1) / 2 - cell * n / 2
    g = cell * 0.1
    for r in range(n):
        for c in range(n):
            x, y, s = gx0 + c * cell + g, gy0 + r * cell + g, cell - 2 * g
            if (n - 1 - r) <= c:
                d.rectangle([x, y, x + s, y + s], fill=rgba(pal["accent"], 120 + 135 * c / max(n - 1, 1)))
            else:
                d.rectangle([x, y, x + s, y + s], outline=rgba(pal["sub"], 70), width=2)


def m_stairs(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cx = (x0 + x1) / 2
    n = p.get("steps", 6)
    if p.get("pyramid"):
        for i in range(n):  # i = 0 is the bottom, widest block
            w = (x1 - x0) * (1 - 0.82 * i / max(n - 1, 1))
            bot = y1 - (y1 - y0) * i / n
            top = bot - (y1 - y0) / n * 0.9
            d.rectangle([cx - w / 2, top, cx + w / 2, bot], fill=rgba(pal["accent"], 150 + 100 * i / max(n - 1, 1)))
        return
    if p.get("ladder"):
        lx, rx = x0 + (x1 - x0) * 0.3, x1 - (x1 - x0) * 0.3
        w = max(5, int((x1 - x0) * 0.022))
        d.line([(lx, y1), (lx, y0)], fill=rgba(pal["accent"]), width=w)
        d.line([(rx, y1), (rx, y0)], fill=rgba(pal["accent"]), width=w)
        for i in range(n + 1):
            y = y1 - (y1 - y0) * (i + 0.5) / (n + 1)
            d.line([(lx, y), (rx, y)], fill=rgba(pal["accent2"]), width=w)
        return
    for i in range(n):
        sx0 = x0 + (x1 - x0) * i / n
        sx1 = sx0 + (x1 - x0) / n * 0.92
        top = y1 - (y1 - y0) * (i + 1) / n
        d.rectangle([sx0, top, sx1, y1], fill=rgba(pal["accent"], 150 + 100 * i / max(n - 1, 1)))


def m_peaks(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cx, _, _ = geom(box)
    n = p.get("layers", 3)
    npk = p.get("peaks", 5)
    if p.get("sun", True):
        r = (x1 - x0) * 0.13
        sx, sy = x0 + (x1 - x0) * 0.74, y0 + (y1 - y0) * 0.28
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=rgba(pal["accent2"], 240))
    for layer in range(n):
        t = layer / max(n - 1, 1)
        if npk == 1:
            pts = [(x0, y1), (cx, y0 + (y1 - y0) * 0.08), (x1, y1)]
        else:
            pts = [(x0, y1)]
            for j, x in enumerate(np.linspace(x0, x1, npk * 2 + 1)):
                if j % 2 == 0:
                    h = rnd.uniform(0.45, 1.0)
                    y = y1 - (y1 - y0) * (0.25 + 0.6 * h * (1 - 0.35 * (1 - t)))
                else:
                    y = y1 - (y1 - y0) * (0.12 + 0.15 * rnd.random())
                pts.append((float(x), float(y)))
            pts.append((x1, y1))
        last = layer == n - 1
        if last:  # front range: dark silhouette in front of the sun, or bright peak
            col = pal["dark"] if p.get("sun", True) else pal["accent2"]
        else:
            col = pal["accent"]
        d.polygon(pts, fill=rgba(col, 255 if last else 90 + 70 * t))


def m_rays(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    n = p.get("n", 28)
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.02, 0.02)
        r0 = R * 0.24
        r1 = R * (0.92 if i % 2 == 0 else rnd.uniform(0.6, 0.78))
        d.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))],
               fill=rgba(pal["accent"], 210 if i % 2 == 0 else 120), width=max(2, int(R * 0.018)))
    r = R * 0.21
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(pal["accent2"]))


def m_bars(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    n = p.get("n", 9)
    hi = p.get("hi", n - 3)
    gap = (x1 - x0) / n
    bw = gap * 0.6
    d.line([(x0, y1), (x1, y1)], fill=rgba(pal["accent"], 220), width=max(3, int((y1 - y0) * 0.005)))
    for i in range(n):
        f = (i + 1) / n
        h = (y1 - y0) * (0.22 + 0.62 * f ** 1.5) * rnd.uniform(0.86, 1.0)
        if i == hi:
            h = (y1 - y0) * 0.98
        bx = x0 + i * gap + (gap - bw) / 2
        d.rectangle([bx, y1 - h, bx + bw, y1], fill=rgba(pal["accent2"] if i == hi else pal["accent"], 255 if i == hi else 150))


def m_tree(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    depth = p.get("depth", 7)
    spread = p.get("spread", 0.5)
    hh = y1 - y0
    cx = (x0 + x1) / 2

    def branch(x, y, ang, ln, level):
        x2, y2 = x + ln * math.sin(ang), y - ln * math.cos(ang)
        w = max(1, int((depth - level + 1) * hh * 0.0055))
        d.line([(x, y), (x2, y2)], fill=rgba(pal["accent"] if level < depth - 1 else pal["accent2"], 235), width=w)
        if level < depth:
            for sgn in (-1, 1):
                branch(x2, y2, ang + sgn * spread * rnd.uniform(0.7, 1.15), ln * rnd.uniform(0.66, 0.78), level + 1)
        else:
            r = hh * 0.011
            d.ellipse([x2 - r, y2 - r, x2 + r, y2 + r], fill=rgba(pal["accent2"], 230))

    branch(cx, y1, 0.0, hh * 0.27, 1)


def m_loop(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    n = p.get("n", 3)
    r = R * 0.66
    w = max(6, int(R * 0.07))
    for i in range(n):
        a0 = i * 360 / n + 16
        a1 = a0 + 360 / n - 32
        d.arc([cx - r, cy - r, cx + r, cy + r], start=a0, end=a1, fill=rgba(pal["accent"]), width=w)
        ang = math.radians(a1)
        ex, ey = cx + r * math.cos(ang), cy + r * math.sin(ang)
        s = R * 0.085
        d.ellipse([ex - s, ey - s, ex + s, ey + s], fill=rgba(pal["accent2"]))


def m_path(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    n = p.get("nodes", 7)
    pts = []
    for i in range(n):
        t = i / (n - 1)
        y = y1 - t * (y1 - y0)
        if p.get("zigzag"):
            x = x0 + (x1 - x0) * (0.18 if i % 2 == 0 else 0.82)
        else:
            x = x0 + (x1 - x0) * (0.5 + 0.26 * math.sin(t * math.pi * 1.5))
        pts.append((x, y))
    d.line(pts, fill=rgba(pal["accent"]), width=max(4, int((x1 - x0) * 0.011)), joint="curve")
    for i, (x, y) in enumerate(pts):
        r = (x1 - x0) * (0.03 if i == len(pts) - 1 else 0.017)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(pal["accent2"] if i == len(pts) - 1 else pal["accent"]))
    k_obs = p.get("obstacles", 0)
    for k in range(k_obs):
        t = (k + 1) / (k_obs + 1)
        y = y1 - t * (y1 - y0)
        d.rectangle([x0 + (x1 - x0) * 0.12, y - 7, x1 - (x1 - x0) * 0.12, y + 7], fill=rgba(pal["sub"], 220))


def m_eye(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    hw, hh = R * 0.98, R * 0.44
    up, lo = [], []
    for k in range(161):
        t = -1 + 2 * k / 160
        x = cx + hw * t
        h = hh * (1 - t * t) ** 0.75
        up.append((x, cy - h))
        lo.append((x, cy + h))
    d.polygon(up + lo[::-1], fill=rgba(pal["dark"], 255))
    d.line(up, fill=rgba(pal["accent"]), width=max(4, int(R * 0.02)), joint="curve")
    d.line(lo, fill=rgba(pal["accent"]), width=max(4, int(R * 0.02)), joint="curve")
    ir = R * 0.3
    d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=rgba(pal["accent"]))
    pr = R * 0.12
    d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=rgba(pal["dark"]))
    for k in range(-5, 6):  # telescreen scan lines
        yy = cy + k * R * 0.085
        if abs(yy - cy) < hh * 0.9:
            d.line([(cx - hw * 0.9, yy), (cx + hw * 0.9, yy)], fill=rgba(pal["accent2"], 40), width=1)


def m_flame(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    for s, col, a in ((1.0, pal["accent2"], 210), (0.72, pal["accent"], 230), (0.42, (255, 240, 205), 255)):
        rx = R * 0.42 * s
        cyy = cy + R * 0.28 * s + R * (1 - s) * 0.3
        ry = R * 0.95 * s
        d.ellipse([cx - rx, cyy - rx, cx + rx, cyy + rx], fill=rgba(col, a))
        d.polygon([(cx - rx, cyy), (cx, cyy - ry), (cx + rx, cyy)], fill=rgba(col, a))


def m_coins(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cols = p.get("cols", 3)
    base = y1 - 10
    rx = (x1 - x0) / (cols * 2.3)
    ry = rx * 0.42
    th = rx * 0.32
    for c in range(cols):
        cx = x0 + (x1 - x0) * (c + 0.5) / cols
        h = 9 if c == cols // 2 else rnd.randint(4, 7)
        for k in range(h):
            y = base - k * th
            d.rectangle([cx - rx, y - th, cx + rx, y], fill=rgba(pal["accent2"], 255))
            d.ellipse([cx - rx, y - th - ry, cx + rx, y - th + ry], fill=rgba(pal["accent"], 255), outline=rgba(pal["dark"]), width=2)


def m_wings(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    base = (cx, cy + R * 0.35)
    for side in (-1, 1):
        for k in range(16):
            t = k / 15
            ang = math.radians(185 + 75 * t) if side < 0 else math.radians(355 - 75 * t)
            ln = R * (1.0 - 0.3 * t)
            tip = (base[0] + ln * math.cos(ang), base[1] + ln * math.sin(ang))
            mid = ((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2)
            vx, vy = tip[0] - base[0], tip[1] - base[1]
            nx, ny = -vy, vx  # normal to the feather
            nl = math.hypot(nx, ny) or 1.0
            nx, ny = nx / nl, ny / nl
            if ny > 0:  # bulge upward, like a raised wing
                nx, ny = -nx, -ny
            ctrl = (mid[0] + nx * ln * 0.2, mid[1] + ny * ln * 0.2)
            pts = []
            for step in range(21):
                u = step / 20
                x = (1 - u) ** 2 * base[0] + 2 * (1 - u) * u * ctrl[0] + u * u * tip[0]
                y = (1 - u) ** 2 * base[1] + 2 * (1 - u) * u * ctrl[1] + u * u * tip[1]
                pts.append((x, y))
            d.line(pts, fill=rgba(pal["accent"] if k % 2 == 0 else pal["accent2"], 230), width=max(3, int(R * 0.03)), joint="curve")


def m_petals(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    n = p.get("n", 7)
    for i in range(n):
        a = 2 * math.pi * i / n - math.pi / 2
        px, py = cx + R * 0.44 * math.cos(a), cy + R * 0.44 * math.sin(a)
        d.polygon(ellipse_poly(px, py, R * 0.4, R * 0.2, a), fill=rgba(pal["accent"] if i % 2 == 0 else pal["accent2"], 215))
    r = R * 0.16
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(pal["dark"]))


def m_windmill(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    hub = (cx, cy - R * 0.25)
    blades = p.get("blades", 4)
    for i in range(blades):
        a = 2 * math.pi * i / blades + math.radians(12)
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        ln, wd = R * 0.82, R * 0.13
        pts = [
            (hub[0] + px * wd * 0.3, hub[1] + py * wd * 0.3),
            (hub[0] + ux * ln + px * wd, hub[1] + uy * ln + py * wd),
            (hub[0] + ux * ln - px * wd, hub[1] + uy * ln - py * wd),
            (hub[0] - px * wd * 0.3, hub[1] - py * wd * 0.3),
        ]
        d.polygon(pts, fill=rgba(pal["accent"], 235))
    tw = R * 0.2
    d.polygon([(cx - tw, cy + R * 0.9), (cx + tw, cy + R * 0.9), (cx + tw * 0.45, hub[1] + R * 0.05), (cx - tw * 0.45, hub[1] + R * 0.05)],
              fill=rgba(pal["accent2"], 235))
    r = R * 0.1
    d.ellipse([hub[0] - r, hub[1] - r, hub[0] + r, hub[1] + r], fill=rgba(pal["accent2"]))


def m_moon(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    r = R * 0.55
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(pal["accent"]))
    o = r * 0.45
    d.ellipse([cx - r + o, cy - r - o * 0.2, cx + r + o, cy + r - o * 0.2], fill=(0, 0, 0, 0))  # crescent cut-out
    for _ in range(p.get("stars", 30)):
        x, y = rnd.uniform(box[0], box[2]), rnd.uniform(box[1], box[3])
        if (x - cx) ** 2 + (y - cy) ** 2 < (R * 0.8) ** 2:
            continue
        s = rnd.uniform(1.5, 3.6)
        d.ellipse([x - s, y - s, x + s, y + s], fill=rgba(pal["accent2"], rnd.randint(140, 255)))


def m_shards(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    n = p.get("n", 9)
    ring = []
    for k in range(n):
        a = 2 * math.pi * k / n + rnd.uniform(-0.12, 0.12)
        r = R * rnd.uniform(0.72, 0.98)
        ring.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    for k in range(n):
        tri = [(cx, cy), ring[k], ring[(k + 1) % n]]
        gx, gy = sum(t[0] for t in tri) / 3, sum(t[1] for t in tri) / 3
        shr = [(t[0] + (gx - t[0]) * 0.08, t[1] + (gy - t[1]) * 0.08) for t in tri]
        d.polygon(shr, fill=rgba(pal["accent"] if k % 2 == 0 else pal["accent2"], rnd.randint(175, 245)))


def m_split(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    bb = [cx - R * 0.82, cy - R * 0.82, cx + R * 0.82, cy + R * 0.82]
    d.pieslice(bb, 90, 270, fill=rgba(pal["accent"]))
    d.pieslice(bb, -90, 90, fill=rgba(pal["accent2"]))
    d.line([(cx, cy - R * 0.95), (cx, cy + R * 0.95)], fill=rgba(pal["ink"]), width=max(3, int(R * 0.02)))


def m_crown(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    w = R * 0.9
    base, top = cy + R * 0.42, cy - R * 0.1
    spikes = [top - R * 0.5, top - R * 0.12, top - R * 0.72, top - R * 0.12, top - R * 0.5]
    pts = [(cx - w, base), (cx - w, top)]
    for k in range(5):
        x = cx - w + (2 * w) * (k + 0.5) / 5
        pts.append((x, spikes[k]))
        if k < 4:
            pts.append((cx - w + (2 * w) * (k + 1) / 5, top))
    pts += [(cx + w, top), (cx + w, base)]
    d.polygon(pts, fill=rgba(pal["accent"], 240))
    d.rectangle([cx - w, base - R * 0.1, cx + w, base + R * 0.04], fill=rgba(pal["accent2"], 255))
    for k in range(5):
        x = cx - w + (2 * w) * (k + 0.5) / 5
        r = R * 0.05
        d.ellipse([x - r, spikes[k] - r, x + r, spikes[k] + r], fill=rgba(pal["accent2"]))


def m_beam(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cx, cy, R = geom(box)
    top_w, bot_w = R * 0.06, R * 0.85
    for y in range(int(y0), int(y1), 2):
        f = (y - y0) / (y1 - y0)
        half = top_w + (bot_w - top_w) * f
        d.line([(cx - half, y), (cx + half, y)], fill=rgba(pal["accent"], 230 * (1 - 0.82 * f)), width=3)
    r = R * 0.1
    d.ellipse([cx - r, y1 - r * 0.5, cx + r, y1 + r * 0.5], fill=rgba(pal["accent2"]))


def m_columns(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    n = p.get("n", 5)
    hh = y1 - y0
    ped = hh * 0.17
    d.polygon([(x0, y0 + ped), ((x0 + x1) / 2, y0), (x1, y0 + ped)], fill=rgba(pal["accent"]))
    top = y0 + ped
    d.rectangle([x0, top, x1, top + hh * 0.05], fill=rgba(pal["accent2"]))
    cw = (x1 - x0) / n
    for i in range(n):
        cx = x0 + cw * (i + 0.5)
        d.rectangle([cx - cw * 0.3, top + hh * 0.09, cx + cw * 0.3, y1 - hh * 0.1], fill=rgba(pal["accent"], 215))
    d.rectangle([x0, y1 - hh * 0.09, x1, y1], fill=rgba(pal["accent2"]))


def m_iceberg(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cx, cy, R = geom(box)
    wl = y0 + (y1 - y0) * 0.36
    tip = [(cx - R * 0.42, wl), (cx - R * 0.12, wl - R * 0.42), (cx + R * 0.06, wl - R * 0.6), (cx + R * 0.2, wl - R * 0.26), (cx + R * 0.46, wl)]
    under = [(cx - R * 0.46, wl), (cx + R * 0.46, wl), (cx + R * 0.82, wl + R * 0.5), (cx + R * 0.4, y1), (cx - R * 0.3, y1), (cx - R * 0.8, wl + R * 0.55)]
    d.polygon(under, fill=rgba(pal["accent"], 110))
    d.polygon(tip, fill=rgba(pal["accent2"], 250))
    d.line([(x0, wl), (x1, wl)], fill=rgba(pal["accent"]), width=4)


def m_heartbeat(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cy = (y0 + y1) / 2
    amp = (y1 - y0) * 0.36
    w = x1 - x0
    keys = [(0, 0), (0.18, 0), (0.25, -0.12), (0.3, 0.1), (0.36, -1.0), (0.42, 0.85), (0.48, -0.25),
            (0.54, 0), (0.7, 0), (0.76, -0.1), (0.8, 0.05), (0.84, 0), (1.0, 0)]
    pts = [(x0 + w * fx, cy + amp * fy) for fx, fy in keys]
    d.line(pts, fill=rgba(pal["accent"]), width=max(4, int(w * 0.012)), joint="curve")
    x, y = pts[4]
    r = w * 0.02
    d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(pal["accent2"]))


def m_strokes(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    n = p.get("n", 9)
    for k in range(n):
        f = (k + 0.5) / n
        y = y0 + (y1 - y0) * f
        xs = x0 + rnd.uniform(0, (x1 - x0) * 0.18)
        xe = x1 - rnd.uniform(0, (x1 - x0) * 0.2)
        ye = y - (y1 - y0) * rnd.uniform(0.02, 0.09)
        wd = int((y1 - y0) * rnd.uniform(0.015, 0.035))
        col = pal["accent"] if k % 3 else pal["accent2"]
        d.line([(xs, y), (xe, ye)], fill=rgba(col, rnd.randint(150, 240)), width=max(4, wd))


def m_fade(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    n = p.get("n", 12)
    cw, ch = (x1 - x0) / n, (y1 - y0) / n
    for i in range(n):
        for j in range(n):
            x, y = x0 + (i + 0.5) * cw, y0 + (j + 0.5) * ch
            f = (i + j) / (2 * (n - 1))
            r = cw * 0.34 * (1 - 0.75 * f)
            d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(pal["accent"], 255 * (1 - f) ** 1.3))


def m_zero_one(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    rr = R * 0.42
    zx = cx - R * 0.5
    d.ellipse([zx - rr, cy - rr * 1.25, zx + rr, cy + rr * 1.25], outline=rgba(pal["accent"]), width=max(8, int(R * 0.09)))
    ax0, ax1 = zx + rr + R * 0.12, cx + R * 0.32
    d.line([(ax0, cy), (ax1, cy)], fill=rgba(pal["accent2"]), width=max(4, int(R * 0.03)))
    d.polygon([(ax1, cy - R * 0.06), (ax1 + R * 0.12, cy), (ax1, cy + R * 0.06)], fill=rgba(pal["accent2"]))
    bx = cx + R * 0.62
    d.rectangle([bx - R * 0.06, cy - rr * 1.25, bx + R * 0.06, cy + rr * 1.25], fill=rgba(pal["accent"]))


def m_eclipse(d, box, pal, rnd, p):
    cx, cy, R = geom(box)
    for k in range(9):
        r = R * (0.64 + 0.035 * k)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(pal["accent"], 220 - 22 * k), width=3)
    r = R * 0.6
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(pal["dark"], 255))


def m_arch(d, box, pal, rnd, p):
    x0, y0, x1, y1 = box
    cx, cy, R = geom(box)
    w = (x1 - x0) * 0.62
    r = w / 2
    top = y0 + (y1 - y0) * 0.1
    d.rectangle([cx - r, top + r, cx + r, y1], fill=rgba(pal["accent"], 215))
    d.pieslice([cx - r, top, cx + r, top + 2 * r], 180, 360, fill=rgba(pal["accent"], 215))
    ri = r * 0.72
    d.rectangle([cx - ri, top + r, cx + ri, y1], fill=(0, 0, 0, 0))
    d.pieslice([cx - ri, top + r - ri, cx + ri, top + r + ri], 180, 360, fill=(0, 0, 0, 0))
    d.ellipse([cx - ri * 0.45, top + r - ri * 0.45, cx + ri * 0.45, top + r + ri * 0.45], fill=rgba(pal["accent2"], 245))


MOTIFS = {
    "rings": m_rings, "ring": m_ring, "dots": m_dots, "waves": m_waves, "spiral": m_spiral,
    "grid": m_grid, "stairs": m_stairs, "peaks": m_peaks, "rays": m_rays, "bars": m_bars,
    "tree": m_tree, "loop": m_loop, "path": m_path, "eye": m_eye, "flame": m_flame,
    "coins": m_coins, "wings": m_wings, "petals": m_petals, "windmill": m_windmill,
    "moon": m_moon, "shards": m_shards, "split": m_split, "crown": m_crown, "beam": m_beam,
    "columns": m_columns, "iceberg": m_iceberg, "heartbeat": m_heartbeat, "arch": m_arch,
    "strokes": m_strokes, "fade": m_fade, "glyph_zero_one": m_zero_one, "eclipse": m_eclipse,
}


# ---------------------------------------------------------------- typography
def wrap(text: str, f, max_w: int) -> list:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if _measure.textlength(trial, font=f) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def fit_title(text: str, key: str, max_w: int, max_lines: int, start: int, low: int):
    size = start
    while True:
        f = font(key, size)
        lines = wrap(text, f, max_w)
        fits = len(lines) <= max_lines and all(_measure.textlength(ln, font=f) <= max_w for ln in lines)
        if fits or size <= low:
            return f, lines, size
        size -= 4


def tracked_w(text: str, f, track: int) -> float:
    return sum(_measure.textlength(c, font=f) for c in text) + track * (len(text) - 1)


def draw_tracked(d, text, cx, y, f, fill, track, align="center", x_left=0):
    x = x_left if align == "left" else cx - tracked_w(text, f, track) / 2
    for c in text:
        d.text((round(x), round(y)), c, font=f, fill=fill)
        x += _measure.textlength(c, font=f) + track


def draw_text(img: Image.Image, e: dict, pal: dict) -> None:
    L = LAYOUTS[e.get("layout", "top")]
    d = ImageDraw.Draw(img)
    serif = e.get("font", "serif") == "serif"
    left = L["align"] == "left"
    x0, y0 = L["xy"]
    f, lines, size = fit_title(e["title"], "serif" if serif else "sans", L["max_w"], L["lines"], L["start"], L["low"])
    lh = int(size * 1.06)
    title_h = lh * len(lines)
    y = (L["block_bottom"] - (title_h + 40 + 60)) if "block_bottom" in L else y0
    for i, ln in enumerate(lines):
        yy = y + i * lh
        if left:
            d.text((x0, yy), ln, font=f, fill=pal["ink"])
        else:
            d.text((round(400 - _measure.textlength(ln, font=f) / 2), yy), ln, font=f, fill=pal["ink"])
    ry = y + title_h + int(size * 0.1)
    if left:
        d.line([(x0, ry), (x0 + 120, ry)], fill=pal["accent"], width=4)
    else:
        d.line([(340, ry), (460, ry)], fill=pal["accent"], width=4)
    ay = ry + 28
    author = e["author"]
    if serif:
        af = font("serif_it", 34)
        while _measure.textlength(author, font=af) > L["max_w"] and af.size > 18:
            af = font("serif_it", af.size - 2)
        if left:
            d.text((x0, ay), author, font=af, fill=pal["sub"])
        else:
            d.text((round(400 - _measure.textlength(author, font=af) / 2), ay), author, font=af, fill=pal["sub"])
    else:
        af = font("sans_med", 25)
        txt = author.upper()
        while tracked_w(txt, af, 3) > L["max_w"] and af.size > 16:
            af = font("sans_med", af.size - 2)
        if left:
            draw_tracked(d, txt, 0, ay, af, pal["sub"], 3, align="left", x_left=x0)
        else:
            draw_tracked(d, txt, 400, ay, af, pal["sub"], 3)
    draw_tracked(d, "BOOKNOMICS", 400, 1110, font("sans_med", 18), pal["ink"], 9)


# ---------------------------------------------------------------- render / save
def render(e: dict, index: int):
    seed = zlib.crc32(e["slug"].encode("utf-8"))
    rnd = random.Random(seed)
    mode = e.get("mode", "dark")
    hue = float(e.get("hue", (index * GOLDEN_ANGLE + 18.0) % 360.0))
    pal = make_palette(hue, mode)
    img = background(pal, seed)
    L = LAYOUTS[e.get("layout", "top")]
    if e["motif"] not in MOTIFS:
        sys.exit(f"Unknown motif '{e['motif']}' for {e['slug']}")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    MOTIFS[e["motif"]](ImageDraw.Draw(layer), L["box"], pal, rnd, e.get("params", {}))
    composite(img, layer, e.get("glow", 10))
    draw_text(img, e, pal)
    return img.convert("RGB"), hue


def save_jpeg(img: Image.Image, path: str):
    for q in (88, 85, 82, 79, 76):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=q, optimize=True, progressive=True, subsampling=2)
        data = buf.getvalue()
        if len(data) <= 300_000:
            break
    with open(path, "wb") as fh:
        fh.write(data)
    return q, data


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--queue", required=True, help="JSON list of books (max 100)")
    ap.add_argument("--out", required=True, help="folder for <slug>-cover.jpg files")
    ap.add_argument("--only", nargs="*", help="render only these slugs")
    args = ap.parse_args()

    with open(args.queue, encoding="utf-8") as fh:
        books = json.load(fh)
    if isinstance(books, dict):
        books = books["books"]
    if len(books) > MAX_PER_RUN:
        sys.exit(f"Queue has {len(books)} entries; the limit is {MAX_PER_RUN} per run.")
    slugs = [b["slug"] for b in books]
    if len(set(slugs)) != len(slugs):
        sys.exit("Duplicate slugs in queue.")

    os.makedirs(args.out, exist_ok=True)
    rows, seen = [], {}
    for i, e in enumerate(books):
        if args.only and e["slug"] not in args.only:
            continue
        img, hue = render(e, i)
        q, data = save_jpeg(img, os.path.join(args.out, f"{e['slug']}-cover.jpg"))
        digest = hashlib.sha1(data).hexdigest()
        if digest in seen:
            sys.exit(f"Identical image produced for {e['slug']} and {seen[digest]}")
        seen[digest] = e["slug"]
        kb = len(data) // 1024
        rows.append({
            "slug": e["slug"], "file": f"{e['slug']}-cover.jpg", "title": e["title"], "author": e["author"],
            "motif": e["motif"], "layout": e.get("layout", "top"), "mode": e.get("mode", "dark"),
            "hue": round(hue, 1), "kb": kb, "sha1": digest[:12],
        })
        print(f"[{i + 1:>3}/{len(books)}] {e['slug']:<40} {kb:>4} KB  q={q}  motif={e['motif']}")

    if rows:
        with open(os.path.join(args.out, "manifest.csv"), "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    print(f"Done: {len(rows)} covers written to {args.out}")


if __name__ == "__main__":
    main()
