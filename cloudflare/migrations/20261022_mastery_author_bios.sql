-- Reviewed, book-specific Mastery author essays. Run once against
-- Cloudflare D1 booknomics-production after a backup and schema inspection.
-- Leave all existing book metadata, summaries, and auth data unchanged.
-- A row is displayed only if status = 'reviewed', sources are valid, and the
-- reader's stable ID / title / author checks all pass.
ALTER TABLE books ADD COLUMN author_bio TEXT;
ALTER TABLE books ADD COLUMN author_bio_sources TEXT;
ALTER TABLE books ADD COLUMN author_bio_status TEXT CHECK (author_bio_status IN ('draft', 'reviewed') OR author_bio_status IS NULL);
ALTER TABLE books ADD COLUMN author_bio_reviewed_at TEXT;
