# Booknomics Local Audio Engine

Generates long-form book-summary audio **without a paid AI or TTS API**.

The pipeline is:

1. Booknomics Admin exports the existing book summaries/analysis to a JSON manifest.
2. `generate_audio.py` turns each book into a narration script.
   - `quality` mode uses **local Ollama** (`qwen3.5:4b` by default).
   - `fast` mode uses the existing Booknomics text directly and needs no LLM.
3. **IndicVoice-82M** generates English/Hindi speech locally.
4. FFmpeg normalizes and compresses the result to `<book-id>.mp3`.
5. Admin can either upload MP3s to the existing `book-assets` bucket or import URLs from external object storage.
6. The existing Booknomics `book_assets.audio_url` + audio player does the rest.

## Why this fits Booknomics

- No OpenAI/ElevenLabs/Google TTS key.
- No per-character or per-minute generation bill.
- Resume-safe: `audio-out/state.json` records every completed book.
- Stable mapping: output filename is the exact Booknomics UUID, so files cannot be attached to the wrong title by fuzzy matching.
- English and Hindi supported from one local TTS model.
- Existing site audio UI remains unchanged.

## Windows setup

Open PowerShell in this folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install_windows.ps1
```

If FFmpeg is missing, install it:

```powershell
winget install --id Gyan.FFmpeg -e
```

Then close and reopen PowerShell so `ffmpeg` is in PATH.

The first TTS run downloads the public model weights; after that, inference is local.

## Generate a 5-book test first

Export `booknomics-audio-manifest.json` from the Booknomics Admin audio-batch screen, then run:

```powershell
python generate_audio.py --manifest booknomics-audio-manifest.json --limit 5
```

Outputs:

```text
audio-out/
  mp3/<book-uuid>.mp3
  scripts/<book-uuid>.txt
  state.json
  upload-manifest.json
```

## Run all remaining books

```powershell
python generate_audio.py --manifest booknomics-audio-manifest.json --resume
```

If the command is interrupted, run it again. Completed books are skipped.

### Fast mode: no local LLM

```powershell
python generate_audio.py --manifest booknomics-audio-manifest.json --mode fast --resume
```

### Better narration quality: local LLM

```powershell
ollama pull qwen3.5:4b
python generate_audio.py --manifest booknomics-audio-manifest.json --mode quality --resume
```

`quality` mode never sends the book text to a hosted AI API: the Ollama model runs on the user's own computer. If Ollama is missing or fails, the engine falls back to `fast` mode unless `--strict-quality` is used.

## Duration and size

Default target:

- 20 minutes
- 128 narration words/minute
- about 2,560 words/book
- mono 16 kbps MP3

At 16 kbps, 20 minutes is about **2.4 MB per book**. Roughly 3,061 books is about **7.35 GB** before small container/metadata overhead. Use `--bitrate 24` for better audio if you have more storage; that is about 3.6 MB/book.

## Storage: do not put all 3,061 files in a 1 GB plan

For a small test batch, upload directly through Booknomics Admin to the existing Supabase `book-assets` bucket.

For the full library, use an object store with enough free space and import URLs into Booknomics. `upload_s3.py` works with S3-compatible providers such as Cloudflare R2 and Backblaze B2.

Install the optional uploader:

```powershell
python -m pip install boto3
```

Set provider credentials only in your local PowerShell session (never commit them):

```powershell
$env:S3_ENDPOINT_URL="https://..."
$env:S3_ACCESS_KEY_ID="..."
$env:S3_SECRET_ACCESS_KEY="..."
$env:S3_BUCKET="booknomics-audio"
$env:S3_PUBLIC_BASE_URL="https://your-public-audio-domain.example"
$env:S3_REGION="auto"
```

Upload and create the URL manifest:

```powershell
python upload_s3.py --input audio-out/mp3 --manifest booknomics-audio-urls.json
```

Then open Booknomics Admin → Publishing Wizard → **Audio Batch** and import `booknomics-audio-urls.json`. Only the URLs are stored in Supabase; the audio bytes stay in the object store.

## Important quality rule

The engine is intentionally grounded in the content already stored for each Booknomics book. It does **not** fabricate a 20-minute story from title/author metadata. Books with too little source material are marked `failed` in `state.json` for manual review.

## Voice/model licensing

The default `Bindkushal/IndicVoice-82M` model is published under Apache-2.0 and supports Hindi and English. If you replace it with another voice/model, review that model's own license before commercial use.
