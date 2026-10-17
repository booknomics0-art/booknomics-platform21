PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS book_modules (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'en',
  part_number INTEGER NOT NULL,
  part_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_premium INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(book_id, language, part_number)
);

CREATE INDEX IF NOT EXISTS idx_book_modules_book_language
  ON book_modules(book_id, language, part_number);
