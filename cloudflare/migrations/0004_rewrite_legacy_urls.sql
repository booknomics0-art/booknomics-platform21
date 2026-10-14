-- Run after importing source rows into D1.
-- Prevent the Cloudflare deployment from leaking cover traffic back to Supabase.

UPDATE books
SET cover_url = '/api/covers/' || id || '.svg'
WHERE cover_url LIKE '%pbkfewrtdgiagytmcigb.supabase.co/functions/v1/book-cover-fallback%';

-- Any missing cover can use the same deterministic Cloudflare fallback.
UPDATE books
SET cover_url = '/api/covers/' || id || '.svg'
WHERE cover_url IS NULL OR trim(cover_url) = '';
