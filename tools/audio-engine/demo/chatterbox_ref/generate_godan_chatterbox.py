from __future__ import annotations

import base64
import math
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

ROOT = Path(__file__).resolve().parent
TEXT_PATH = ROOT.parent / "godan_20min_hi.txt"
REF_PATH = ROOT / "godan_ref_short.wav"
OUT_PATH = ROOT / "godan_20min_hi_chatterbox.mp3"
INFO_PATH = ROOT / "godan_chatterbox_info.txt"

TARGET_SECONDS = 20 * 60
MAX_CHARS = 270
SEED = 20261004
EXAGGERATION = 0.58
CFG_WEIGHT = 0.30
TEMPERATURE = 0.75


def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def split_text(text: str) -> list[str]:
    text = text.replace("Booknomics", "बुकनॉमिक्स")
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    for p in paragraphs:
        sentences = re.split(r"(?<=[।!?])\s+", p)
        buf = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            candidate = (buf + " " + sentence).strip()
            if len(candidate) <= MAX_CHARS:
                buf = candidate
                continue
            if buf:
                chunks.append(buf)
            while len(sentence) > MAX_CHARS:
                cut = sentence.rfind(" ", 0, MAX_CHARS)
                if cut < 120:
                    cut = MAX_CHARS
                chunks.append(sentence[:cut].strip())
                sentence = sentence[cut:].strip()
            buf = sentence
        if buf:
            chunks.append(buf)
    return chunks


def get_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip()
    return float(out)


def main() -> None:
    if not TEXT_PATH.exists():
        raise SystemExit(f"Missing text: {TEXT_PATH}")
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise SystemExit("ffmpeg/ffprobe required")

    ref_parts = sorted(ROOT.glob("shortpart_*.txt"))
    if not ref_parts:
        raise SystemExit("Missing reference base64 parts")
    ref_mp3 = ROOT / "godan_ref_short.mp3"
    payload = "".join(p.read_text(encoding="utf-8").strip() for p in ref_parts)
    ref_mp3.write_bytes(base64.b64decode(payload))
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(ref_mp3), "-ar", "24000", "-ac", "1", str(REF_PATH),
    ])

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading Chatterbox Multilingual on {device}...", flush=True)
    model = ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model="v3")

    text = TEXT_PATH.read_text(encoding="utf-8").strip()
    chunks = split_text(text)
    print(f"Narration chunks: {len(chunks)}", flush=True)

    torch.manual_seed(SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(SEED)

    tmp = Path(tempfile.mkdtemp(prefix="booknomics-chatterbox-"))
    try:
        wav_parts: list[Path] = []
        for idx, chunk in enumerate(chunks, 1):
            print(f"Generating {idx}/{len(chunks)}: {chunk[:55]}...", flush=True)
            torch.manual_seed(SEED + idx)
            wav = model.generate(
                chunk,
                language_id="hi",
                audio_prompt_path=str(REF_PATH),
                exaggeration=EXAGGERATION,
                cfg_weight=CFG_WEIGHT,
                temperature=TEMPERATURE,
            )
            part = tmp / f"{idx:04d}.wav"
            ta.save(str(part), wav.cpu(), model.sr)
            wav_parts.append(part)

        concat = tmp / "concat.txt"
        concat.write_text("\n".join(f"file '{p.as_posix()}'" for p in wav_parts), encoding="utf-8")
        raw = tmp / "raw.wav"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat),
            "-c:a", "pcm_s16le", str(raw),
        ])

        raw_seconds = get_duration(raw)
        tempo = max(0.90, min(1.10, raw_seconds / TARGET_SECONDS))
        print(f"Raw duration={raw_seconds:.2f}s; atempo={tempo:.5f}", flush=True)
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(raw),
            "-af", f"atempo={tempo:.5f},loudnorm=I=-16:LRA=7:TP=-1.5",
            "-ar", "48000", "-ac", "1",
            "-c:a", "libmp3lame", "-b:a", "96k", str(OUT_PATH),
        ])
        final_seconds = get_duration(OUT_PATH)
        INFO_PATH.write_text(
            "\n".join([
                "provider=ResembleAI Chatterbox Multilingual V3",
                f"device={device}",
                "language=hi",
                f"reference={REF_PATH.name}",
                f"seed={SEED}",
                f"exaggeration={EXAGGERATION}",
                f"cfg_weight={CFG_WEIGHT}",
                f"temperature={TEMPERATURE}",
                f"chunks={len(chunks)}",
                f"raw_duration_seconds={raw_seconds:.2f}",
                f"tempo={tempo:.5f}",
                f"final_duration_seconds={final_seconds:.2f}",
                "master=mono 48kHz 96kbps -16LUFS",
            ]) + "\n",
            encoding="utf-8",
        )
        print(f"DONE: {OUT_PATH} ({final_seconds/60:.2f} min)", flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
