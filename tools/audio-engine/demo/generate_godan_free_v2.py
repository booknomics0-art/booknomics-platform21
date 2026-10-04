from __future__ import annotations

import asyncio
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "godan_20min_hi.txt"
OUTPUT = ROOT / "godan_20min_hi_free_female_v2.mp3"
VOICE_INFO = ROOT / "godan_free_voice_v2.txt"

# Swara is intentionally NOT preferred because the previous demo was rejected.
PREFERRED_HINDI_FEMALE_VOICES = [
    "hi-IN-KavyaNeural",
    "hi-IN-AnanyaNeural",
    "hi-IN-AartiNeural",
]
RATE = "-4%"
PITCH = "+0Hz"
VOLUME = "+0%"
MAX_CHARS = 2800


def split_text(text: str) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        cand = (buf + "\n\n" + p).strip()
        if len(cand) <= MAX_CHARS:
            buf = cand
            continue
        if buf:
            chunks.append(buf)
        if len(p) <= MAX_CHARS:
            buf = p
            continue
        sents = re.split(r"(?<=[।!?])\s+", p)
        small = ""
        for s in sents:
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


async def choose_voice() -> str:
    voices = await edge_tts.list_voices()
    available = {v.get("ShortName") for v in voices}
    for voice in PREFERRED_HINDI_FEMALE_VOICES:
        if voice in available:
            return voice
    candidates = sorted(v for v in available if v and v.startswith("hi-IN-") and "Neural" in v)
    raise RuntimeError(
        "None of the preferred Hindi female voices are available. "
        f"Hindi voices seen: {candidates}"
    )


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


async def main() -> None:
    if not INPUT.exists():
        raise SystemExit(f"Missing narration script: {INPUT}")
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg is required")

    text = INPUT.read_text(encoding="utf-8").strip()
    text = text.replace("Booknomics", "बुकनॉमिक्स")
    chunks = split_text(text)
    voice = await choose_voice()
    VOICE_INFO.write_text(
        f"voice={voice}\nrate={RATE}\npitch={PITCH}\nvolume={VOLUME}\nchunks={len(chunks)}\n",
        encoding="utf-8",
    )
    print(f"Selected voice: {voice}; chunks={len(chunks)}")

    tmp = Path(tempfile.mkdtemp(prefix="booknomics-godan-free-v2-"))
    try:
        parts: list[Path] = []
        for i, chunk in enumerate(chunks, 1):
            part = tmp / f"{i:03d}.mp3"
            print(f"Generating {i}/{len(chunks)}")
            await edge_tts.Communicate(
                text=chunk,
                voice=voice,
                rate=RATE,
                pitch=PITCH,
                volume=VOLUME,
            ).save(str(part))
            parts.append(part)

        concat = tmp / "concat.txt"
        concat.write_text(
            "\n".join(f"file '{p.as_posix()}'" for p in parts),
            encoding="utf-8",
        )
        raw = tmp / "raw.mp3"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat),
            "-c:a", "libmp3lame", "-b:a", "112k", str(raw),
        ])

        # Match the supplied reference's practical delivery format: mono, 48 kHz,
        # controlled loudness and enough bitrate to avoid harshness.
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(raw),
            "-af", "loudnorm=I=-16:LRA=7:TP=-1.5",
            "-ar", "48000", "-ac", "1",
            "-c:a", "libmp3lame", "-b:a", "96k", str(OUTPUT),
        ])

        duration = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(OUTPUT),
        ], text=True).strip()
        mins = float(duration) / 60
        VOICE_INFO.write_text(
            VOICE_INFO.read_text(encoding="utf-8") + f"duration_minutes={mins:.2f}\n",
            encoding="utf-8",
        )
        print(f"DONE {OUTPUT} duration={mins:.2f} min")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
