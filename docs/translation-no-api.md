# Booknomics bilingual toggle — offline editorial workflow

Translation is authored *before* a reader clicks the language switch. The Cloudflare
Worker only returns an approved D1 row; **there is no Gemini, Google Translate,
model inference or other translation API at request time**.

## Current scope

- English books and Hindi books are separate catalog entries; no matching
  `alternate_book_id` links were populated at the time of the initial audit.
- Do **not** treat a Hindi summary of a different book as a translation.
- A missing, unapproved, incomplete, or stale translation returns HTTP 409
  `TRANSLATION_NOT_READY`, leaving the original visible. Never fake Hindi by
  reusing English or inserting a generic paragraph.

## For every English book (repeat in manageable editorial batches)

1. Export the exact current published D1 source fields for that book, in the
   order: `overview`, `deep_summary`, `key_ideas`, `deep_analysis`,
   `daily_application`. Premium adds `action_system`, `practice_tracker`,
   `reflection_questions`, `real_life_example`.
2. Translate **each complete section** in ChatGPT/editorial review sessions,
   without a model API in the site. Preserve specific characters, examples,
   headings, table rows, day-by-day trackers and the factual meaning; do not
   summarize away paragraphs or invent book facts. Keep Markdown intact.
3. Save a reviewed JSON file with `bookId`, `sourceLanguage: "en"`,
   `targetLanguage: "hi"`, `accessTier: "free"` (or `"premium"`),
   `sourceSections`, `translatedSections`, `reviewedBy`, `approved: true`.
   A complete pair of source and translation text is required per nonempty field.
4. Prepare and validate the SQL without any provider call:

   ```shell
   node scripts/prepare-reviewed-translation.mjs reviewed-book.json reviewed-book.sql
   ```

5. Review the generated SQL, the warning report, and at least a representative
   sample of the full text. Confirm the D1 book has **not changed** since export.
6. Apply migration `0009_book_translation_cache.sql` first, then upsert only
   approved SQL to the correct Cloudflare D1 database through the approved
   deployment procedure. Do not modify the source English record.
7. Test signed-in free and premium readers, EN→HI→EN switching, full section
   parity, and zero external translation provider calls. Re-run after any source
   edit; the hash automatically invalidates stale Hindi content.

## Explicit constraints

- No live translation API, no browser-side model, no silent fallbacks.
- The temporary Supabase `/auth/v1/user` call validates **sign-in**, not
  translation; remove that compatibility bridge after Cloudflare auth parity.
- Preview or staging checks must pass before changing the production Worker.
- Missing books remain pending; populating all English entries requires
  authored translations for each original book, not a one-time code deployment.
