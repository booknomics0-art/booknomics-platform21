#!/usr/bin/env python3
"""Batch cover engine for Booknomics.

Usage:
  python3 engine.py status            # counts: built / art ready / pending art
  python3 engine.py next [N]          # next N books that still need artwork (JSON)
  python3 engine.py build             # compose 3D covers for every book with art ready

Flow: `next` gives prompts for the image tool (10 per turn). Once the art PNG
exists at ART_DIR/<slug>-art.png, `build` adds title/author text, the 3D hardback
spine and the page edge, and writes content-drafts/covers/<slug>-cover.jpg.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
MANIFEST = os.path.join(HERE, "manifest.tsv")
ART_DIR = os.environ.get("COVER_ART_DIR", "/tmp/covers-batch/art")
OUT_DIR = os.path.join(REPO, "content-drafts", "covers")
FX_DIR = os.environ.get("COVER_FX_DIR", "/tmp/covers-3d")  # spine.png, pages.png, fade.png
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
TMP = "/tmp/cover-engine-tmp"
PROMPT = ("3D rendered book cover artwork, portrait 2:3, glossy soft 3D render style "
          "with realistic lighting, {theme}, cinematic, clean upper third left empty for "
          "title, no text, no letters, no words anywhere.")


def load():
    rows = []
    with open(MANIFEST, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            slug, title, author, theme = line.split("\t")
            rows.append(dict(slug=slug, title=title, author=author, theme=theme))
    return rows


def art_path(r):
    return os.path.join(ART_DIR, f"{r['slug']}-art.png")


def cover_path(r):
    return os.path.join(OUT_DIR, f"{r['slug']}-cover.jpg")


def status():
    rows = load()
    built = sum(os.path.exists(cover_path(r)) for r in rows)
    art = sum(os.path.exists(art_path(r)) for r in rows)
    pending = [r for r in rows if not os.path.exists(cover_path(r)) and not os.path.exists(art_path(r))]
    print(json.dumps(dict(total=len(rows), built=built, art_ready=art,
                          pending_art=len(pending)), ensure_ascii=False))


def nxt(n):
    rows = load()
    todo = [r for r in rows if not os.path.exists(cover_path(r)) and not os.path.exists(art_path(r))][:n]
    out = [dict(slug=r["slug"], title=r["title"], file_path=art_path(r),
                prompt=PROMPT.format(theme=r["theme"])) for r in todo]
    print(json.dumps(out, ensure_ascii=False, indent=2))


def run(cmd):
    subprocess.run(cmd, check=True)


def build_one(r):
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    title, author = r["title"], r["author"]
    n = len(title)
    tsize = 84 if n <= 25 else 70 if n <= 45 else 58
    t_png = os.path.join(TMP, "t.png")
    a_png = os.path.join(TMP, "a.png")
    run(["convert", "-background", "none", "-font", SERIF, "-pointsize", str(tsize),
         "-fill", "#F7EEDC", "-interline-spacing", "-6", "-gravity", "center",
         "-size", "680x", f"caption:{title}", t_png])
    th = int(subprocess.check_output(["identify", "-format", "%h", t_png]).decode())
    run(["convert", "-background", "none", "-font", SANS, "-pointsize", "38",
         "-fill", "#E9DCC0", "-gravity", "center", "-size", "680x", f"caption:{author}", a_png])
    y_auth = 110 + th + 24
    run(["convert", art_path(r), "-resize", "800x1200^", "-gravity", "center", "-extent", "800x1200",
         os.path.join(FX_DIR, "fade.png"), "-compose", "overlay", "-composite",
         "(", "-size", "800x640", "gradient:rgba(8,12,28,0.85)-rgba(8,12,28,0)", ")",
         "-gravity", "north", "-compose", "over", "-composite",
         os.path.join(FX_DIR, "spine.png"), "-gravity", "west", "-geometry", "+0+0", "-composite",
         os.path.join(FX_DIR, "pages.png"), "-gravity", "east", "-geometry", "+0+0", "-composite",
         t_png, "-gravity", "north", "-geometry", "+22+110", "-composite",
         a_png, "-gravity", "north", "-geometry", f"+22+{y_auth}", "-composite",
         "-font", SANS, "-pointsize", "26", "-fill", "rgba(247,238,220,0.85)",
         "-gravity", "south", "-kerning", "8", "-annotate", "+14+40", "BOOKNOMICS",
         "-strip", "-interlace", "Plane", "-quality", "88", "-sampling-factor", "4:2:0",
         cover_path(r)])


def build():
    done = 0
    for r in load():
        if os.path.exists(art_path(r)):
            build_one(r)
            print("built", r["slug"])
            done += 1
    print("total built this run:", done)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "status":
        status()
    elif cmd == "next":
        nxt(int(sys.argv[2]) if len(sys.argv) > 2 else 10)
    elif cmd == "build":
        build()
    else:
        print(__doc__)
        sys.exit(1)
