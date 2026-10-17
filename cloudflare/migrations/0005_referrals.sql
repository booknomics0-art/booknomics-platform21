PRAGMA foreign_keys = ON;

-- Referral codes existed in Supabase and are part of the public invite URL.
-- Backfill any migrated profiles that do not yet have one before enforcing uniqueness.
UPDATE profiles
SET referral_code = upper(hex(randomblob(4)))
WHERE referral_code IS NULL OR trim(referral_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
ON profiles(referral_code)
WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
ON referrals(referrer_user_id, created_at);
