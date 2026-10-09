from __future__ import annotations
import os, re, shutil, subprocess, tempfile
from pathlib import Path
import requests

VOICE_ID = "g7a3ynTNrZDEp5Gp0DBg"  # The Velvet Narrator
MODEL_ID = "eleven_multilingual_v2"
ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "godan_20min_hi.txt"
OUTPUT = ROOT / "godan_20min_hi_elevenlabs.mp3"


def split_text(text: str, max_chars: int = 4200) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, buf = [], ""
    for p in paras:
        cand = (buf + "\n\n" + p).strip()
        if len(cand) <= max_chars:
            buf = cand
            continue
        if buf:
            chunks.append(buf)
        if len(p) <= max_chars:
            buf = p
            continue
        sentences = re.split(r"(?<=[।!?])\s+", p)
        small = ""
        for s in sentences:
            cand = (small + " " + s).strip()
            if len(cand) <= max_chars:
                small = cand
            else:
                if small:
                    chunks.append(small)
                small = s
        buf = small
    if buf:
        chunks.append(buf)
    return chunks


def synth(api_key: str, text: str, out_path: Path, seed: int, previous_text: str | None, next_text: str | None) -> None:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    payload = {
        "text": text,
        "model_id": MODEL_ID,
        "seed": seed,
        "voice_settings": {
            "stability": 0.46,
            "similarity_boost": 0.86,
            "style": 0.18,
            "use_speaker_boost": True,
            "speed": 0.95,
        },
    }
    if previous_text:
        payload["previous_text"] = previous_text[-1000:]
    if next_text:
        payload["next_text"] = next_text[:1000]
    r = requests.post(
        url,
        params={"output_format": "mp3_44100_96"},
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=240,
    )
    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs {r.status_code}: {r.text[:1000]}")
    out_path.write_bytes(r.content)


def main() -> None:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise SystemExit("ELEVENLABS_API_KEY GitHub secret is missing")
    if not INPUT.exists():
        raise SystemExit(f"Missing input: {INPUT}")
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg missing")

    text = INPUT.read_text(encoding="utf-8").replace("Booknomics", "बुकनॉमिक्स").strip()
    chunks = split_text(text)
    tmp = Path(tempfile.mkdtemp(prefix="godan-elevenlabs-"))
    try:
        parts = []
        for i, chunk in enumerate(chunks):
            part = tmp / f"{i:03d}.mp3"
            print(f"Generating chunk {i+1}/{len(chunks)}")
            synth(
                api_key,
                chunk,
                part,
                24061936 + i,
                chunks[i-1] if i else None,
                chunks[i+1] if i + 1 < len(chunks) else None,
            )
            parts.append(part)

        concat = tmp / "concat.txt"
        concat.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
        raw = tmp / "raw.mp3"
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat),
            "-c:a", "libmp3lame", "-b:a", "96k", str(raw)
        ], check=True)
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(raw),
            "-af", "loudnorm=I=-16:LRA=7:TP=-1.5",
            "-ar", "48000", "-ac", "1",
            "-c:a", "libmp3lame", "-b:a", "96k", str(OUTPUT)
        ], check=True)

        dur = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(OUTPUT)
        ], text=True).strip()
        (ROOT / "godan_elevenlabs_duration.txt").write_text(f"{float(dur)/60:.2f} minutes\n", encoding="utf-8")
        print("DONE", OUTPUT, f"duration={float(dur)/60:.2f} min")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
