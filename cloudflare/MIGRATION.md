# Booknomics full Cloudflare migration

This branch stages a zero/low-downtime migration from Supabase + Vercel to Cloudflare Workers, D1 and R2.

## Current production inventory (2026-10-14)

- Supabase project: `booknomics-production` (`pbkfewrtdgiagytmcigb`, Mumbai)
- Books: 5,062 total; 5,027 published
- Supabase Auth: 10 Google identities
- Supabase Storage: 10,160 objects, ~1.00 GB
  - `book-covers`: 5,143 objects, ~704 MB
  - `book-assets`: 5,017 objects, ~297 MB
- `book_assets`: 5,015 rows; 5,015 mindmap URLs; 11 external audio URLs
- Cover URL state:
  - 3,912 dynamic Supabase `book-cover-fallback` function URLs
  - 1,129 `images.booknomics.com` URLs
  - 11 external URLs
  - 10 null
- Large historical/noisy tables such as `api_audit_log`, `audit_log` and old backup tables are NOT part of the primary D1 dataset.

## Target architecture

- Website/static build: Cloudflare Workers Static Assets
- API/backend: Cloudflare Worker (`worker/index.ts`)
- Active application database: Cloudflare D1
- Covers/mindmaps/audio/PDF/static user-facing files: Cloudflare R2
- Authentication: Google OAuth handled by the Worker + D1 sessions
- Scheduled/background tasks: Workers Cron/Queues (migrate only active jobs)
- `images.booknomics.com`: R2-backed media hostname
- `booknomics.com`: Worker + Static Assets after validation

## Safety rules

1. Do not pause/delete Supabase before parity checks pass.
2. Do not change `booknomics.com` DNS before preview smoke tests pass.
3. Never commit Supabase service-role keys, Cloudflare API tokens, R2 secret keys or Google OAuth client secrets.
4. Import active business data only. Archive historical audit/backup tables to R2 if they must be retained.
5. Before copying an object to R2, HEAD the destination key and skip if the object already exists.
6. Keep object keys stable where possible so URLs can be rewritten deterministically.
7. Do not expose D1 directly to browsers. All D1 access goes through Worker routes.

## Cloudflare resources to create

Create in the same Cloudflare account that owns `booknomics.com`:

- D1 database: `booknomics-production`
- R2 bucket: `booknomics-covers`
- R2 bucket: `booknomics-assets`
- Worker: `booknomics`

After creation, add their IDs/bindings to `wrangler.jsonc`.

Required Worker secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

Migration-only secrets belong in local/CI secret storage, never source control:

- Supabase service-role/database credentials (as needed by the chosen exporter)
- Cloudflare API token scoped to D1/R2/Workers
- R2 S3 access-key ID/secret (if using S3 bulk-copy tooling)

## D1 schema

Apply in order:

1. `cloudflare/migrations/0001_core.sql`
2. `cloudflare/migrations/0002_admin_seo.sql`
3. `cloudflare/migrations/0003_google_auth.sql`

The core schema intentionally uses SQLite-compatible types and stores JSON values as TEXT.

## Data migration policy

### Copy to D1

- `books`
- `profiles`
- `book_assets`
- user library/progress/notes/mastery
- reviews/comments/reactions/discussions
- learning paths/enrollments
- subscriptions/user roles
- app settings and URL redirects
- active catalog/research/quality/SEO records
- current jobs/social/backlink records needed in production
- Google user identity mapping (no Supabase session tokens)

### Do not copy into primary D1

- `api_audit_log`
- `audit_log`
- old one-off repair/backup tables
- R2 migration backup tables
- temporary batch tables
- obsolete Edge Function bookkeeping

If retention is required, export those tables as compressed JSON/CSV and put them in a private R2 archive prefix.

## Storage migration

Map:

- Supabase `book-covers/*` -> R2 `booknomics-covers/*`
- Supabase `book-assets/*` -> R2 `booknomics-assets/*`

Both existing Supabase buckets are public, so source objects can be copied by URL during the migration. Destination writes must use authenticated R2 API/S3 credentials.

For existing `images.booknomics.com` objects, check destination first and skip duplicates.

After parity verification, rewrite:

- cover URLs to `https://images.booknomics.com/covers/...` (or the chosen stable public prefix)
- mindmap/media URLs to their R2-backed hostname
- the 3,912 dynamic Supabase fallback cover URLs to `/api/covers/<book-id>.svg` initially, then optionally pre-render/upload them to R2

## Google OAuth migration

Current Supabase identities are Google identities, so password hashes do not need to be migrated.

Worker flow:

1. `/api/auth/google/start` generates state and redirects to Google.
2. `/api/auth/google/callback` validates state, exchanges code, obtains the Google profile, upserts/matches the D1 user and creates an HttpOnly session.
3. `/api/auth/session` returns the safe current-user payload.
4. `/api/auth/logout` deletes the session and clears the cookie.

Before production cutover, update Google OAuth authorized redirect URI to the final Worker/site callback URL.

## Cutover gates

All gates must pass before DNS changes:

- D1 count = 5,062 books
- published count = 5,027
- sample English/Hindi summaries match source
- all public book slugs resolve
- Browse/search/filter pagination works
- Admin role check works
- 10 existing Google users can sign in or are correctly mapped
- R2 object count/size reconciled with the source minus intentional deduplication
- no public page calls `pbkfewrtdgiagytmcigb.supabase.co`
- generated sitemap count and canonical URLs are correct
- `booknomics.com` preview passes mobile/desktop smoke tests

## Cutover sequence

1. Freeze admin writes briefly.
2. Run final delta sync from Supabase to D1/R2.
3. Deploy Worker/static assets to Cloudflare preview.
4. Run parity and auth tests.
5. Route `booknomics.com` to the Cloudflare Worker.
6. Monitor errors and request volume.
7. Keep Supabase online as rollback until the Cloudflare production path is stable.
8. Only then pause/remove the old Supabase/Vercel production dependencies.
