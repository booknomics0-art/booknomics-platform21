-- Prewritten and editorially reviewed translations only. No runtime model calls.
-- The source hash invalidates an old translation when a summary is updated.
CREATE TABLE IF NOT EXISTS book_translations (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL CHECK (target_language IN ('en', 'hi')),
  access_tier TEXT NOT NULL CHECK (access_tier IN ('free', 'premium')),
  source_hash TEXT NOT NULL,
  content_json TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'approved')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, target_language, access_tier)
);
