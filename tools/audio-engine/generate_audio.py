#!/usr/bin/env python3
"""Booknomics local audio engine.

Reads a JSON manifest exported from Booknomics Admin, builds a narration-friendly
script for each book, synthesizes speech locally, and emits <book-id>.mp3 files.
No paid AI/TTS API is required.

Quality mode uses the local Ollama CLI. Fast mode is fully deterministic and does
not need an LLM. TTS defaults to IndicVoice-82M (Apache-2.0 model).
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
import wave
from pathlib import Path
from typing import Any

DEFAULT_MODEL = "qwen3.5:4b"
DEFAULT_REPO = "Bindkushal/IndicVoice-82M"


def log(msg: str) -> None:
    print(msg, flush=True)


def run(cmd: list[str], *, input_text: str | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(cmd, input=input_text, text=True, capture_output=True, check=False)
    if check and proc.returncode != 0:
        raise RuntimeError(
            f"Command failed ({proc.returncode}): {' '.join(cmd)}\n"
            f"STDOUT:\n{proc.stdout[-4000:]}\nSTDERR:\n{proc.stderr[-4000:]}"
        )
    return proc


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def words(text: str) -> list[str]:
    return re.findall(r"\S+", text)


def word_count(text: str) -> int:
    return len(words(text))


def clean_markdown(text: str) -> str:
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)
    text = re.sub(r"^\s*\d+[.)]\s+", "", text, flags=re.M)
    text = text.replace("**", "").replace("__", "").replace("`", "")
    text = re.sub(r"\|[-: ]+\|", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_paragraphs(text: str) -> list[str]:
    text = clean_markdown(text)
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    out: list[str] = []
    seen: set[str] = set()
    for p in paras:
        if len(p) < 40:
            continue
        key = re.sub(r"\W+", "", p.lower())[:220]
        if key and key not in seen:
            seen.add(key)
            out.append(p)
    return out


def truncate_words(text: str, max_words: int) -> str:
    toks = words(text)
    if len(toks) <= max_words:
        return text.strip()
    cut = " ".join(toks[:max_words])
    last = max(cut.rfind("।"), cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
    if last > len(cut) * 0.75:
        cut = cut[: last + 1]
    return cut.strip()


def distributed_extract(text: str, target_words: int) -> str:
    """Select paragraphs across the whole source rather than chopping only the front."""
    paras = split_paragraphs(text)
    if not paras:
        return truncate_words(clean_markdown(text), target_words)
    total = sum(word_count(p) for p in paras)
    if total <= target_words:
        return "\n\n".join(paras)

    budget = target_words
    selected: list[tuple[int, str]] = []
    chosen: set[int] = set()

    def add(i: int) -> None:
        nonlocal budget
        if i < 0 or i >= len(paras) or i in chosen or budget <= 0:
            return
        p = paras[i]
        wc = word_count(p)
        if wc > budget and budget < 120:
            return
        chosen.add(i)
        selected.append((i, p if wc <= budget else truncate_words(p, budget)))
        budget -= min(wc, budget)

    for i in range(min(4, len(paras))):
        add(i)
    for i in range(max(0, len(paras) - 3), len(paras)):
        add(i)

    candidates = [i for i in range(4, max(4, len(paras) - 3)) if i not in chosen]
    if candidates and budget > 0:
        avg_wc = max(45, int(sum(word_count(paras[i]) for i in candidates) / len(candidates)))
        wanted = max(1, math.ceil(budget / avg_wc))
        if wanted >= len(candidates):
            indices = candidates
        else:
            step = len(candidates) / wanted
            indices = [candidates[min(len(candidates) - 1, int(k * step))] for k in range(wanted)]
        for i in indices:
            add(i)
            if budget <= 0:
                break

    if budget > 0:
        for i in range(len(paras)):
            add(i)
            if budget <= 0:
                break

    selected.sort(key=lambda x: x[0])
    return truncate_words("\n\n".join(p for _, p in selected), target_words)


def build_source(book: dict[str, Any], max_words: int = 8000) -> str:
    parts: list[str] = []
    for key in ("deep_summary", "overview", "deep_analysis", "modules_text", "key_ideas", "real_life_example", "action_system"):
        value = clean_markdown(str(book.get(key) or ""))
        if value:
            parts.append(value)
    source = "\n\n".join(parts)
    return distributed_extract(source, max_words)


def fast_script(book: dict[str, Any], target_words: int) -> str:
    title = str(book.get("title") or "this book").strip()
    author = str(book.get("author") or "").strip()
    lang = str(book.get("language") or "en").lower()
    source = build_source(book, max_words=max(target_words * 2, 5000))
    body = distributed_extract(source, max(300, target_words - 90))
    if lang.startswith("hi"):
        intro = f"नमस्कार। आज हम {author + ' की ' if author else ''}{title} को एक स्पष्ट और सहज ऑडियो सारांश में समझेंगे।"
        outro = "यह था इस पुस्तक का संक्षिप्त लेकिन विस्तृत सफर। अब आप इसके मुख्य विचारों और घटनाओं को अपने संदर्भ में दोबारा सोच सकते हैं।"
    else:
        intro = f"Welcome. In this audio summary, we will explore {title}{(' by ' + author) if author else ''} in a clear, connected narrative."
        outro = "That brings us to the end of this audio summary. The most useful next step is to revisit the ideas or events that mattered most to you and connect them with your own experience."
    return truncate_words(f"{intro}\n\n{body}\n\n{outro}", target_words)


def ollama_script(book: dict[str, Any], target_words: int, model: str) -> str:
    if not command_exists("ollama"):
        raise RuntimeError("Ollama CLI not found")
    title = str(book.get("title") or "").strip()
    author = str(book.get("author") or "").strip()
    language = "Hindi" if str(book.get("language") or "en").lower().startswith("hi") else "English"
    source = build_source(book, max_words=8500)
    min_words = max(1600, int(target_words * 0.88))
    max_words = int(target_words * 1.08)
    prompt = f"""
