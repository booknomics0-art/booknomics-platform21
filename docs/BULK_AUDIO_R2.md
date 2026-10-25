# Cloudflare R2 bulk audiobook upload — implementation notes

Status: **Cloudflare-session admin upload code prepared for deployment** (25 October 2026). Production deployment and a real MP3 smoke test must be verified separately.

## What was added

- Booknomics `/admin` → **Bulk Audio**: select 1–500 MP3 files, up to 95 MiB each.
- English/Hindi filename normalization, conservative book matching, searchable manual selection, duplicate detection, skip, explicit replacement confirmation.
- Two simultaneous uploads with per-file progress, stop, independent errors, HTTP-range and browser metadata playback verification.
- A **separate** Cloudflare Worker at `/api/admin/audio/*` so the existing `booknomics` Worker and its `/api/*` and `/media/*` routes are not overwritten.
- Server-side verification of the main Booknomics **HttpOnly `bn_session` Cloudflare cookie**, its unexpired D1 session hash, exact `booknomics0@gmail.com` email and D1 `user_roles.role='admin'`. No browser Supabase client or JWT is needed.
- Files stream into a dedicated private R2 bucket, are size-verified, and are linked to `book_assets.audio_url` in D1. Admin gets a 60-minute **signed, seekable playback URL** for upload verification.
- The existing visitor book pages, Supabase legacy audio and other learning assets are untouched until public versus premium playback access is explicitly configured and tested.

## Storage

R2 bucket: **`booknomics-private-audio`** (isolated from the public Booknomics Worker; created on 24 October 2026).

Object key: `audiobooks/<book-uuid>/<random-uuid>.mp3`

Stored book link (private, not a visitor URL): `r2-private:audiobooks/<book-uuid>/<random-uuid>.mp3`

**Security boundary:** The existing `booknomics` Worker serves `booknomics-assets` through `/media/assets/*` without entitlements. It **has no binding to the new private audio bucket**, so guessing a key does not expose it. Only `/api/admin/audio/stream/<bookId>?expires=...&signature=...` can stream the new bucket, and its signature is issued only to verified admin. The new Worker updates only the matching D1 `book_assets` audio field. Existing audio is untouched unless explicitly replaced; old objects are retained. The admin preview link expires after 60 minutes.

## Local verification (safe; never publishes)

```bash
npm ci
npm run typecheck
npm test
node_modules/.bin/tsc --noEmit -p cloudflare/audio-upload/tsconfig.json
node_modules/.bin/wrangler deploy --dry-run --config cloudflare/audio-upload/wrangler.jsonc
```

`wrangler deploy --dry-run` bundles but **does not deploy**.

Cloudflare generated binding types: `cloudflare/audio-upload/worker-configuration.d.ts` (update with `npx wrangler types cloudflare/audio-upload/worker-configuration.d.ts --config cloudflare/audio-upload/wrangler.jsonc --include-runtime=false` when bindings change).

## Deployment prerequisites — **requires explicit approval**

1. Review the `booknomics-audio-upload` Worker code and route precedence. Its routes (`/api/admin/audio/*`) are narrower than the existing `booknomics.com/api/*` routes.
2. Keep the existing fresh 32+ character `AUDIO_PREVIEW_SIGNING_KEY` as a Worker secret. Supabase URL and anon-key secrets are no longer used for this Worker; do not rotate or expose the signing key.
3. Verify `booknomics-private-audio` is bound **only** to the dedicated Worker. Do not bind it to the public site Worker, publish an R2 public domain, or make a public media route for it.
4. Deploy the dedicated Cloudflare Worker, then deploy the admin frontend; do not delete Supabase until unrelated migration parity is verified.
5. Sign in through the site's **Cloudflare Google sign-in** as `booknomics0@gmail.com`. The dedicated Worker checks its `bn_session` cookie against the shared production D1 sessions and admin roles.
6. Upload two authorized test MP3s, verify correct title/language, R2 object size, D1 private link, range/seek, signed preview expiry, and an unauthorized account's 403. The public book page must **not** expose them. Only then upload the remaining 50 files.
7. Legacy Supabase `admin_book_catalog.audio_ready` stats remain separate from D1; Admin explicitly labels the old count `Legacy audio ready` and the Bulk tab gives a D1 private-audio count.

**Public rollout is a separate change**: decide which books/audio are free and which require an active Razorpay subscription, then implement server-side entitlement checks before providing listener playback links. A private upload alone does not publish audio to site visitors.

## Retry / recovery

- Failed or ambiguous linking leaves the prior audio untouched; check both R2 and D1 before retrying. Newly uploaded keys are unique, so no old MP3 is destroyed.
- Browser upload progress reaching 100% does **not** imply that the D1 link was saved; the server responds only after verification.
- If playback metadata fails, the row is marked `unverified` but the successful R2 + D1 link is retained for manual inspection (do not blindly upload the same file twice).
- The dedicated Worker has no delete endpoint. No database or storage cleanup is automated.
