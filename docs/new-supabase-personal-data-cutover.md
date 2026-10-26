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
- A new Supabase Edge Function implements recurring subscribe, confirm, manage,
  list and webhook handlers. SQL 002 atomically handles verified webhook events.
  The independent `VITE_SUPABASE_BILLING_ENABLED` flag defaults to false.
- Old Cloudflare-auth behavior stays as the default until explicitly activated.

## Not yet migrated — blocking production cutover

1. **Razorpay Edge Function is written but not deployed or payment-tested.**
   SQL 002, secret configuration, JWT/HMAC verification and a real webhook
   delivery must pass before enabling the billing flag. Old D1 billing remains
   unchanged and must never be used for the new Supabase identity.
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

### Deploy and verify the new Razorpay handler (separate account)

1. Apply `ops/new-supabase/002_billing_webhook_rpc.sql` in the SAME new
   Supabase SQL Editor after SQL 001. This is a separate manual migration.
2. Set the following in **Supabase -> Edge Functions -> Secrets** in project
   `otmjrtigeiuzktunodmb`. Razorpay secrets must never appear in the frontend,
   repository, screenshot or chat:

   ```text
   RAZORPAY_KEY_ID = existing LIVE key ID (rzp_live_...)
   RAZORPAY_KEY_SECRET = the corresponding LIVE secret
   RAZORPAY_WEEKLY_PLAN_ID = verified ₹19/week plan ID
   RAZORPAY_MONTHLY_PLAN_ID = verified ₹49/month plan ID
   RAZORPAY_WEBHOOK_SECRET = secret configured for the new webhook endpoint
   ```

   Supabase provides `SUPABASE_URL`, its publishable/anon key and its
   service_role/secret key to Edge Functions automatically.
3. Deploy **only** `booknomics-billing` to the NEW project from a clean clone
   of the branch (not the old project). Its file is
   `supabase/functions/booknomics-billing/index.ts`. From Windows PowerShell:

   ```powershell
   cd C:\Users\admin\booknomics-auth-fresh-20261026
   # Pull/update the reviewed branch containing this function before deploying.
   npx supabase functions deploy booknomics-billing --project-ref otmjrtigeiuzktunodmb --no-verify-jwt
   ```

   The `--no-verify-jwt` setting allows unsigned Razorpay webhook delivery;
   **the function validates raw-body Razorpay HMAC independently**, and
   separately validates Supabase user access tokens on all other routes.
4. **Do not enter the new URL in Razorpay until the function passes safety
   checks.** The new webhook URL will be:

   ```text
   https://otmjrtigeiuzktunodmb.supabase.co/functions/v1/booknomics-billing/webhook
   ```

   Verify valid/invalid webhook signatures, duplicate event IDs, wrong
   payment amounts, expiry, authenticated subscription ownership, cancellation,
   and pending mandate behavior. A real paid subscription must be verified
   from Razorpay API and reflected in the new Supabase row.
5. Only after Razorpay and all remaining personal routes are verified, enable
   the frontend billing flag and add the separately signed NEW Supabase webhook.
   The provider-side `booknomics_backend=new_supabase_v1` tag ensures each
   webhook handles only its own subscriptions. Retain the existing webhook for
   older customers until they are separately reconciled.

6. After payment and remaining personal routes are migrated/tested, set
   **build-time** public environment variables:

   ```env
   VITE_DATA_BACKEND=cloudflare
   VITE_AUTH_BACKEND=supabase
   VITE_AUTH_SUPABASE_URL=https://otmjrtigeiuzktunodmb.supabase.co
   VITE_AUTH_SUPABASE_PUBLISHABLE_KEY=<publishable key from NEW project>
   VITE_SUPABASE_BILLING_ENABLED=true
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
- Register the second new Razorpay webhook only after **both** tag-aware
  handlers are deployed and tested. Keep the old webhook for legacy subscribers.

No production SQL, webhook change, user deletion or deployment is performed
simply by opening this PR.

## Reader-data + premium content gate (October 26 follow-up)

The draft PR now connects Dashboard, personal notes, habit practice, reading
goals, path enrollment and personal library to NEW Supabase under user RLS.
Cloudflare still owns *public* learning-path and book catalog data.

The Cloudflare Worker now accepts a Supabase Auth access token for its protected
premium-summary and premium book-module routes. It checks that token with
Supabase Auth and checks active/unexpired `subscriptions` through Supabase
PostgREST under **that user's RLS policy**. No browser-reported paid tier is
trusted; missing configuration fails closed, and existing D1-cookie sessions
continue to use the old backend while the rollout is disabled.

**Additional necessary Worker binding** (not a Razorpay secret):

1. With the appropriate Cloudflare production account logged into Wrangler,
   from the Booknomics repo folder in PowerShell run:

   ```powershell
   npx wrangler secret put AUTH_SUPABASE_PUBLISHABLE_KEY
   ```

   Paste the **NEW Supabase project's public `sb_publishable_...` key** only
   into the hidden Wrangler prompt. The Worker config already supplies
   `AUTH_SUPABASE_URL`; the Vercel/Vite env vars do **not** automatically
   configure the Cloudflare Worker. Never upload a service-role or Razorpay
   secret under this variable name.
2. Only when the Worker is actually deployed after this commit will the new
   server-side access checks take effect. Do not assume the frontend build
   updates the Worker.
3. Check paid/unpaid/expired results using two separate signed-in accounts,
   verify that deleting a browser's local tier never grants access, and inspect
   logs without printing JWTs or provider secrets.

Subscriptions created after this update receive the provider note
`booknomics_backend=new_supabase_v1`. Both Razorpay webhook endpoints may stay
configured concurrently: the legacy D1 handler ignores this tag, and the new
Supabase handler checks the live provider's note before processing. **Do not
remove the old webhook while existing Cloudflare subscriptions may renew.**
When creating the additional new webhook, use the NEW webhook secret configured
in the new Supabase function (do not reuse the existing webhook's secret).
Deploy both changed handlers before enabling the second webhook.

**Additional SQL step:** Run `ops/new-supabase/003_premium_feature_quota.sql`
in the NEW project's SQL Editor. This creates a fixed 10-use/hour quota for
authenticated audio and action-plan requests without writing new user activity
into Cloudflare D1. The Cloudflare Worker calls the quota RPC using the user's
Supabase token, not a server role key. Test the limit before enabling these
cost-bearing features. If the SQL has not been applied, these features fail
closed rather than making unmetered AI requests.

Run `ops/new-supabase/004_referrals.sql` in the SAME new project to create
privacy-scoped referral codes and a single-claim-per-new-user RPC. This award
is a badge only; a referral cannot create or modify a paid subscription.
Claims for accounts older than seven days are rejected and new users cannot
refer themselves. Do this before testing `/referrals` in the new auth mode.

**Still blocked before accepting real money:** Mastery scores still need
server-verified persistence, and the legacy community interactions need a
personal-data migration. Two separate Supabase test accounts, premium audio, protected
book modules and webhook payment success must be tested. Do not activate both
`VITE_AUTH_BACKEND=supabase` and
`VITE_SUPABASE_BILLING_ENABLED=true` until paid features, webhook and live
payment entitlement have all passed end-to-end verification.
