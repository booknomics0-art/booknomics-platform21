-- Additive Razorpay recurring billing for Cloudflare D1. Preserves legacy Orders subscriptions.
ALTER TABLE subscriptions ADD COLUMN razorpay_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN provider_status TEXT;
ALTER TABLE subscriptions ADD COLUMN cancel_at_cycle_end INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN last_provider_event_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_provider_subscription_id ON subscriptions(razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_pending_per_user ON subscriptions(user_id) WHERE status='creating' OR (status='pending' AND razorpay_subscription_id IS NOT NULL);
CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_received ON razorpay_webhook_events(received_at);
