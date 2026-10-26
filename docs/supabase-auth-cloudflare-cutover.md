# Booknomics: isolated Supabase Auth cutover

This change prepares Supabase **Auth only** for Booknomics. All books, covers,
audio, profiles, sessions, libraries and billing records remain in Cloudflare
D1/R2. No previous Supabase Auth users are imported.

## New Auth project

- Project URL: `https://otmjrtigeiuzktunodmb.supabase.co`
- Authentication > URL Configuration: Site URL `https://www.booknomics.com`
- Allowed redirect URL: `https://www.booknomics.com/auth`
- Google OAuth redirect registered with Google:
  `https://otmjrtigeiuzktunodmb.supabase.co/auth/v1/callback`

The account that owns the Supabase project is independent of the account that
owns the GitHub repository. Do not store either account's credentials in git.

## Environment switches

Both halves must be ready before enabling new login in production.

| Scope | Name | Required value |
| --- | --- | --- |
| Frontend build | `VITE_DATA_BACKEND` | `cloudflare` |
| Frontend build | `VITE_AUTH_BACKEND` | `supabase` |
| Frontend build | `VITE_AUTH_SUPABASE_URL` | New project's URL above |
| Frontend build | `VITE_AUTH_SUPABASE_PUBLISHABLE_KEY` | New project's `sb_publishable_...` key |
| Cloudflare Worker runtime | `AUTH_MODE` | `supabase` **only at cutover** |
| Cloudflare Worker runtime | `AUTH_SUPABASE_URL` | New project's URL above |
| Cloudflare Worker runtime | `AUTH_SUPABASE_PUBLISHABLE_KEY` | New project's publishable key (stored as a Worker secret) |

`VITE_*` variables are embedded in the frontend at **build time**. Cloudflare
Worker runtime variables alone do not populate the static frontend. Do not
enable the frontend while the Worker bridge is absent, or enable the Worker
before the corresponding frontend has been deployed.

## Pre-cutover blockers

1. **Non-destructive D1 schema migration is REQUIRED first:** Apply
   `cloudflare/migrations/0010_supabase_auth_email.sql` to the intended D1
   database before deploying the new Worker code. It adds the nullable
   `users.supabase_email` field and a case-insensitive unique index. Do not
   re-run an already-applied `ALTER TABLE` migration.
2. **Old D1 identities remain in place:** The bridge never links accounts by
   matching email. A new Supabase UUID gets its own `users` row with a unique
   non-deliverable internal email (`supabase-<uuid>@identity.booknomics.invalid`),
   while the real verified email is in `users.supabase_email`. The existing
   `users.email` UNIQUE constraint and all old account data stay intact.
   Authenticated API responses read the real email through `COALESCE`.
3. **Existing Cloudflare sessions:** Disabling the legacy *login endpoints*
   does not revoke preexisting `bn_session` cookies. Existing legacy sessions
   may remain usable until their original expiry; a complete reset would need
   separately authorized revocation. This migration **does not** revoke them.
4. **Admin access:** The new Supabase user has a fresh UUID. Existing D1 admin
   roles do not transfer. Provision admin access deliberately and verify it.
5. **Payments:** This PR does **not** move Razorpay or subscription processing.
   Verify identity and webhook ownership together before payment cutover.

## Verification and egress

- New Auth calls use Supabase Auth (`/auth/v1/*`), not Supabase PostgREST
  (`/rest/v1/*`). Supabase authentication traffic and its associated bandwidth
  still count toward usage; **zero** egress is not guaranteed.
- Sign in with a **new** Google account and separately with a verified email.
  Verify `/api/auth/session`, library access, sign-out and a fresh sign-in.
- Verify the same account remains signed in after a page refresh and a token
  refresh, and that the Cloudflare D1 user ID equals the new Supabase Auth UUID.
- Verify that unauthenticated users and users with rejected tokens cannot read
  or mutate premium data.
- Test login with a **legacy Cloudflare email** against the new Supabase project.
  It must create a different user ID and a completely empty D1 profile/library;
  the original Cloudflare user, library, and paid subscription must remain unchanged.
- Confirm that the new `users.supabase_email` is visible in the dashboard and
  any email-bearing billing/admin routes (the internal placeholder must never
  appear to the user or be sent in payments).
- Confirm old Cloudflare sessions are not mistaken for new Supabase identities.
  Do not delete old Supabase projects
  until data parity and production smoke tests pass.

This PR defaults to the existing Cloudflare login until the environment flags
are deliberately changed. Never commit an `sb_secret_...`, `service_role` key,
Razorpay secret or webhook signing secret.
