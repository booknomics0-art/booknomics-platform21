# Mastery author biographies — Cloudflare D1 publishing

This feature loads **individually written, reviewed ~400-word author essays per book**
from the existing same-origin Cloudflare Worker route `GET /api/books/:slug`.
The Worker is already routed for `/api/*` on booknomics.com and selects the
complete D1 `books` row for that endpoint. No public write route is added.

## Migration

Apply `cloudflare/migrations/20261022_mastery_author_bios.sql` to the
**booknomics-production** D1 database only after checking its existing schema,
creating a recoverable pre-migration backup, and confirming the same-origin
Worker still provides the book endpoint. The migration adds nullable columns;
it does not change or overwrite any existing book data.

The added fields are:

| Field | Meaning |
| --- | --- |
| `author_bio` | Full book-specific plain-text essay |
| `author_bio_sources` | JSON array of ≥2 HTTPS references |
| `author_bio_status` | `draft` or `reviewed`; only reviewed is shown |
| `author_bio_reviewed_at` | Date of editorial approval |

**Important:** A database write alone does not deploy the frontend reader.
Deploy the matching GitHub frontend changes, then verify at least one English
and one Hindi book's Mastery tab on the public site.

## Editorial import

Use the importer with a JSON array of actually authored entries:

```json
[
  {
    "book_id": "the-published-D1-book-uuid",
    "title": "Exact book title",
    "author": "Exact credited author",
    "language": "en",
    "text": "The complete, independently written ~400-word author essay...",
    "sources": ["https://publisher.example/source", "https://archive.example/source"]
  }
]
```

This is an **illustration of the format, not a reviewed example**. Do not import
this sample. Import only articles actually researched and written. Run with the
`CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID`, and `CF_D1_DATABASE_ID` environment
variables configured on a trusted workstation or CI secret store.

```sh
# Read-only validation and published-book identity preflight:
node --import tsx scripts/import-master-authors.ts reviewed-authors.json

# Only after reviewing the exact contents and verified intended IDs:
node --import tsx scripts/import-master-authors.ts reviewed-authors.json --apply
```

The importer refuses missing or duplicate books, altered metadata, unverifiable
length, absent sources, and overwriting different existing essays. It writes in
small D1 batches after all requested entries pass preflight. If a batch fails,
the script stops and can be resumed only after inspection.

## Rendering and fallback

The Mastery tab fetches `/api/books/:slug` only on its author-section mount.
It checks book ID, slug, title, author, published status, reviewed status,
source URLs, language, and 350–460 words. It renders text as plain React text
with `whitespace-pre-line`, not injected HTML. Links are HTTPS-only and open
with `noopener noreferrer`. If D1 is unavailable, it preserves the existing
reviewed book-specific static bio, then the existing vetted author profile,
then an explicitly pending placeholder. No automatic generic writing occurs.

### Completion is not a manifest

The 500-book cohort file registers identities but **does not contain 500
biographies**. Its pending records must not be imported or counted as complete.
The ten reviewed profiles previously written in PR #90 are the only completed
book-specific essays until further editorial work is delivered and verified.

### Rollback

If rendering fails after deployment, roll back the frontend release: the extra
D1 columns are additive and invisible to the old reader. Do not delete book
records or rewrite summary fields. Preserve a backup before considering removal
of columns or replacing existing reviewed biographies.
