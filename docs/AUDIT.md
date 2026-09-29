# Booknomics migration audit — 29 September 2026 (India)

## Decision

Proceed with the prepared code candidate and obtain source-data/account access.
Do not cut production traffic over yet. No GitHub upload, Supabase project creation,
data migration, Vercel deployment, DNS change or ChatGPT connector creation occurred.

## What was supplied

The ZIP contains 344 files (396 ZIP entries including directories), React/Vite
source, 40 original migrations, 18 Edge Functions and local brand assets.
No full SQL data dump, auth-user export or storage-object backup is present.
Migrations create 33 public tables. They contain no INSERT INTO public.books rows;
a new database therefore cannot recreate the live catalog from this ZIP alone.
There are a few static seed rows such as learning paths; those are not a live backup.

## Expert decision variables

| Variable | Evidence / decision |
|---|---|
| Data completeness | Source schema exists; live rows, users and media still required |
| Ownership/access | GitHub user verified; old Supabase project denies this account access |
| Costs and region | One Free Supabase org visible; select org and obtain actual creation quote; Mumbai proposed |
| Authentication | Old Lovable broker and old project fallback were migration blockers |
| Authorization | Old email bypass and blanket admin seed required correction |
| Payments | Signed replay could reset expiry; provider capture/amount validation missing |
| Hosting/routing | Vercel SPA setup existed, but Netlify-style redirects were not Vercel routing |
| Third-party dependencies | Lovable AI/GSC, Google OAuth, Razorpay, Gemini, xAI, ElevenLabs, n8n need configuration |
| Reversibility | Preserve source data, original ZIP and old hosting until cutover tests pass |
| Quality evidence | Compilation/tests/local SQL replay available; hosted and visual end-to-end tests not available |

## What works in the original project

- Existing complete page set, responsive styles, reusable UI and lazy-loaded pages.
- Supabase schema history, RLS on public tables, admin roles and premium-content column restrictions.
- Existing payment functions and four MCP tools provide a useful foundation.
- All 20 original tests and the frontend TypeScript check passed before changes.

## Improvements, in impact order

| Priority | Finding | Implemented / remaining |
|---|---|---|
| P0 | Source live data is absent | No fabricated data. Full authorized export and storage copy required |
| P0 | Payment replay could extend expiry | Constant-time HMAC verification, capture/order/amount/currency checks, pending-only update, replay returns original expiry, unique order/payment indexes |
| P0 | Admin tied to old email; one historical migration grants every profile admin | Database-role checks in UI/GSC/MCP, old email function changed to role lookup, blanket seed disabled for NEW installation |
| P0 | Old Supabase URL/key hardcoded as fallback | Required public env config and key-role validation; missing configuration fails clearly |
| P0 | Google sign-in tied to old Lovable broker | Direct Supabase PKCE flow and same-origin post-login redirects |
| P1 | Action-plan endpoint exposed premium cache to any signed-in user | Paid-tier/admin guard before reading content; drafts excluded in action/audio/expert lookups |
| P1 | Rate-limit cleanup deleted long windows after a minute | Per-entry expiry now respected; limit remains per warm instance, not distributed |
| P1 | Any tenant on broad Lovable domains trusted by CORS | Exact booknomics origins plus explicit configured origins |
| P1 | book-assets bucket absent from migrations | Bucket creation added; existing public-asset model preserved |
| P1 | MCP issuer bound to old project, no admin edit tool | Runtime project issuer, search input filtering, idempotent save, limited admin_update_book and private audit trail |
| P1 | Sitemaps silently overwritten empty after backend failure | Production build fails on fetch/count issues; paginated catalog; explicit offline CI mode only |
| P1 | Old dependencies | Compatible audit fixes reduced 27 advisories to 6; major upgrades still required |
| P2 | Vercel setup, HTTP headers, dual lockfiles and unpinned tsx execution | Explicit build/output config, safe response headers, npm lockfile, declared tsx, CI checks |
| P2 | Simulator could affect production premium UI | Tier simulation now development-only; server-side billing remains authoritative |

No CSS, Tailwind theme, homepage layout, branding assets or public page copy were
redesigned. Login inputs gained autocomplete and duplicate-submit protection;
OAuth consent now discloses administrator content edits. Brand naming inconsistency
(BookInsight vs Booknomics) is intentionally left for owner review.

## Verification actually performed

- Original tests: 20/20 pass.
- Updated tests: 34/34 pass, including six mocked payment-verification scenarios,
  unsafe login redirects, CORS and long-window rate-limit pruning.
- TypeScript: app and Vite config checks pass.
- Vite release compilation: passes with explicit CI placeholder Supabase values
  and static-only sitemap mode. This is a compile check, not a live deployment.
- 41 SQL migrations replay in PGlite (PostgreSQL-compatible local runtime) with
  mocked Supabase auth/storage infrastructure. 33 public tables, all RLS enabled;
  both storage buckets present. Ordinary-user edits denied, admin edits succeed
  and create an audit row. Old owner email alone is not admin. Anonymous premium
  column SELECT is denied. These tests do not validate hosted Auth/Storage services.
- Lint: still 237 errors / 22 warnings; not a clean lint gate.
- Dependency audit after compatible updates: six advisories (five moderate, one
  high), chiefly Vite/esbuild, Vitest/mock and React Router dependency paths.
  Automated fixes for the remainder propose major versions; no forced upgrade was made.
- Original catalog sitemap files restored after offline compilation. Live rebuild required.
- No live Google OAuth, payment sandbox, AI models, storage transfer, mobile visual
  comparison, DNS/TLS or ChatGPT MCP roundtrip was executed.

## Confirmed cloud blockers

1. GitHub account is booknomics0-art. Existing booknomics0-art-booknomics repository
   is public and metadata reports size 0. The connector lacks a create-repository
   operation. It was not repurposed because a NEW repository was requested.
2. Supabase lists zero projects and one organization, booknomics0-art's Org, on Free.
   The source project aszjrlarrutzyripxacw explicitly returns permission denied.
   Its real data cannot be exported with the connected account.
3. Supabase project creation requires explicit organization choice, a current cost
   quote and cost confirmation. No project or billable resource was created.
4. Vercel lists zero teams. Its deployment tool returns Tool deploy_to_vercel not found.
   Browser fallback needs user approval under this session's browser instructions.
5. Focused Drive searches found project documents, but no backup/dump/.sql result.
   This is a bounded search result, not proof that no backup exists anywhere.

## Remaining release gates / self-review

- Obtain full source backup; compare row counts/checksums and sample every feature.
- Reconcile source schema drift, imported admin grants and duplicate payment IDs.
- Resolve six remaining dependency advisories and lint debt; verify major upgrades separately.
- Verify hosted grants/RLS/advisors, JWT signing configuration and OAuth consent/scopes.
- Existing AI/GSC gateways are still Lovable-dependent; migrate provider calls or confirm portability.
- Current model names and keys require live provider verification.
- Complete payment webhook reconciliation, refund/cancellation handling and capture-failure recovery.
- Public book-assets URLs and existing public profile/leaderboard policies need a product/privacy review.
- Rate limiting is in-memory only; distributed limits needed for strict spend controls.
- MCP supports limited book content editing, NOT unrestricted source-code/site administration.
- Domain ownership, DNS, TLS, canonical redirects and rollback plan remain unverified.

## Documentation consulted

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- https://razorpay.com/docs/api/payments/fetch-with-id/
- Installed @lovable.dev/mcp-js Supabase adapter type documentation for MCP/REST routes.

Supabase changelog.md retrieval was attempted but did not succeed in this environment;
no claim of a complete current-platform compatibility review is made.
