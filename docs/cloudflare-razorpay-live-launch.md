# Booknomics Cloudflare recurring Razorpay launch checklist

PR based on cloudflare-full-migration (PR #46), not the Supabase billing branch. No API secrets belong in Git.

## Config (Cloudflare Worker \`booknomics\`)
Secret bindings: RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
Other bindings: RAZORPAY_KEY_ID, RAZORPAY_WEEKLY_PLAN_ID, RAZORPAY_MONTHLY_PLAN_ID.
The checkout route demands a live key and validates the provider's weekly INR 1900 / monthly INR 4900 plans before accepting a customer.

## Data
Applied on 2026-10-22 to Cloudflare production D1 via authenticated Cloudflare API (all 8 DDL statements returned success). Do NOT blindly rerun ALTER TABLE ADD COLUMN statements; first check PRAGMA table_info. The committed migration is for fresh Cloudflare environments. D1 \`booknomics-production\` once, after confirming 0001_core has been applied. Never delete historical Orders or Supabase records.
Check \`PRAGMA table_info(subscriptions)\` and \`sqlite_master\` indexes afterwards.

## URLs
POST /api/payments/razorpay/subscribe: authenticated checkout token creation.
POST /api/payments/razorpay/confirm: signed checkout confirmation and provider capture verification.
GET /api/payments/razorpay/subscription: current user's subscriptions.
POST /api/payments/razorpay/manage: cancel future renewals or pending mandate.
POST /api/payments/razorpay/webhook: raw HMAC-verified Razorpay event receiver.

Razorpay Live Dashboard -> Webhooks: URL \`https://www.booknomics.com/api/payments/razorpay/webhook\`.
Use the same secret in dashboard and the Cloudflare worker; do not send secrets in chat, screenshot, docs, or repository.
Events: subscription.authenticated, activated, charged, pending, halted, cancelled, completed, paused, resumed, updated.
Only enable the webhook after its Cloudflare Worker endpoint is deployed, signature rejection is verified, and D1 columns are present.

## Go-live gates
1. Cloudflare migration parity and Google sign-in/session persistence checks from PR #46 pass; 5,062 total books, 5,027 published.
2. Typecheck, unit tests, frontend production build, and Worker bundling pass.
3. Ensure real Razorpay plan IDs correspond to intended amounts and frequencies.
4. Production webhook has no JWT requirement, but it must reject missing/bad x-razorpay-signature. Only a captured INR paid-period event grants Premium; mandate auth alone does not.
5. With an owner-controlled real transaction, verify recurring checkout, paid event, account tier, receipt, renewal, invalid-signature rejection, cancellations and retries.
6. Compare provider record to D1 row; no repeated subscription creation; any unexpected event is logged. Reconciliation for dropped provider events and reversals/disputes must be reviewed before wider marketing.
7. Keep Supabase and old Vercel production intact as rollback until Cloudflare cutover is verified. Do not promote branch or change DNS solely for billing.

## Known follow-ups
- Old one-time /api/payments/razorpay/order returns HTTP 410 by default; it can only be deliberately restored with LEGACY_ORDER_CHECKOUT_ENABLED=enabled. Historical /verify endpoint stays available to settle previously created Orders.
- D1 data and Cloudflare Auth are authoritative after cutover. Do not deploy the old Supabase-centric PR #87 onto the Cloudflare runtime.
- No automated live payment has been executed by this PR.
