# 📚 2000-Book Program — Strategy, Pipeline & Guardrails

Goal: 2000 book summaries at flagship quality (3200+ words each), uploaded to
Supabase, without hundreds of manual chat turns.

## The honest math (read first)

2000 books × ~3,500 words = **~7,000,000 words**. Hand-writing that in chat =
200+ sessions — not viable. Template-generation = instant but repetitive —
that's how the current 450 Hindi books ended up uniform (~2,500 words), and
mass template content is exactly what search engines demote. So:

**The viable system = LLM batch generation + hard quality gate + staged upload.**
The repo already uses Gemini (edge functions), so the pipeline plugs into the
same key. Estimated API cost for all 2000: roughly **₹500–2,000** (Gemini
Flash-class pricing; check current rates). Runs overnight or on a schedule.

## The pipeline (zero chat turns needed after setup)

```
data/books-master-list.json      ← the queue (real books only, seeded ~200)
        │
        ▼
scripts/batch-generate-books.cjs ← per-book LLM generation, genre-specific
        │                          prompts, auto-retry if short, resumable
        ▼
scripts/verify-library.cjs       ← HARD gate: ≥3200 words, genre structure,
        │                          KEY_IDEAS/HOW_TO_READ/REFLECTION, no
        │                          cross-book duplication, no placeholders
        ▼
scripts/upload-library.cjs       ← chunked Supabase upsert + read-back verify
                                   (is_draft=false, status='published')
```

### Two ways to run it

**A. On your machine (fastest to start)**
1. Get a free API key: https://aistudio.google.com → "Get API key"
2. Add to `.env`: `GEMINI_API_KEY=...` (never commit)
3. `node scripts/batch-generate-books.cjs --engine=gemini --limit=50 --tier=1`
4. `node scripts/verify-library.cjs`
5. `node scripts/upload-library.cjs --limit=50`

**B. GitHub Actions (fully hands-free)**
1. Repo → Settings → Secrets → add `GEMINI_API_KEY`
2. Run the "Batch generate book summaries" workflow (or wait for the daily
   06:30 IST schedule)
3. Each run generates 25 verified drafts and commits them. Upload when you
   want: `node scripts/upload-library.cjs`
4. At 25 books/run/day → 2000 books in ~80 days. Raise `--limit` to 100 to
   finish in ~3 weeks (watch API quotas).

## Quality = 98%+ (how the gate enforces your requirement)

- Word count: hard floor 3200 words (strict counter), auto-retry with
  expansion instruction if a generation comes back short.
- Genre structure: 13 genres each with their own required section skeleton
  (`scripts/library-genres.json`) — the same "different summary per genre"
  rule as the flagship 10.
- Originality: 12-word shingle check across the whole library; duplicates fail.
- Meta completeness: tagline, KEY_IDEAS bullets, HOW_TO_READ, 4 REFLECTION
  questions, front-matter fields.
- Model temperature 0.8 + per-book prompts (title/author/year/genre injected)
  so no two books read alike.

## SEO / product guardrails (do not skip)

1. **Publish in waves, not all at once.** 50–100 books per week. The build's
   sitemap gate (`SITEMAP_MIN_BOOKS`) already demands ≥50 books.
2. **Interlink.** Every book page should link 3–5 related books (same genre /
   author). Add "related" via category queries — already partially built.
3. **Keep Hindi and English clearly separated** (`language` column) — both
   pages exist (/english, /hindi).
4. **Do not publish template placeholders.** The gate blocks them; the
   uploader only takes PROGRESS status `drafted`.
5. **Zero-tolerance for invented books**: master list contains only real
   titles; when extending it, add only books you can verify exist.
6. Watch Search Console after wave 1: if pages get "Crawled - not indexed",
   slow the wave pace and improve internal linking before wave 2.

## Existing-planet alignment

- ~52 original English books already in DB + 10 flagship + 450 Hindi (hidden —
  run `content-drafts-english/fix-hindi-drafts.sql` to publish them) + new
  library = the road to 2000 total.
- Master list deliberately skips the ~52 existing slugs.
- The 450 Hindi books need either the visibility fix (fast) or regeneration at
  3200+ words through this pipeline (better): add their titles to the master
  list with `lang:"hi", genre:"hindi_literature"` and re-run.

## Tracking

- `content-drafts-library/PROGRESS.json` — per-book status/word count/history
- `node scripts/verify-library.cjs` — library health at any moment
- DB: `SELECT language, count(*) FROM books WHERE is_draft=false GROUP BY 1;`
