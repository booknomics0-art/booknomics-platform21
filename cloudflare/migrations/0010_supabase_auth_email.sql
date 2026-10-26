-- New Supabase Auth identities are separate from legacy Cloudflare identities.
-- The existing users.email UNIQUE constraint and all old rows remain unchanged.
-- Apply to the intended D1 database before deploying the updated Worker.
ALTER TABLE users ADD COLUMN supabase_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_email
  ON users(supabase_email COLLATE NOCASE)
  WHERE supabase_email IS NOT NULL;
