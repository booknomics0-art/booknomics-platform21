-- ============================================================================
-- 🇮🇳 FIX: make previously-uploaded Hindi books visible
--
-- WHY: books.is_draft defaults to true and books.status defaults to 'pending'.
-- The 450-Hindi-books bulk INSERT (INSERT_450_HINDI_BOOKS.sql) did not set
-- either column, so every imported row is invisible: every page queries
-- .eq("is_draft", false). Run this once AFTER the Hindi upload to publish them.
-- ============================================================================

-- 1) See the damage first (optional):
-- SELECT language, is_draft, status, count(*) FROM books GROUP BY 1,2,3 ORDER BY 1;

-- 2) Publish all Hindi books:
UPDATE books
SET is_draft = false,
    status   = 'published'
WHERE language = 'hi'
  AND (is_draft = true OR status <> 'published');

-- 3) Confirm:
-- SELECT count(*) AS visible_hi_books FROM books WHERE language='hi' AND is_draft=false;
