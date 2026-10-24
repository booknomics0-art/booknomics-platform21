-- Per-user fixed-window rate limit for subjective mastery AI assessments.
-- Atomic upsert prevents simultaneous Worker requests from bypassing the quota.
CREATE TABLE IF NOT EXISTS subjective_assessment_limits (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 12)
);
