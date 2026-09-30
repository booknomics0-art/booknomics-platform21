# Book Factory: English summaries to Supabase

Pipeline for producing 3,200+ word book summaries and loading them into Supabase
**as drafts**. Everything lives in `scripts/bookfactory/`.

```
catalog.csv ──► generate.cjs ──► check.cjs ──► upload.cjs (--sql or API) ──► admin spot-check ──► publish in waves
  (titles)     (LLM, 7 stages)   (quality gate)   (is_draft = true)                                (is_draft = false)
```

## What is already done

- `content-drafts/en/` holds 10 finished books (3,368–3,699 words each), all passing the gate.
- `content-drafts/en/_sql/english-top10-books.sql` is a paste-ready, idempotent SQL file for those 10.
  Everything is inserted with `is_draft = true`, so nothing goes public by accident.
- Format is accepted by the Admin bulk importer (`parseBulkBooks`: 10 books, 0 errors) but use `upload.cjs` or the
  SQL instead: the Admin parser adds a random 4-char suffix to slugs and ignores the `Slug:` header.

## Load the first 10 (no keys needed)

1. Supabase dashboard → SQL Editor → paste `content-drafts/en/_sql/english-top10-books.sql` → Run.
2. Open the Admin UI and read 2–3 books on the real page layout.
3. Publish: `update books set is_draft = false where language = 'en' and status = 'done';`

The SQL was tested on a local Postgres-compatible engine against a minimal mirror of the schema (idempotent,
10 rows, all assets present). It was **not** run on your live project, so run step 1 once and check the row count.

## Scale to 2,000 books

Needs your own keys, because the LLM call and the DB write must happen from a machine that has network access.

```bash
export LLM_PROVIDER=gemini            # gemini | anthropic | openai | mock
export GEMINI_API_KEY=...             # or ANTHROPIC_API_KEY / OPENAI_API_KEY
# optional: LLM_MODEL=..., LLM_BASE_URL=...   (default model ids are unverified; check the provider docs)

node scripts/bookfactory/generate.cjs --limit 10 --concurrency 2     # pilot: always do this first
node scripts/bookfactory/check.cjs content-drafts/en                 # re-validate
node scripts/bookfactory/generate.cjs --limit 50 --concurrency 4     # a "batch of 50"
node scripts/bookfactory/generate.cjs --genre Finance --limit 50     # one genre at a time
node scripts/bookfactory/generate.cjs --expand-catalog 100 --genre History   # ask the LLM for more titles
node scripts/bookfactory/generate.cjs --lang hi --limit 50           # Hindi (path untested with a real LLM)
```

It resumes from `<out>/_state.json`, so re-running after a crash or rate-limit skips finished books.

What each book goes through:

1. Fact sheet (the model lists what it is sure about; it is told to say "unknown" instead of guessing).
2. Section-by-section writing with the genre's own style from `genres.json` (14 genres, each with a different
   opening, summary shape, insights style, action style and audio style).
3. Automatic expansion loop if a section is under its minimum words.
4. Quiz and flashcards as JSON.
5. `validate()`: per-section minimums, ≥ 3,200 total words, rubric score ≥ 98, AI-cliché and em-dash limits,
   near-duplicate detection against the other books.
6. Up to 3 repair rounds for anything that fails.
7. Reviewer pass: a second LLM call that attacks the draft for factual risks and generic filler.

Routing: passing books → `<out>/<slug>.txt`. Failing or flagged books → `<out>/_rejected/` (with the reason in
`_reports/`). `upload.cjs` only reads the main folder, so a rejected book cannot reach the database.

Then load:

```bash
# Option A: SQL file (no key on your machine; paste into the SQL Editor)
node scripts/bookfactory/upload.cjs content-drafts/en --sql content-drafts/en/_sql/batch.sql

# Option B: direct upsert (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; never commit the key)
SUPABASE_URL=https://pbkfewrtdgiagytmcigb.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/bookfactory/upload.cjs content-drafts/en
node scripts/bookfactory/upload.cjs content-drafts/en --dry-run      # validate only
```

Both options upsert on `slug`, so they can be re-run. Only `--publish` flips books live, and you should not use
it for a full catalog.

## Cost and time (rough; verify current prices before a big run)

Per book: about 8k output tokens and 25k input tokens, including fact sheet, expansions, repairs and review.
For 2,000 books that is about 16M output and 50M input tokens:

| Model class | Approximate total |
|---|---|
| Flash/mini-class (Gemini Flash, GPT-mini) | tens of dollars up to about $100 |
| Premium (Claude Sonnet / GPT-4.1 class) | several hundred dollars |

Wall-clock at concurrency 4–8 is roughly 1–2 days, rate limits permitting. These are estimates, not measurements:
run the 10-book pilot, read the token bill, and multiply by 200.

## Publishing plan (this matters more than generation)

- **Never publish 2,000 at once.** Search engines treat a sudden mass of similar pages as scaled content. Release in
  waves (for example 20–50 a day) and watch Search Console indexing before the next wave.
- `scripts/generate-sitemap.ts` refuses to write a sitemap with fewer than `SITEMAP_MIN_BOOKS` (default 50) published
  books, which protects you from shipping a near-empty sitemap.
- Publish by genre or by popularity, most-searched titles first.
- Human spot-check at least 5% of every batch (a minimum of 3 books) before flipping its `is_draft`.

## Known limits (read before trusting the numbers)

- **The "98" is a rubric score**, produced by our own checker (structure, length, clichés, duplication). It does not
  verify facts. Factual accuracy is only as good as the model plus the reviewer pass. Obscure titles are where models
  invent details, so prefer well-known books and review everything else by hand.
- The 10 shipped books were written from general knowledge; two headline statistics (Thiel's airline and Google margins,
  Housel's Read/Fuscone story) were cross-checked on the web. Nothing else was independently verified. Skim the
  dates and numbers before publishing.
- `catalog.csv` has 112 titles. `--expand-catalog` asks the LLM for more, and models often get years wrong. Review the
  list before queueing it.
- `generate.cjs` does not flip catalog rows to `done`; `_state.json` tracks progress. `--provider/--model/--dry` flags do
  not exist (use env vars).
- Real-provider adapters were tested only against local stub servers, never against live APIs.
- Ratings: the DB default for `books.rating` is 4.5 and the old upload script wrote 4.8. These are invented numbers.
  `upload.cjs` sets none. Consider removing the default and any `aggregateRating` markup that depends on it.

## Audit of the existing 450 Hindi drafts

- Word counts (Devanagari-aware count): min 68, median 235, mean 259, max 675. None reach 2,500, let alone 3,200,
  although an earlier commit message claims 2,500+. Most came from templates and are repetitive.
- `scripts/generate-supabase-upload.cjs` should not be used as is: it hardcodes `language = 'hi'`, leaves
  `action_system` empty, truncates the overview, writes a rating of 4.8 and uses cover colors that mostly are not
  defined in `src/index.css`.
- To rebuild them properly: `generate.cjs --lang hi` with the same gate. Do a pilot of 5 and have a native reader judge
  it before running 450.
