-- Run after importing source rows into D1.
-- Prevent the Cloudflare deployment from leaking cover traffic back to Supabase.
-- Use instr() instead of LIKE so large/odd source strings cannot hit SQLite's LIKE pattern limit.

UPDATE books
SET cover_url = '/api/covers/' || id || '.svg'
WHERE cover_url IS NOT NULL
  AND instr(cover_url, 'pbkfewrtdgiagytmcigb.supabase.co/functions/v1/book-cover-fallback') > 0;

-- Any missing cover can use the same deterministic Cloudflare fallback.
UPDATE books
SET cover_url = '/api/covers/' || id || '.svg'
WHERE cover_url IS NULL OR trim(cover_url) = '';
