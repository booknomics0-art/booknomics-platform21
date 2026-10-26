# Booknomics: new Supabase auth/personal data + Cloudflare catalog

Status: **implementation in progress, NOT safe to activate in production yet**.
This is a different design from draft PR #109 (`Supabase Auth -> D1 users/sessions`):
**do not merge PR #109 or run D1 migration 0010** if the intent is to keep all
personal data in Supabase. The earlier `users.supabase_email` column, if already
added in D1, is harmless and does not need deletion.

## Where things live

| Type | Target |
| --- | --- |
| Public books, Hindi/English summaries, book metadata | Cloudflare D1 |
| Covers, audio and public media files | Cloudflare R2 |
| Google/email accounts, login sessions, password recovery | NEW Supabase Auth |
| Personal profiles, saved library, notes, reading progress, habits, badges, path enrolments | NEW Supabase PostgreSQL |
| Razorpay subscription, entitlements and payment webhook audit | NEW Supabase PostgreSQL / verified server functions |
| Deployment and source | existing GitHub repository / current production hosting |

The new Supabase project is `otmjrtigeiuzktunodmb`. It belongs to a different
Google account from the GitHub repository; that **does not affect website OAuth**.
No old users are migrated. Existing users must create a new Supabase Auth account;
Google can be used again, but the new account has a new UUID and an empty library.
Cloudflare D1's old user records **must not be deleted as part of this work**.

## What this PR implements

- New Supabase personal-data schema + RLS in `ops/new-supabase/001_personal_data.sql`;
  the new SQL is intentionally **not** in the legacy Supabase migrations folder.
- `VITE_AUTH_BACKEND=supabase` reads the Supabase Auth identity **directly**;
  it neither creates a D1 `users` row nor reads D1 `sessions`.
- Email signup/signin and Google OAuth use the new Supabase Auth project.
- Book detail saving and the My Library page read/write new Supabase `library`
  and `reading_progress`; library book-card snapshots avoid a D1 join.
- Tier display reads **read-only** paid subscription records from Supabase;
  admin UI role checks call a secure Supabase RPC rather than accepting claims
  from user metadata.
- Old Cloudflare-auth behavior stays as the default until explicitly activated.

## Not yet migrated — blocking production cutover

1. **Razorpay recurring billing and webhook** still rely on D1 in
   `worker/recurringBillingRoutes.ts`. A new, independently authenticated
   Supabase-backed payment handler must validate Razorpay *live* signature,
   plan/amount/currency, duplicate events and subscription ownership before
   production activation. Payment records must be written only with server
   credentials. Do not reuse the old D1 webhook for new Supabase users.
2. Dashboard stats, notes, mastery, habits, path enrolment, community actions,
   bookmarks through any other compat adapters, referrals and MCP/admin OAuth
   endpoints still have D1-backed user dependencies. Their individual routes
   must be converted before the new backend can be the only personal store.
3. The Cloudflare catalog remains on D1, so **public catalog endpoints may still
   fail** during the D1 daily read limit, independent of login. The current
   D1 quota cannot be bypassed by retrying migrations or creating aliases.
4. Authenticated premium-content authorization on the server must check a
   verified Supabase token and trusted subscription record. The browser's
   `useTier` result is for display only and is **not** an access-control gate.

## Manual setup in the new Supabase account

1. Sign in at `https://supabase.com/dashboard/project/otmjrtigeiuzktunodmb`.
2. Verify **Authentication -> Providers -> Google** is enabled and its
   Client ID/Secret were saved. Google Cloud authorized redirect URI must be
   exactly `https://otmjrtigeiuzktunodmb.supabase.co/auth/v1/callback`.
3. Under **Authentication -> URL Configuration**, set Site URL to
   `https://www.booknomics.com` (or the verified canonical production origin).
   Add `https://www.booknomics.com/auth` and
   `https://www.booknomics.com/auth**` to the allow list if the OAuth/email
   callback has a `?next=` parameter. Add apex `booknomics.com` equivalents
   only if that origin is used for auth; confirm final redirect behavior.
4. In **SQL Editor**, paste/run **only**
   `ops/new-supabase/001_personal_data.sql`. Review the selected project ID
   before running. Do not run legacy `supabase/migrations/` against the new
   account. The SQL should be run once on an empty project. Never share
   database passwords or service-role keys with ChatGPT.
5. In **Authentication -> Users**, verify a new test signup (fresh email).
   In **Table Editor -> public.profiles**, check the profile trigger made one
   row for that user. Verify one user's client cannot read another user's
   library or subscription using two distinct test accounts.
6. After payment and remaining personal routes are migrated/tested, set
   **build-time** public environment variables:

   ```env
   VITE_DATA_BACKEND=cloudflare
   VITE_AUTH_BACKEND=supabase
   VITE_AUTH_SUPABASE_URL=https://otmjrtigeiuzktunodmb.supabase.co
   VITE_AUTH_SUPABASE_PUBLISHABLE_KEY=<publishable key from NEW project>
   ```

   Set these in the platform actually building frontend assets. Cloudflare
   **Worker** secrets `AUTH_SUPABASE_URL` and `AUTH_SUPABASE_PUBLISHABLE_KEY`
   have different names and do not automatically become Vite build vars.
   No Supabase service-role key, Razorpay secret, or webhook secret may be
   prefixed with `VITE_` or committed to Git.
7. Redeploy only after a full checkout/login/premium test. If testing fails,
   revert the Vite auth flag to `cloudflare` and redeploy. Preserve all old
   data and endpoints until verified.

## Limit PostgREST egress (the original cost problem)

- Read only explicit columns and own `user_id`, with composite indexes and
  small `limit()` values. Never call `select('*')` over every user or book.
- Public books and their large summaries **never** enter the new Supabase DB.
- Library stores compact book-card snapshots in the user's saved row so the
  Library page can render without joining 5,000+ D1 catalog rows.
- Use `getUser()` or a verified access token for server authorization; do not
  trust a claimed user ID, email, tier, or role from the client body.
- Observe the **new** Supabase project Usage -> Database / API traffic after
  launch, and keep pagination / rate limits in all user-facing reads.

## Razorpay cutover checklist (must pass before live enable)

- Create, confirm, manage, subscription-status, webhook routes all use the new
  Supabase user UUID. Strong JWT validation at each authenticated endpoint.
- Razorpay Live plan IDs match the actual **₹19/week and ₹49/month** plans;
  reject mismatched amounts/periods on the trusted server.
- Verify checkout and webhook HMAC; verify charged/captured transaction directly
  from Razorpay, not from client JSON. Block cross-account subscriptions.
- Subscription row has unique provider ID and idempotent webhook event ID;
  handle webhook order/replay/timeout and prevent duplicate subscriptions.
- An expired or pending subscription does **not** unlock premium. Cancellation
  preserves paid access until the verified paid period ends.
- Update the existing Razorpay webhook URL only after the new endpoint is
  deployed and tested, so paid events are never sent into an unready handler.

No production SQL, webhook change, user deletion or deployment is performed
simply by opening this PR.
