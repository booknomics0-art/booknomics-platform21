from __future__ import annotations

import argparse
import json
import os
import re
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import imageio_ffmpeg
import numpy as np
import requests
import soundfile as sf
from kokoro import KPipeline


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = os.environ.get("AUDIO_BUCKET", "book-assets")
TARGET_MINUTES = float(os.environ.get("AUDIO_TARGET_MINUTES", "20"))
DEFAULT_LANGUAGE = os.environ.get("AUDIO_LANGUAGE", "en").lower()
DEFAULT_BATCH_SIZE = int(os.environ.get("AUDIO_BATCH_SIZE", "100"))
EN_VOICE = os.environ.get("KOKORO_EN_VOICE", "am_michael")
HI_VOICE = os.environ.get("KOKORO_HI_VOICE", "hm_omega")
WORKER_ID = os.environ.get("AUDIO_WORKER_ID", f"{socket.gethostname()}-{os.getpid()}")


def require_env() -> None:
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise RuntimeError("Missing required environment variables: " + ", ".join(missing))


def headers(content_type: str = "application/json") -> dict[str, str]:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": content_type,
    }


def rpc(name: str, payload: dict[str, Any]) -> Any:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        headers=headers(),
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    if not response.content:
        return None
    try:
        return response.json()
    except requests.JSONDecodeError:
        return response.text


def clean_spoken_text(raw: str, title: str, author: str) -> str:
    text = raw or ""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"[*_`~]", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.M)
    text = re.sub(r"^\s*\d+[.)]\s+", "", text, flags=re.M)
    text = text.replace("&nbsp;", " ").replace("&amp;", "and")

    paragraphs: list[str] = []
    seen: set[str] = set()
    for block in re.split(r"\n\s*\n|\r\n\s*\r\n", text):
        block = re.sub(r"\s+", " ", block).strip()
        if len(block) < 25:
            continue
        key = re.sub(r"[^a-z0-9]+", "", block.lower())[:240]
        if key and key not in seen:
            seen.add(key)
            paragraphs.append(block)

    body = "\n\n".join(paragraphs)
    intro = (
        f"You're listening to the Booknomics audio summary of {title}, by {author}. "
        f"This concise narration focuses on the book's central ideas, major developments, "
        f"important themes, and practical takeaways.\n\n"
    )
    outro = (
        "\n\nThat concludes this Booknomics audio summary. "
        "Use the ideas that matter to you, revisit the written summary for deeper detail, "
        "and keep reading, applying, and transforming."
    )
    return intro + body + outro


def word_count(text: str) -> int:
    return len(re.findall(r"\b[\w’'-]+\b", text, flags=re.UNICODE))


def split_for_tts(text: str, max_chars: int = 1400) -> str:
    chunks: list[str] = []
    for paragraph in re.split(r"\n+", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        while len(paragraph) > max_chars:
            cut = paragraph.rfind(". ", 0, max_chars)
            if cut < max_chars // 2:
                cut = paragraph.rfind(", ", 0, max_chars)
            if cut < max_chars // 2:
                cut = paragraph.rfind(" ", 0, max_chars)
            if cut < 100:
                cut = max_chars
            chunks.append(paragraph[: cut + 1].strip())
            paragraph = paragraph[cut + 1 :].strip()
        if paragraph:
            chunks.append(paragraph)
    return "\n".join(chunks)


def choose_voice(language: str) -> tuple[str, str]:
    if language == "hi":
        return "h", HI_VOICE
    return "a", EN_VOICE


def predicted_speed(words: int) -> float:
    # Kokoro at speed=1 is close to normal audiobook narration. 145 WPM is
    # deliberately calm; the clamp prevents unnatural delivery.
    desired_wpm = max(1.0, words / TARGET_MINUTES)
    return round(max(0.90, min(1.16, desired_wpm / 145.0)), 3)


def render_wav(pipeline: KPipeline, text: str, voice: str, speed: float, out_path: Path) -> float:
    prepared = split_for_tts(text)
    frames = 0
    sample_rate = 24000
    with sf.SoundFile(out_path, mode="w", samplerate=sample_rate, channels=1, subtype="PCM_16") as wav:
        generator = pipeline(prepared, voice=voice, speed=speed, split_pattern=r"\n+")
        for _graphemes, _phonemes, audio in generator:
            if hasattr(audio, "detach"):
                audio = audio.detach().cpu().numpy()
            samples = np.asarray(audio, dtype=np.float32).reshape(-1)
            if samples.size == 0:
                continue
            wav.write(samples)
            frames += samples.size
            # Natural pause between generated chunks.
            pause = np.zeros(int(sample_rate * 0.18), dtype=np.float32)
            wav.write(pause)
            frames += pause.size
    if frames == 0:
        raise RuntimeError("Kokoro returned no audio frames")
    return frames / sample_rate


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(wav_path),
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-ac",
        "1",
        "-ar",
        "48000",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "96k",
        str(mp3_path),
    ]
    subprocess.run(cmd, check=True)


def upload_mp3(book_id: str, slug: str, language: str, mp3_path: Path) -> str:
    safe_slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", slug).strip("-")[:120]
    object_path = f"audio-summaries/{language}/{book_id}/{safe_slug}.mp3"
    encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
    with mp3_path.open("rb") as handle:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{encoded_path}",
            headers={**headers("audio/mpeg"), "x-upsert": "true", "cache-control": "3600"},
            data=handle,
            timeout=300,
        )
    response.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{encoded_path}"


