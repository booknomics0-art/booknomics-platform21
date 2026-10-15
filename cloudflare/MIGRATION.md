# Booknomics full Cloudflare migration

This branch stages a zero/low-downtime migration from Supabase + Vercel to Cloudflare Workers, D1 and R2.

## Current migration state (2026-10-15)

- Browser cutover guard: **0 Supabase runtime imports**.
- CI: typecheck, tests, migration safety validation and production build pass.
- Cloudflare-native OAuth 2.1 + MCP authorization/resource server is implemented in the Worker.
- `book_modules` now has a D1 schema plus an explicit delta-sync/parity step.
- Production remains on the existing path until D1/R2 parity and Cloudflare preview smoke tests pass.

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
- Delegated MCP authorization: Cloudflare Worker OAuth 2.1 + PKCE with D1 token/client state
- Scheduled/background tasks: Workers Cron/Queues (migrate only active jobs)
- `images.booknomics.com`: keep existing Cloudflare-backed media URLs stable where possible
- `booknomics.com`: Worker + Static Assets after validation

## Safety rules

1. Do not pause/delete Supabase before parity checks pass.
2. Do not change `booknomics.com` DNS before preview smoke tests pass.
3. Never commit Supabase service-role keys, Cloudflare API tokens, R2 secret keys or Google OAuth client secrets.
4. Import active business data only. Archive historical audit/backup tables to R2 if they must be retained.
5. Before copying an object to R2, HEAD the destination key and skip if the object already exists.
6. Keep object keys stable where possible so URLs can be rewritten deterministically.
7. Do not expose D1 directly to browsers. All runtime D1 access goes through Worker routes.

## Cloudflare resources

Use the Cloudflare account that owns `booknomics.com`. Reuse existing R2 resources behind `images.booknomics.com` when they are the correct destination; do not create duplicates blindly.

Required bindings/resources:

- D1 database: `booknomics-production`
- R2 covers binding: `BOOK_COVERS`
- R2 assets binding: `BOOK_ASSETS`
- Worker: `booknomics`

After the resources are confirmed, add their IDs/bindings to `wrangler.jsonc`.

Required Worker secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY` when AI editorial/podcast generation is enabled
- `LOVABLE_API_KEY` when Lovable AI-backed generation is enabled
- `XAI_API_KEY` when cover generation is enabled
- `ELEVENLABS_API_KEY` when audio generation is enabled
- payment secrets when payment routes are enabled

Migration-only secrets belong in local/CI secret storage, never source control:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## D1 schema

Apply in order:

1. `cloudflare/migrations/0001_core.sql`
2. `cloudflare/migrations/0002_admin_seo.sql`
3. `cloudflare/migrations/0003_google_auth.sql`
4. Import the source data with `cloudflare/migrate.mjs`
5. `cloudflare/migrations/0004_rewrite_legacy_urls.sql` as a post-import safety pass
6. `cloudflare/migrations/0005_referrals.sql`
7. `cloudflare/migrations/0006_cutover_features.sql` for modular book content
8. `cloudflare/migrations/0007_oauth_mcp.sql` for Cloudflare-native OAuth/MCP state
9. Run the dedicated referral and book-module delta syncs before final parity enforcement

The core schema uses SQLite-compatible types and stores JSON values as TEXT. The migration utility automatically sizes insert batches below D1's bound-parameter ceiling.

## Data migration utility

`cloudflare/migrate.mjs` migrates active Supabase REST data and Google Auth identities to D1. It can also copy both public Storage buckets to R2 with destination HEAD checks so existing objects are skipped.

Additional final-delta utilities:

- `cloudflare/sync-referrals.mjs`
- `cloudflare/sync-book-modules.mjs`

It defaults to dry-run behavior. Production writes require:

- `MIGRATION_APPLY=YES`
- `MIGRATE_STORAGE=YES` to enable R2 copying

The utility rewrites legacy Supabase storage URLs to Cloudflare media routes during import and converts dynamic Supabase fallback-cover URLs to `/api/covers/<book-id>.svg`.

## Data migration policy

### Copy to D1

- `books`
- `profiles`
- `book_assets`
- `book_modules`
- user library/progress/notes/mastery
- reviews/comments/reactions/discussions
- learning paths/enrollments
- subscriptions/user roles
- referrals
- safe app settings and URL redirects
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
- legacy Supabase OAuth/MCP authorization tokens; Cloudflare issues fresh delegated OAuth tokens after cutover

If retention is required, export those tables as compressed JSON/CSV and put them in a private R2 archive prefix.

## Storage migration

Map:

- Supabase `book-covers/*` -> Cloudflare covers R2 destination
- Supabase `book-assets/*` -> Cloudflare assets R2 destination

Both existing Supabase buckets are public, so source objects can be copied by URL. Destination writes use authenticated R2 S3 credentials. Existing destination keys are checked first and skipped.

After migration:

- existing valid `images.booknomics.com` URLs stay unchanged
- legacy Supabase Storage URLs become `/media/covers/*` or `/media/assets/*`
- 3,912 dynamic Supabase fallback cover URLs become `/api/covers/<book-id>.svg`

## Google OAuth migration

Current Supabase identities are Google identities, so password hashes do not need to be migrated.

Worker flow:

1. `/api/auth/google/start` generates state and redirects to Google.
2. `/api/auth/google/callback` validates state, exchanges code, gets the verified Google profile, maps/upserts the D1 user and creates an HttpOnly session.
3. `/api/auth/session` returns the safe current-user payload.
4. `/api/auth/logout` deletes the session and clears the cookie.

Before production cutover, update Google OAuth authorized redirect URI to the final Worker/site callback URL.

## MCP OAuth migration

The browser consent flow no longer depends on Supabase Auth OAuth APIs.

Cloudflare Worker endpoints:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/oauth/register`
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/revoke`
- `/api/oauth/authorizations/:id`
- `/api/oauth/authorizations/:id/decision`
- `/mcp`

Public clients use Authorization Code + PKCE S256. Access and refresh tokens are stored hashed in D1; authorization codes are one-time and short-lived.

## Cutover gates

All gates must pass before DNS changes:

- normal CI is green
- browser Supabase cutover guard reports 0 violations
- D1 count = 5,062 books
- published count = 5,027
- book-module source IDs exist in D1 after delta sync
- sample English/Hindi summaries match source
- all public book slugs resolve
- Browse/search/filter pagination works
- Admin role check works
- 10 existing Google users are correctly mapped/sign-in tested
- R2 object count/size reconciled with source minus intentional deduplication
- no public page calls `pbkfewrtdgiagytmcigb.supabase.co`
- OAuth/MCP discovery, PKCE consent, token exchange and a read-only MCP tool smoke test pass
- generated sitemap count and canonical URLs are correct
- Cloudflare preview passes mobile/desktop smoke tests

## Cutover sequence

1. Freeze admin writes briefly.
2. Run final delta sync from Supabase to D1/R2.
3. Deploy Worker/static assets to Cloudflare preview.
4. Run parity and auth tests.
5. Route `booknomics.com` to the Cloudflare Worker.
6. Monitor errors and request volume.
7. Keep Supabase online as rollback until the Cloudflare production path is stable.
8. Only then pause/remove the old Supabase/Vercel production dependencies.