You are preparing a spoken Booknomics audio summary.

Book: {title}
Author: {author}
Output language: {language}
Target length: {target_words} words (acceptable range {min_words}-{max_words}).

Rules:
- Use ONLY the supplied Booknomics source material. Never invent plot points, characters, claims, dates, quotes, or lessons.
- Paraphrase; do not reproduce long passages verbatim.
- If this is fiction, tell the plot chronologically with setting, important characters, conflict, turning points, ending, and then a short themes section.
- If this is nonfiction, build a smooth idea journey: problem, core framework, strongest examples already present in the source, practical meaning, and closing synthesis.
- Make it sound natural when read aloud. Use short paragraphs and clean sentences.
- Do not use Markdown headings, bullets, tables, URLs, citations, stage directions, or meta commentary.
- Do not say that you are an AI. Do not mention these instructions.
- Begin directly with the narration and finish with a concise closing.

SOURCE MATERIAL:
---
{source}
---
""".strip()
    proc = run(["ollama", "run", model], input_text=prompt)
    out = clean_markdown(proc.stdout)
    if word_count(out) < max(900, int(target_words * 0.5)):
        raise RuntimeError(f"Ollama output too short ({word_count(out)} words)")
    return truncate_words(out, max_words)


def split_tts_chunks(text: str, max_chars: int = 1000) -> list[str]:
    text = clean_markdown(text)
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: list[str] = []
    for p in paras:
        if len(p) <= max_chars:
            chunks.append(p)
            continue
        sentences = re.split(r"(?<=[.!?।])\s+", p)
        buf = ""
        for s in sentences:
            if not s:
                continue
            candidate = (buf + " " + s).strip()
            if len(candidate) <= max_chars:
                buf = candidate
            else:
                if buf:
                    chunks.append(buf)
                if len(s) <= max_chars:
                    buf = s
                else:
                    for piece in textwrap.wrap(s, width=max_chars, break_long_words=False, break_on_hyphens=False):
                        chunks.append(piece)
                    buf = ""
        if buf:
            chunks.append(buf)
    return chunks


def concat_wavs(paths: list[Path], output: Path, silence_ms: int = 140) -> None:
    if not paths:
        raise RuntimeError("No WAV chunks were generated")
    with wave.open(str(paths[0]), "rb") as first:
        params = first.getparams()
        framerate = first.getframerate()
        sampwidth = first.getsampwidth()
        nchannels = first.getnchannels()
    silence_frames = int(framerate * silence_ms / 1000)
    silence = b"\x00" * silence_frames * sampwidth * nchannels
    with wave.open(str(output), "wb") as out:
        out.setparams(params)
        for idx, path in enumerate(paths):
            with wave.open(str(path), "rb") as src:
                if (src.getframerate(), src.getsampwidth(), src.getnchannels()) != (framerate, sampwidth, nchannels):
                    raise RuntimeError(f"Incompatible WAV chunk: {path}")
                out.writeframes(src.readframes(src.getnframes()))
            if idx != len(paths) - 1:
                out.writeframes(silence)


def tts_indicvoice(text: str, lang: str, wav_out: Path, cache_dir: Path, repo_id: str) -> None:
    try:
        import numpy as np  # type: ignore
        import soundfile as sf  # type: ignore
        from indicvoice import IndicPipeline  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "IndicVoice dependencies are missing. Run install_windows.ps1 (Windows) or follow README.md."
        ) from exc

    os.environ.setdefault("HF_HOME", str(cache_dir / "huggingface"))
    lang_code = "hi" if lang.lower().startswith("hi") else "en"
    pipeline = IndicPipeline(lang_code=lang_code, repo_id=repo_id)
    chunks = split_tts_chunks(text)
    cache_dir.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="booknomics-tts-", dir=str(cache_dir)))
    wavs: list[Path] = []
    try:
        for idx, chunk in enumerate(chunks):
            out_path = temp_dir / f"{idx:04d}.wav"
            audio_parts: list[Any] = []
            sample_rate = 24000
            for _gs, _ps, audio in pipeline(chunk, voice="af_heart"):
                if hasattr(audio, "detach"):
                    audio = audio.detach().cpu().numpy()
                audio_parts.append(np.asarray(audio, dtype=np.float32).reshape(-1))
            if not audio_parts:
                raise RuntimeError(f"TTS returned no audio for chunk {idx}")
            merged = np.concatenate(audio_parts)
            sf.write(str(out_path), merged, sample_rate)
            wavs.append(out_path)
            if (idx + 1) % 10 == 0 or idx + 1 == len(chunks):
                log(f"      TTS chunks {idx + 1}/{len(chunks)}")
        concat_wavs(wavs, wav_out)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def encode_mp3(wav_in: Path, mp3_out: Path, bitrate_kbps: int) -> None:
    if not command_exists("ffmpeg"):
        raise RuntimeError("ffmpeg not found in PATH")
    mp3_out.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_in),
        "-ac", "1", "-ar", "16000", "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
        "-c:a", "libmp3lame", "-b:a", f"{bitrate_kbps}k", str(mp3_out),
    ])


def duration_seconds(path: Path) -> float | None:
    if not command_exists("ffprobe"):
        return None
    proc = run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], check=False)
    try:
        return float(proc.stdout.strip())
    except Exception:
        return None


def load_manifest(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    books = data.get("books") if isinstance(data, dict) else data
    if not isinstance(books, list):
        raise ValueError("Manifest must be an object with a 'books' array, or a JSON array")
    return [b for b in books if isinstance(b, dict) and b.get("id")]


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "books": {}}
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(obj, dict):
            raise ValueError
        obj.setdefault("books", {})
        return obj
    except Exception:
        return {"version": 1, "books": {}}


def save_state(path: Path, state: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def process_book(book: dict[str, Any], args: argparse.Namespace, output_dir: Path, state: dict[str, Any]) -> None:
    book_id = str(book["id"])
    title = str(book.get("title") or book_id)
    language = str(book.get("language") or "en")
    target_words = int(args.target_minutes * args.words_per_minute)
    mp3_path = output_dir / "mp3" / f"{book_id}.mp3"
    script_path = output_dir / "scripts" / f"{book_id}.txt"
    wav_path = output_dir / "wav" / f"{book_id}.wav"

    if args.resume and mp3_path.exists() and state.get("books", {}).get(book_id, {}).get("status") == "done":
        log(f"[skip] {title}")
        return

    log(f"[book] {title} ({language})")
    source = build_source(book)
    minimum_source_words = min(350, max(80, target_words // 2))
    if word_count(source) < minimum_source_words:
        raise RuntimeError(f"Not enough source content to build a reliable audio summary ({word_count(source)} words)")

    mode_used = args.mode
    if args.mode == "quality":
        try:
            log(f"      rewriting locally with Ollama {args.ollama_model} …")
            script = ollama_script(book, target_words, args.ollama_model)
        except Exception as exc:
            if args.strict_quality:
                raise
            log(f"      quality mode unavailable ({exc}); using fast extractive mode")
            script = fast_script(book, target_words)
            mode_used = "fast-fallback"
    else:
        script = fast_script(book, target_words)

    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(script, encoding="utf-8")
    log(f"      script: {word_count(script)} words")

    if args.script_only:
        state["books"][book_id] = {
            "status": "scripted", "title": title, "mode": mode_used,
            "words": word_count(script), "script": str(script_path.relative_to(output_dir)), "updated_at": time.time(),
        }
        return

    wav_path.parent.mkdir(parents=True, exist_ok=True)
    log("      generating local speech …")
    tts_indicvoice(script, language, wav_path, output_dir / ".cache", args.tts_repo)
    encode_mp3(wav_path, mp3_path, args.bitrate)
    dur = duration_seconds(mp3_path)
    size = mp3_path.stat().st_size
    if not args.keep_wav:
        wav_path.unlink(missing_ok=True)
    duration_min = (dur / 60.0) if dur else None
    log(f"      done: {mp3_path.name} · {size / 1024 / 1024:.2f} MB" + (f" · {duration_min:.1f} min" if duration_min else ""))

    state["books"][book_id] = {
        "status": "done", "title": title, "language": language, "mode": mode_used,
        "words": word_count(script), "duration_seconds": dur, "bytes": size,
        "file": str(mp3_path.relative_to(output_dir)), "script": str(script_path.relative_to(output_dir)),
        "updated_at": time.time(),
    }


def write_upload_manifest(output_dir: Path, state: dict[str, Any]) -> None:
    rows = []
    for book_id, item in state.get("books", {}).items():
        if item.get("status") == "done":
            rows.append({
                "book_id": book_id,
                "filename": f"{book_id}.mp3",
                "duration_seconds": item.get("duration_seconds"),
                "bytes": item.get("bytes"),
            })
    (output_dir / "upload-manifest.json").write_text(
        json.dumps({"version": 1, "generated_at": time.time(), "files": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate Booknomics book-summary MP3s locally")
    p.add_argument("--manifest", default="booknomics-audio-manifest.json", help="JSON manifest exported by Admin")
    p.add_argument("--output", default="audio-out", help="Output directory")
    p.add_argument("--mode", choices=["quality", "fast"], default="quality", help="quality=local Ollama rewrite; fast=no LLM")
    p.add_argument("--ollama-model", default=DEFAULT_MODEL)
    p.add_argument("--strict-quality", action="store_true", help="Fail instead of falling back when Ollama fails")
    p.add_argument("--tts-repo", default=DEFAULT_REPO)
    p.add_argument("--target-minutes", type=float, default=20.0)
    p.add_argument("--words-per-minute", type=int, default=128)
    p.add_argument("--bitrate", type=int, choices=[16, 24, 32, 40, 48, 64], default=16)
    p.add_argument("--limit", type=int, default=0, help="Process at most N books (0 = all)")
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--book-id", action="append", default=[], help="Process only this book ID (repeatable)")
    p.add_argument("--resume", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--script-only", action="store_true", help="Create narration scripts but skip TTS/MP3")
    p.add_argument("--keep-wav", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    manifest = Path(args.manifest)
    output_dir = Path(args.output)
    if not manifest.exists():
        log(f"Manifest not found: {manifest}")
        return 2
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "mp3").mkdir(exist_ok=True)
    (output_dir / "scripts").mkdir(exist_ok=True)
    state_path = output_dir / "state.json"
    state = load_state(state_path)
    state.setdefault("books", {})

    books = load_manifest(manifest)
    if args.book_id:
        wanted = set(args.book_id)
        books = [b for b in books if str(b.get("id")) in wanted]
    else:
        books = books[args.offset:]
        if args.limit > 0:
            books = books[:args.limit]

    if not books:
        log("No books selected")
        return 0
    if not args.script_only and not command_exists("ffmpeg"):
        log("ERROR: ffmpeg is required and was not found in PATH")
        return 2
    if args.mode == "quality" and not command_exists("ollama"):
        log("NOTE: Ollama is not installed; quality mode will use the built-in fast fallback.")

    log(f"Selected {len(books)} book(s). Target ≈ {args.target_minutes:g} min, {int(args.target_minutes * args.words_per_minute)} words, {args.bitrate} kbps MP3.")
    failures = 0
    for index, book in enumerate(books, 1):
        log(f"\n[{index}/{len(books)}]")
        book_id = str(book.get("id"))
        try:
            process_book(book, args, output_dir, state)
        except KeyboardInterrupt:
            save_state(state_path, state)
            write_upload_manifest(output_dir, state)
            log("\nStopped safely. Re-run the same command to resume.")
            return 130
        except Exception as exc:
            failures += 1
            log(f"      FAILED: {exc}")
            state["books"][book_id] = {
                "status": "failed", "title": str(book.get("title") or book_id),
                "error": str(exc), "updated_at": time.time(),
            }
        finally:
            save_state(state_path, state)
            write_upload_manifest(output_dir, state)

    done = sum(1 for x in state["books"].values() if x.get("status") == "done")
    scripted = sum(1 for x in state["books"].values() if x.get("status") == "scripted")
    log(f"\nFinished. done={done}, scripted={scripted}, failures_this_run={failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
