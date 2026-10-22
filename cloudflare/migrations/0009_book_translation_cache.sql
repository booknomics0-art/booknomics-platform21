-- Cached, book-authoritative reader translations. Replaces stale results when
-- any of the source fields changes; no user data or credentials are stored.
CREATE TABLE IF NOT EXISTS book_translations (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL CHECK (target_language IN ('en', 'hi')),
  access_tier TEXT NOT NULL CHECK (access_tier IN ('free', 'premium')),
  source_hash TEXT NOT NULL,
  content_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, target_language, access_tier)
);
