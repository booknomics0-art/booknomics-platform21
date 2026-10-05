# Booknomics Audio Summary Worker

Generates long-form Booknomics audiobook summaries without ElevenLabs or another paid TTS API.

## What it does

- Pulls work from `audio_summary_jobs` in Supabase.
- Uses the existing Booknomics `deep_analysis` / `deep_summary` as the narration source.
- Cleans Markdown and web formatting into spoken text.
- Generates speech locally with Kokoro.
- Targets about 20 minutes per book and performs one duration-correction pass when needed.
- Normalizes loudness and encodes a 96 kbps mono MP3.
- Uploads the MP3 to the existing public `book-assets` bucket.
- Updates `book_assets.audio_url` only after a successful upload.
- Retries failed work and recovers stale jobs after a worker crash.
- Processes at most 100 books per queued batch.

## Why local TTS

The catalog is large enough that a hosted TTS API would create an ongoing usage bill. Kokoro runs on your own machine, so there is no per-character or per-audio-minute API fee. Model files are downloaded on first use and then cached locally.

## One-time setup

Python 3.11 or 3.12 is recommended.

```powershell
cd tools\audio-worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Kokoro benefits from `espeak-ng` for out-of-dictionary words. Install eSpeak NG and make sure `espeak-ng` is on PATH. The worker bundles access to an ffmpeg binary through `imageio-ffmpeg`, so a separate ffmpeg install is not required.

Set the two secrets only in the local shell or a private secrets manager; never commit the service-role key:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

Optional voice/config controls:

```powershell
$env:AUDIO_BATCH_SIZE="100"
$env:AUDIO_TARGET_MINUTES="20"
$env:KOKORO_EN_VOICE="am_michael"
$env:KOKORO_HI_VOICE="hm_omega"
```

## Run the first 100 English books

```powershell
python worker.py --language en --batch-size 100
```

The first 100-book English batch may already have been queued in Supabase. The worker will consume that queue first and only enqueue a new batch when there is no queued work.

## Keep processing subsequent 100-book batches automatically

```powershell
python worker.py --language en --batch-size 100 --continuous
```

Stop with `Ctrl+C`. Restarting the same command is safe; completed books are not regenerated and stale in-progress work is recovered.

For an initial smoke test before a long run:

```powershell
python worker.py --language en --batch-size 100 --max-books 2
```

## Hindi later

The same worker supports `--language hi`. Do not switch the production queue to Hindi until a small Hindi voice QA sample has been approved; English is the first production phase.

## Quality gates

A job is rejected instead of uploaded when the cleaned source falls below 1,800 words or above 3,600 words. The production English catalog currently sits close to the 20-minute target, so most books should not need LLM rewriting. Existing audio URLs are never overwritten by batch selection.

## Security

`audio_summary_jobs` has RLS enabled and no browser/client policies. Queue RPCs are executable only by the Supabase `service_role`. The service-role key must remain server-side/local-only.
