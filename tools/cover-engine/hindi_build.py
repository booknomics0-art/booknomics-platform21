#!/usr/bin/env python3
"""Hindi (Devanagari) 3D-style covers.

Pipeline:
  raw list (Latin "Title — Author")  ->  manifest with Devanagari title/author
  (translit_deva.py)  ->  art via procedural.py (3D object, gradient, spine)
  ->  Devanagari text composited with ImageMagick (Pillow lacks raqm, so
      matras/conjuncts would break).

Usage:
  python3 hindi_build.py raw/<file>.txt manifest-hindi-<name>.tsv   # manifest only
  python3 hindi_build.py --covers manifest-hindi-<name>.tsv          # build covers

Fonts (not in repo): Noto Sans Devanagari 700/400 TTF in ~/.fonts-cover/.
Recreate with:  npm pack @fontsource/noto-sans-devanagari@5, then extract
package/files/noto-sans-devanagari-devanagari-{400,700}-normal.woff and convert
with fontTools (TTFont(src).flavor=None; save(.ttf)).
"""
import os, re, subprocess, sys, tempfile, unicodedata, html
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import procedural as P
from translit_deva import to_deva

FONT_TITLE = os.path.expanduser("~/.fonts-cover/NotoSansDevanagari-700.ttf")
FONT_AUTHOR = os.path.expanduser("~/.fonts-cover/NotoSansDevanagari-400.ttf")
TEXT_RGB = (247, 238, 220)
AUTH_RGB = (233, 220, 192)
W, H = P.W, P.H


def manifest(raw, dst):
    seen, out = set(), []
    for line in open(raw, encoding="utf-8"):
        line = line.strip()
        if not line or " — " not in line:
            continue
        t, a = (html.unescape(p.strip()) for p in line.split(" — ", 1))
        a = a.split(", ")[0].strip()
        s = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
        s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:70] or "book"
        base, n = s, 2
        while s in seen:
            s = f"{base}-{n}"
            n += 1
        seen.add(s)
        out.append(f"{s}\t{to_deva(t)}\t{to_deva(a)}\t{t}\t{a}")
    open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(len(out), "books ->", dst)


def caption(text, font, pointsize, width):
    """Render wrapped Devanagari text to an RGBA PNG with ImageMagick."""
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    subprocess.run(["convert", "-background", "none", "-font", font,
                    "-pointsize", str(pointsize), "-size", f"{width}x",
                    "-gravity", "center", "-fill", "white",
                    f"caption:{text}", path], check=True)
    return Image.open(path).convert("RGBA"), path


def title_block(title):
    # fit within 640 x 420 like the Latin covers, 4 lines max
    for size in range(96, 39, -6):
        img, path = caption(title, FONT_TITLE, size, 640)
        if img.height <= 420:
            return img, path
        os.remove(path)
    return caption(title, FONT_TITLE, 40, 640)


def tint(img, rgb):
    """Recolor a white-on-transparent caption to rgb keeping alpha."""
    r, g, b, a = img.split()
    solid = Image.new("RGBA", img.size, rgb + (255,))
    solid.putalpha(a)
    return solid


def build(slug, title_deva, author_deva):
    top, bottom, light, dark = P.PALETTES[P.pick(slug, len(P.PALETTES))]
    bg = P.vgrad((W, H), top, bottom).convert("RGBA")
    shape = P.SHAPES[P.pick(slug + "s", len(P.SHAPES))]
    d = 380
    obj = shape(d, light, dark)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([W // 2 - 190, 1000, W // 2 + 190, 1060], fill=(0, 0, 0, 150))
    bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(18)))
    bg.alpha_composite(obj, (W // 2 - d // 2 + 20, 1000 - d + 40))
    band = Image.new("RGBA", (W, 640), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for y in range(640):
        bd.line([(0, y), (W, y)], fill=(8, 12, 28, int(200 * (1 - y / 640))))
    bg.alpha_composite(band, (0, 0))

    tcap, tpath = title_block(title_deva)
    acap, apath = caption(author_deva, FONT_AUTHOR, 38, 640)
    try:
        tcap = tint(tcap, TEXT_RGB)
        acap = tint(acap, AUTH_RGB)
        bg.alpha_composite(tcap, (int((W - tcap.width) / 2 + 20), 110))
        ay = 110 + tcap.height + 24
        bg.alpha_composite(acap, (int((W - acap.width) / 2 + 20), ay))
    finally:
        os.remove(tpath)
        os.remove(apath)

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

    # BOOKNOMICS wordmark stays Latin: it is the brand logo, as on the English covers
    from PIL import ImageFont
    draw = ImageDraw.Draw(bg)
    bf = ImageFont.truetype(P.SANS, 26)
    text = "BOOKNOMICS"
    total = sum(draw.textlength(c, font=bf) + 8 for c in text) - 8
    x = (W - total) / 2 + 14
    for c in text:
        draw.text((x, H - 70), c, font=bf, fill=(247, 238, 220, 215))
        x += draw.textlength(c, font=bf) + 8
    return bg.convert("RGB")


def build_all(manifest_path):
    out_dir = P.OUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    built, skipped = 0, []
    for line in open(manifest_path, encoding="utf-8"):
        if not line.strip():
            continue
        slug, td, ad, _t, _a = line.rstrip("\n").split("\t")
        out = os.path.join(out_dir, f"{slug}-cover.jpg")
        if os.path.exists(out):
            skipped.append(slug)
            continue
        build(slug, td, ad).save(out, "JPEG", quality=88, optimize=True, progressive=True)
        built += 1
    print("hindi covers built:", built, "skipped (existing):", len(skipped), skipped[:20])


if __name__ == "__main__":
    if sys.argv[1] == "--covers":
        build_all(sys.argv[2])
    else:
        manifest(sys.argv[1], sys.argv[2])