def enqueue(language: str, batch_size: int) -> tuple[str | None, int]:
    result = rpc("enqueue_audio_summary_batch", {"p_language": language, "p_limit": batch_size})
    if not result:
        return None, 0
    row = result[0] if isinstance(result, list) else result
    return row.get("batch_id"), int(row.get("queued_count", 0))


def claim(language: str) -> dict[str, Any] | None:
    result = rpc("claim_audio_summary_job", {"p_worker_id": WORKER_ID, "p_language": language})
    if not result:
        return None
    return result[0]


def complete(job: dict[str, Any], audio_url: str, duration: float, words: int, voice: str, speed: float) -> None:
    rpc(
        "complete_audio_summary_job",
        {
            "p_job_id": job["job_id"],
            "p_audio_url": audio_url,
            "p_duration_seconds": round(duration, 2),
            "p_script_words": words,
            "p_source_field": job.get("source_field") or "deep_analysis",
            "p_tts_metadata": {
                "engine": "kokoro",
                "voice": voice,
                "speed": speed,
                "target_minutes": TARGET_MINUTES,
                "worker": WORKER_ID,
                "format": "mp3-96k-mono",
            },
        },
    )


def fail(job_id: str, exc: Exception) -> None:
    try:
        rpc("fail_audio_summary_job", {"p_job_id": job_id, "p_error": f"{type(exc).__name__}: {exc}"})
    except Exception as report_error:
        print(f"Could not report job failure: {report_error}")


def process_one(pipeline: KPipeline, job: dict[str, Any]) -> None:
    source = job.get("source_text") or ""
    narration = clean_spoken_text(source, job["title"], job["author"])
    words = word_count(narration)
    if words < 1800:
        raise RuntimeError(f"Source is too short after cleanup ({words} words)")
    if words > 3600:
        raise RuntimeError(f"Source is unexpectedly long after cleanup ({words} words); manual QA required")

    _lang_code, voice = choose_voice(job["language"])
    speed = predicted_speed(words)

    with tempfile.TemporaryDirectory(prefix="booknomics-audio-") as temp_dir:
        temp = Path(temp_dir)
        wav_path = temp / "summary.wav"
        mp3_path = temp / "summary.mp3"
        duration = render_wav(pipeline, narration, voice, speed, wav_path)

        # One duration-correction pass if the model's actual cadence is far from target.
        lower = TARGET_MINUTES * 60 * 0.86
        upper = TARGET_MINUTES * 60 * 1.14
        if duration < lower or duration > upper:
            corrected = max(0.86, min(1.22, speed * (duration / (TARGET_MINUTES * 60))))
            corrected = round(corrected, 3)
            if abs(corrected - speed) >= 0.03:
                speed = corrected
                duration = render_wav(pipeline, narration, voice, speed, wav_path)

        encode_mp3(wav_path, mp3_path)
        audio_url = upload_mp3(job["book_id"], job["slug"], job["language"], mp3_path)
        complete(job, audio_url, duration, words, voice, speed)

    print(
        json.dumps(
            {
                "status": "completed",
                "book": job["title"],
                "book_id": job["book_id"],
                "words": words,
                "minutes": round(duration / 60, 2),
                "voice": voice,
                "speed": speed,
                "audio_url": audio_url,
            },
            ensure_ascii=False,
        )
    )


def run(language: str, batch_size: int, continuous: bool, max_books: int | None) -> None:
    require_env()
    if language not in {"en", "hi"}:
        raise ValueError("language must be en or hi")
    if not 1 <= batch_size <= 100:
        raise ValueError("batch size must be 1..100")

    # Recover work left behind by an interrupted prior run.
    rpc("requeue_stale_audio_summary_jobs", {})

    lang_code, voice = choose_voice(language)
    print(f"Loading Kokoro: language={language}, voice={voice}, worker={WORKER_ID}")
    pipeline = KPipeline(lang_code=lang_code)

    processed = 0
    while True:
        job = claim(language)
        if job is None:
            batch_id, queued = enqueue(language, batch_size)
            if queued == 0:
                print("No eligible books remain for this language.")
                return
            print(f"Queued batch {batch_id}: {queued} books")
            job = claim(language)
            if job is None:
                time.sleep(2)
                continue

        try:
            print(f"Starting: {job['title']} — {job['author']}")
            process_one(pipeline, job)
            processed += 1
        except KeyboardInterrupt:
            fail(job["job_id"], RuntimeError("Worker stopped by user"))
            raise
        except Exception as exc:
            print(f"FAILED {job.get('title')}: {exc}")
            fail(job["job_id"], exc)

        if max_books is not None and processed >= max_books:
            print(f"Reached run limit: {max_books} completed books")
            return

        if not continuous:
            # In one-batch mode, stop after the currently queued batch is drained.
            remaining = requests.get(
                f"{SUPABASE_URL}/rest/v1/audio_summary_jobs",
                headers={**headers(), "Prefer": "count=exact"},
                params={"select": "id", "status": "eq.queued", "language": f"eq.{language}", "limit": "1"},
                timeout=30,
            )
            remaining.raise_for_status()
            if not remaining.json():
                print("Current batch finished.")
                return


def main() -> None:
    parser = argparse.ArgumentParser(description="Booknomics local audiobook-summary worker")
    parser.add_argument("--language", choices=["en", "hi"], default=DEFAULT_LANGUAGE)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--continuous",
        action="store_true",
        help="Automatically enqueue the next batch when the current 100-book batch is finished.",
    )
    parser.add_argument("--max-books", type=int, default=None, help="Optional safety cap for this run")
    args = parser.parse_args()
    run(args.language, args.batch_size, args.continuous, args.max_books)


if __name__ == "__main__":
    main()
