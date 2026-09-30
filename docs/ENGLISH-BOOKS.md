# 📚 The 10 Best English Books — Pipeline & Upload Runbook

Ten all-time-great English books, each with a **genre-specific deep summary of
3,200+ words**, verified by a quality gate, and ready to upload to Supabase.
This is the English counterpart to the 450-Hindi-books pipeline, with the
bugs of that pipeline fixed (see "What was fixed" below).

## The books (10 genres, 10 different summary structures)

| # | Book | Author | Year | Genre | Summary structure |
|---|------|--------|------|-------|-------------------|
| 1 | Pride and Prejudice | Jane Austen | 1813 | Romance of Manners | social world → misunderstandings → proposals → money & class → legacy |
| 2 | To Kill a Mockingbird | Harper Lee | 1960 | Social Justice Drama | town-as-character → child's lens → mob scene → trial → aftermath |
| 3 | 1984 | George Orwell | 1949 | Dystopia | world machinery → rebellion → interrogation → defeat → language & power |
| 4 | The Great Gatsby | F. Scott Fitzgerald | 1925 | Jazz Age Tragedy | narrator audit → dream anatomy → confrontation → crash → national reading |
| 5 | Hamlet | William Shakespeare | ~1601 | Revenge Tragedy | ghost & evidence → delay → play-within-play → collateral → finale |
| 6 | The Hobbit | J.R.R. Tolkien | 1937 | Fantasy Quest | reluctant hero → chain of trials → dark moral pivot → war → homecoming |
| 7 | Animal Farm | George Orwell | 1945 | Political Allegory | revolution grammar → power mechanics → propaganda toolkit → betrayal |
| 8 | Jane Eyre | Charlotte Brontë | 1847 | Gothic Bildungsroman | childhood injustice → education → gothic secret → two refusals → equality |
| 9 | Lord of the Flies | William Golding | 1954 | Allegorical Survival | invented order → fear politics → ritual descent → rescue irony |
| 10 | The Old Man and the Sea | Ernest Hemingway | 1952 | Literary Parable | ledger → contest → audit → style → the dream |

Content lives in `content-drafts-english/*.txt` using the same marker format as
the Hindi drafts (`#BOOK_START`, `#TAGLINE`, `#SUMMARY`, `#KEY_IDEAS`,
`#HOW_TO_READ`, `#REFLECTION`) plus front-matter (`Title/Author/Year/Language/
Genre/Category/Slug`).

## The workflow (repeatable for the next batches)

```
1. Write/edit drafts          content-drafts-english/<slug>.txt
2. Verify quality gate        node scripts/verify-english-books.cjs
3. Generate upload artifacts  node scripts/generate-english-upload.cjs
4. Upload to Supabase         node scripts/upload-english-books.cjs
   (or paste content-drafts-english/sql-chunks-english/chunk-01.sql
    into Supabase Dashboard → SQL Editor)
5. Verify in SQL:
   SELECT slug, title, reading_time, is_draft, status
   FROM books WHERE language='en' ORDER BY title;
```

### Quality gate — `scripts/verify-english-books.cjs`

Converts "quality 98%" into measurable checks and **fails the build** if any
book is short:

- **Word count**: `#SUMMARY` must be ≥ **3,200 words** per book (hard gate;
  scoring encourages 3,400+).
- **Genre structure**: every genre's required sections present (each genre has
  a different skeleton — no shared template).
- **Completeness**: TAGLINE, KEY_IDEAS (bullets), HOW_TO_READ, REFLECTION
  (≥4 questions), slug format, year sanity, `Language: en`.
- **Originality**: cross-book duplicate 12-word sequences = hard failure.
- **Readability**: average sentence length band + no runaway sentences.
- **Score**: weighted 0–100, must be ≥ **98** for every book.

### Generator — `scripts/generate-english-upload.cjs`

Produces:
- `INSERT_10_ENGLISH_BOOKS.sql` — single transaction, idempotent
  (`ON CONFLICT (slug) DO UPDATE`), safe to re-run.
- `sql-chunks-english/chunk-01.sql` — paste-ready for the SQL Editor.
- `BOOKS_10_ENGLISH.json` — for API-based upload / admin tooling.

DB mapping: `tagline` ← TAGLINE, `overview` ← first ~750 chars of SUMMARY
(cut at sentence boundary), `deep_analysis` ← full SUMMARY (premium content,
served via `get_premium_summary`), `daily_application` ← HOW_TO_READ,
`reflection_questions` ← REFLECTION, `key_ideas` ← KEY_IDEAS,
`reading_time` = ceil(words/200), `language='en'`, `rating 4.8`,
`meta_title`/`meta_description` generated, `cover_url` from Open Library
ISBN covers (same pattern as existing migrations).

### Uploader — `scripts/upload-english-books.cjs`

One command when you have credentials. Put **secrets only in `.env`** (already
gitignored) or export them:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

The script upserts via PostgREST (`merge-duplicates` on slug), then reads every
row back and verifies `is_draft=false`, `status='published'`, and that uploaded
word counts match local counts. It never prints the key. If you cannot keep a
service key on your machine, use the SQL Editor path — the SQL is identical.

## What was fixed vs. the 450-Hindi pipeline (read this!)

1. **Draft-invisibility bug**: `books.is_draft` defaults to `true` and
   `books.status` to `'pending'`; every site page queries
   `.eq("is_draft", false)`. The Hindi bulk-INSERT did not set either column,
   so imported Hindi books are invisible until you run
   `content-drafts-english/fix-hindi-drafts.sql`. The English generator sets
   `is_draft=false, status='published'` explicitly in every statement.
2. **Word-count trust**: counts are *verified before and after* upload (script
   step 1 and the uploader's read-back), instead of trusting the draft.
3. **Overview truncation**: cut at a sentence boundary, not mid-sentence.
4. **Escaping**: backslashes are escaped as well as quotes in the SQL path.
5. **SEO fields**: `meta_title`/`meta_description` are filled at insert time.
6. **No shared template**: genre-specific section skeletons (checked by the
   verifier) instead of one structure with renamed headings.

## Rollback

```sql
DELETE FROM books WHERE language='en' AND slug IN (
  'pride-and-prejudice-jane-austen-summary',
  'to-kill-a-mockingbird-harper-lee-summary',
  '1984-george-orwell-summary',
  'the-great-gatsby-f-scott-fitzgerald-summary',
  'hamlet-william-shakespeare-summary',
  'the-hobbit-jrr-tolkien-summary',
  'animal-farm-george-orwell-summary',
  'jane-eyre-charlotte-bronte-summary',
  'lord-of-the-flies-william-golding-summary',
  'the-old-man-and-the-sea-ernest-hemingway-summary'
);
```
