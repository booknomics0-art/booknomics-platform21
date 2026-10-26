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

1. **Old D1 identities:** The bridge intentionally refuses to link a new
   Supabase UUID to an old Cloudflare user just because the email matches. It
   returns HTTP `409` on a collision. Back up old user records and decide on
   their retention/archival before enabling new accounts with those emails.
2. **Existing Cloudflare sessions:** Disabling the legacy *login endpoints*
   alone does not revoke preexisting `bn_session` cookies. Plan a controlled
   session revocation, after backing up relevant records, before declaring a
   fresh-user cutover complete.
3. **Admin access:** The new Supabase user has a fresh UUID. Existing D1 admin
   roles do not transfer. Provision admin access deliberately and verify it.
4. **Payments:** This PR does **not** move Razorpay or subscription processing.
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
- Confirm that legacy D1 identities and any old sessions are handled according
  to the approved archival/revocation plan. Do not delete old Supabase projects
  until data parity and production smoke tests pass.

This PR defaults to the existing Cloudflare login until the environment flags
are deliberately changed. Never commit an `sb_secret_...`, `service_role` key,
Razorpay secret or webhook signing secret.
