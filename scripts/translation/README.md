# Booknomics offline English → Hindi batch runner

This is an **automatic 500-book draft generator**, not an automatic publisher.
It follows the repository's `001–007` English cohorts and never alters English
books or activates the language toggle. It performs **no translation API calls**:
all translation inference runs locally using a downloaded model.

## Model and license

- Model: [Helsinki-NLP/opus-mt-en-hi](https://huggingface.co/Helsinki-NLP/opus-mt-en-hi), Apache-2.0.
- Local Marian machine translation; the model is downloaded once from Hugging Face.
- Importantly, the model has limited English→Hindi accuracy on its published
  benchmarks. It cannot guarantee natural, faithful literary translations.
  **Every generated book is unapproved until human editorial review.**
- Do **not** replace this with NLLB-200-distilled-600M for a commercial website:
  that model is licensed CC-BY-NC and says it is not released for production.

## Security and permissions

Provide Supabase credentials to a private execution environment or GitHub
Actions secrets, never into Git or a chat message:

- `SUPABASE_URL`, e.g. `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` (Actions), or `SUPABASE_SERVER_KEY` (local environment).

The runner uses Supabase **only to read** the exact published English book IDs in
the cohort manifest. A locally saved JSONL source snapshot may be used instead.
It never writes Supabase or Cloudflare data, and it never uses a hosted AI model.
The model download itself is network access; all **translation** is offline.

## Local setup

Use Python 3.11 with enough disk, memory, CPU/GPU time. On the user's 8 GB
Windows laptop, a 500-book full run may take a long time; no speed promise is made.
CPU installation example:

```bash
python -m venv .venv
python -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r scripts/translation/requirements-offline.txt
hf download Helsinki-NLP/opus-mt-en-hi --local-dir .models/opus-mt-en-hi
```

Start with a read-only check and **five-book pilot**:

```bash
python scripts/booknomics_en_hi_batch.py \
  --manifest content/translations/batches/en-hi-batch-001-20261022.csv \
  --out-dir output/en-hi-batch-001 --pending-only --limit 5 --dry-run

python scripts/booknomics_en_hi_batch.py \
  --manifest content/translations/batches/en-hi-batch-001-20261022.csv \
  --out-dir output/en-hi-batch-001 --pending-only --limit 5
```

Then, **only after measuring pilot quality and runtime**, process an entire
500-book cohort (or run the optional 20-shard GitHub workflow):

```bash
python scripts/booknomics_en_hi_batch.py \
  --manifest content/translations/batches/en-hi-batch-001-20261022.csv \
  --out-dir output/en-hi-batch-001 --limit 500
```

Run again with the same arguments to resume after an interruption. Drafts are
saved per book and even per completed section. The runner skips any book already
represented in `content/translations/drafts/`, including manually authored
partial drafts, so a machine cannot overwrite the assistant's reviewed work.
It flags stale Supabase source lengths/IDs, generic placeholder headings,
missing sections, suspiciously short text, insufficient Devanagari, and changed
Markdown heading/list counts. A failure is reported rather than auto-published.

## One-click GitHub batch

Once the workflow is on the repository's **default branch** and the two secrets
are configured, open **Actions → Booknomics offline English to Hindi draft batch → Run workflow**.
Select cohort `001` and `pilot-5` first. After quality/time review,
choose `full-500`: twenty shards of 25 books execute with max three concurrent
jobs. The final cohort `007` has 459 books. Outputs are downloadable GitHub
Actions artifacts, **not** automatic commits or deployments. GitHub Actions
minutes, artifact storage, model downloads, and compute may have cost/limits;
we have **not** run these jobs or measured cost/runtime.

## Publishing gate (mandatory)

1. Review each book's translation side-by-side with all its exact English fields.
   Check names, themes, character/author references, numbers, headings, nuance,
   natural Hindi, and source-content quality. Repair generic English sections
   before their Hindi variants are approved.
2. Never set `approved: true` just because structural QA passes.
3. Verify the **current Cloudflare D1** English source hash (Supabase snapshots
   may be stale), then create separate free/premium approved inputs for the
   existing `scripts/prepare-reviewed-translation.mjs` importer.
4. Import in controlled, idempotent D1 batches and read back saved values.
5. Deploy and test EN → HI → EN on the actual book page, including logged-in
   premium content, before saying the toggle works.

Generated file status is always `offline_machine_draft_needs_editorial_review`
or `offline_machine_draft_needs_rework` and `approved: false`.

## Developer tests

```bash
python -m unittest discover -s scripts/tests -p 'test_booknomics_en_hi_batch.py' -v
```
