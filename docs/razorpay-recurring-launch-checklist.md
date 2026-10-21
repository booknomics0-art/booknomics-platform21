# Booknomics recurring payments: launch runbook

## Plans and customer promise
- Weekly: **₹19 including applicable taxes**, period = `weekly`, interval = 1, 52 billing cycles maximum.
- Monthly: **₹49 including applicable taxes**, period = `monthly`, interval = 1, 12 billing cycles maximum.
- Auto-renewal requires explicit consent; cancellation takes effect at the end of the paid period.
- Legacy ₹69 monthly and ₹199 quarterly purchases remain honoured through their original expiry. Do not retroactively change existing orders.

## Secure configuration (test mode first)
1. In the **correct Razorpay account**, verify subscriptions / recurring collection is approved for your business and UPI AutoPay or supported mandates are available.
2. Create weekly and monthly **Razorpay Plans** at 1900 and 4900 paise. Confirm *period*, *interval*, *currency* and inclusive pricing.
3. Set Supabase Edge Function secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEEKLY_PLAN_ID`, `RAZORPAY_MONTHLY_PLAN_ID`, `RAZORPAY_WEBHOOK_SECRET`. Keep all private; do not put the secret in `VITE_*` or git.
4. Apply `supabase/migrations/20261022013000_recurring_subscriptions.sql` only to the tested Booknomics environment. Do **not** delete / reset existing data.
5. Deploy `razorpay-subscribe`, `razorpay-confirm-subscription`, `razorpay-manage-subscription` with JWT verification enabled, and `razorpay-subscription-webhook` with JWT verification **disabled**, as configured in `supabase/config.toml`.
6. In Razorpay configure a webhook at `https://<BOOKNOMICS_SUPABASE_REF>.supabase.co/functions/v1/razorpay-subscription-webhook`. Subscribe to `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.paused`, `subscription.resumed`. Ensure the webhook secret matches the Edge Function secret. The webhook verifies HMAC over the **raw** body.
7. Publish the web app after authenticating the endpoints, verifying CORS for `https://booknomics.com` and `https://www.booknomics.com`, and checking Cloudflare / Vercel routing does not block callbacks.
8. **Block live checkout until existing Google sign-in/session persistence and the personal dashboard issue are fixed.** Without a durable identity, paid memberships cannot be managed reliably.

## Acceptance tests (test keys and test plans)
- Unauthenticated checkout -> 401; invalid plan -> 400; mismatched remote plan price -> 503.
- Card / UPI mandate approved -> confirmation returns pending until captured first payment; no access on `authorized` alone.
- Real captured recurring charge -> webhook sets `active`, sets `expires_at` to Razorpay's `current_end`, and `my_active_tier()` returns correct weekly/monthly tier.
- Replay the same event ID -> no duplicate benefit. A forged signature -> HTTP 401. A failed/paused charge -> no additional paid period.
- Cancel via My Subscription -> API schedules cancellation, user retains access to paid expiry, future renewals stop. Refresh page and verify.
- Abandoned pending authorisation -> cancel pending mandate immediately, then choose a different plan (do not retry while payment capture is uncertain).
- Old single-purchase subscriptions continue working and cannot accidentally start an overlapping new mandate.
- Test both hostname variations, Hindi pages, mobile layout, currency, invoice/receipt receipt access with Razorpay, webhook delivery logs, and browser sign-out / sign-in.
- After test success, create separate live keys and plan IDs, configure a live webhook with its own secret and conduct one supervised low-value live transaction.

## Rollback
- Revert the UI release or disable the checkout route; do not drop the subscription or webhook audit tables while live mandates exist.
- If Razorpay live plans/mandates were opened, **cancel those at Razorpay** rather than only hiding the site UI. Provider mandates continue billing independently of web deployments.
- Preserve all legacy subscription records, backups and Cloudflare migration parity checks.

## Known limitations
- Backend is still Supabase Edge Functions/Postgres while broader Cloudflare D1 cutover is in progress. This PR does not silently move billing data to D1.
- Payment provider live credentials, dashboard approval and first test transaction require account access. The repository code alone is **not** a completed payment activation.
