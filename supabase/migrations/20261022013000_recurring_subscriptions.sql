-- Non-destructive: preserve legacy one-time subscriptions and quarterly entitlements.
BEGIN;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS cancel_at_cycle_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_provider_event_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub_id_unique
  ON public.subscriptions (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  event_id text PRIMARY KEY,
  event_name text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.razorpay_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.razorpay_webhook_events TO service_role;
-- Read-only subscription listing remains available exclusively to owning user.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
COMMIT;
