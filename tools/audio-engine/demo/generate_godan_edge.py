from __future__ import annotations
import asyncio
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import edge_tts

VOICE = "hi-IN-SwaraNeural"
RATE = "-8%"
VOLUME = "+0%"
PITCH = "+0Hz"
MAX_CHARS = 3200
ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "godan_20min_hi.txt"
OUTPUT = ROOT / "godan_20min_hi_female.mp3"


def split_text(text: str) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        candidate = (buf + "\n\n" + p).strip()
        if len(candidate) <= MAX_CHARS:
            buf = candidate
            continue
        if buf:
            chunks.append(buf)
        if len(p) <= MAX_CHARS:
            buf = p
            continue
        sentences = re.split(r"(?<=[।!?])\s+", p)
        small = ""
        for s in sentences:
            cand = (small + " " + s).strip()
            if len(cand) <= MAX_CHARS:
                small = cand
            else:
                if small:
                    chunks.append(small)
                small = s
        buf = small
    if buf:
        chunks.append(buf)
    return chunks


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


async def main() -> None:
    text = INPUT.read_text(encoding="utf-8").strip()
    chunks = split_text(text)
    tmp = Path(tempfile.mkdtemp(prefix="godan-tts-"))
    try:
        parts: list[Path] = []
        for i, chunk in enumerate(chunks, 1):
            part = tmp / f"{i:03d}.mp3"
            print(f"Generating {i}/{len(chunks)} with {VOICE}")
            await edge_tts.Communicate(
                text=chunk,
                voice=VOICE,
                rate=RATE,
                volume=VOLUME,
                pitch=PITCH,
            ).save(str(part))
            parts.append(part)

        concat = tmp / "concat.txt"
        concat.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
        raw = tmp / "raw.mp3"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat),
            "-c:a", "libmp3lame", "-b:a", "64k", str(raw),
        ])
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(raw),
            "-af", "loudnorm=I=-16:LRA=8:TP=-1.5",
            "-ac", "1", "-ar", "24000",
            "-c:a", "libmp3lame", "-b:a", "48k", str(OUTPUT),
        ])
        duration = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(OUTPUT),
        ], text=True).strip()
        mins = float(duration) / 60
        (ROOT / "godan_duration.txt").write_text(f"{mins:.2f} minutes\n", encoding="utf-8")
        print(f"DONE: {OUTPUT} | duration={mins:.2f} min")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
