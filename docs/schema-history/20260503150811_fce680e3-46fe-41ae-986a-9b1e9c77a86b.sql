DROP POLICY IF EXISTS "Book covers public read" ON storage.objects;
CREATE POLICY "Book covers direct read"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers' AND name IS NOT NULL);
-- Note: Supabase public bucket still serves files via /object/public/... regardless of list policy.
