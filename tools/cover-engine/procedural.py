#!/usr/bin/env python3
"""Procedural 3D-style covers with Pillow (no AI image calls).

Usage:
  python3 procedural.py            # build covers for books with no cover yet
  python3 procedural.py --force    # rebuild all books (overwrites existing jpg)

Needs: pip install pillow   (fonts: DejaVu, same as engine.py)
Each cover: gradient backdrop, a glossy 3D object (sphere / torus / stacked
blocks / pyramid), soft floor shadow, hardback spine + page edge, title and author.
"""
import hashlib, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
MANIFEST = os.environ.get("COVER_MANIFEST", os.path.join(HERE, "manifest.tsv"))
OUT_DIR = os.path.join(REPO, "content-drafts", "covers")
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
W, H = 800, 1200

# (background top, background bottom, object light, object dark)
PALETTES = [
    ((14, 30, 66), (40, 90, 140), (120, 200, 255), (10, 30, 70)),
    ((70, 20, 40), (150, 50, 60), (255, 170, 120), (60, 10, 30)),
    ((20, 60, 50), (60, 130, 110), (180, 255, 220), (10, 40, 35)),
    ((60, 40, 10), (170, 120, 40), (255, 225, 140), (80, 45, 10)),
    ((40, 20, 70), (110, 60, 150), (230, 180, 255), (30, 10, 55)),
    ((15, 15, 20), (60, 60, 75), (220, 220, 235), (25, 25, 35)),
    ((10, 50, 60), (30, 120, 130), (150, 245, 240), (5, 35, 45)),
    ((80, 50, 25), (160, 100, 60), (250, 210, 170), (60, 30, 15)),
]


def pick(key, n):
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % n


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(size, top, bottom):
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(size[1]):
        d.line([(0, y), (size[0], y)], fill=lerp(top, bottom, y / (size[1] - 1)))
    return img


def sphere(d, light, dark):
    mask = ImageOps.invert(Image.radial_gradient("L").resize((d, d)))
    body = ImageOps.colorize(mask, black=dark, white=light).convert("RGBA")
    m = Image.new("L", (d, d), 0)
    ImageDraw.Draw(m).ellipse([0, 0, d - 1, d - 1], fill=255)
    body.putalpha(m)
    return body


def torus(d, light, dark):
    img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    thick = d // 4
    for i in range(thick):
        col = lerp(light, dark, abs(i / thick - 0.4))
        dr.ellipse([i, d // 5 + i, d - i, d - d // 5 - i], outline=col + (255,), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.6))


def blocks(d, light, dark):
    img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    bw, bh = int(d * 0.62), int(d * 0.22)
    for i in range(3):
        x0 = (d - bw) // 2 + i * int(d * 0.04)
        y0 = d - (i + 1) * bh - i * int(d * 0.02)
        dr.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=int(bh * 0.25),
                             fill=lerp(light, dark, i * 0.25) + (255,))
        dr.rectangle([x0, y0 + bh // 3, x0 + bw, y0 + bh // 3 + 2], fill=(255, 255, 255, 60))
    return img


def pyramid(d, light, dark):
    img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.polygon([(d // 2, 0), (d, d), (0, d)], fill=dark + (255,))
    dr.polygon([(d // 2, 0), (d // 2, d), (0, d)], fill=light + (255,))
    return img.filter(ImageFilter.GaussianBlur(0.8))


SHAPES = [sphere, torus, blocks, pyramid]


def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, fnt, max_w):
    lines, cur = [], ""
    for w in text.split():
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=fnt) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_title(draw, title, max_w, max_h):
    for size in range(96, 40, -4):
        f = font(SERIF, size)
        lines = wrap(draw, title, f, max_w)
        lh = int(size * 1.12)
        if len(lines) <= 4 and len(lines) * lh <= max_h:
            return f, lines, lh
    f = font(SERIF, 40)
    return f, wrap(draw, title, f, max_w), 46


def build(slug, title, author):
    top, bottom, light, dark = PALETTES[pick(slug, len(PALETTES))]
    bg = vgrad((W, H), top, bottom).convert("RGBA")

    # floor shadow + 3D object
    shape = SHAPES[pick(slug + "s", len(SHAPES))]
    d = 380
    obj = shape(d, light, dark)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([W // 2 - 190, 1000, W // 2 + 190, 1060], fill=(0, 0, 0, 150))
    bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(18)))
    bg.alpha_composite(obj, (W // 2 - d // 2 + 20, 1000 - d + 40))

    # darker band at top for legible text
    band = Image.new("RGBA", (W, 640), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for y in range(640):
        bd.line([(0, y), (W, y)], fill=(8, 12, 28, int(200 * (1 - y / 640))))
    bg.alpha_composite(band, (0, 0))

    draw = ImageDraw.Draw(bg)
    tf, tlines, lh = fit_title(draw, title, 640, 420)
    y = 110
    for line in tlines:
        w = draw.textlength(line, font=tf)
        draw.text(((W - w) / 2 + 20, y), line, font=tf, fill=(247, 238, 220, 255))
        y += lh
    af = font(SANS, 38)
    y += 24
    for line in wrap(draw, author, af, 640):
        w = draw.textlength(line, font=af)
        draw.text(((W - w) / 2 + 20, y), line, font=af, fill=(233, 220, 192, 255))
        y += 50

    # hardback spine (left) and page edge (right)
    spine = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spine)
    for x in range(48):
        a = int(150 * (1 - abs(x / 47 - 0.5) * 1.6))
        sd.line([(x, 0), (x, H)], fill=(0, 0, 0, 120 + a // 2))
    sd.line([(6, 0), (6, H)], fill=(255, 255, 255, 40))
    sd.line([(36, 0), (36, H)], fill=(0, 0, 0, 90))
    sd.line([(42, 0), (42, H)], fill=(255, 255, 255, 60))
    bg.alpha_composite(spine, (0, 0))
    pages = Image.new("RGBA", (12, H), (239, 230, 210, 255))
    pd = ImageDraw.Draw(pages)
    for x in (0, 3, 7, 10):
        pd.line([(x, 0), (x, H)], fill=(201, 187, 156, 255))
    bg.alpha_composite(pages, (W - 12, 0))

    # brand wordmark, letter-spaced
    bf = font(SANS, 26)
    text = "BOOKNOMICS"
    total = sum(draw.textlength(c, font=bf) + 8 for c in text) - 8
    x = (W - total) / 2 + 14
    for c in text:
        draw.text((x, H - 70), c, font=bf, fill=(247, 238, 220, 215))
        x += draw.textlength(c, font=bf) + 8
    return bg.convert("RGB")


def main():
    force = "--force" in sys.argv
    os.makedirs(OUT_DIR, exist_ok=True)
    built = 0
    with open(MANIFEST, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            slug, title, author, _theme = line.rstrip("\n").split("\t")
            out = os.path.join(OUT_DIR, f"{slug}-cover.jpg")
            if os.path.exists(out) and not force:
                continue
            build(slug, title, author).save(out, "JPEG", quality=88, optimize=True, progressive=True)
            built += 1
            print("built", slug)
    print("procedural covers built:", built)


if __name__ == "__main__":
    main()
