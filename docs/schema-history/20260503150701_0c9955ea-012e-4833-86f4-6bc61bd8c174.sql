-- New summary field
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS real_life_example text;

-- Public bucket for HD AI covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Book covers public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

-- Service role writes via edge function (no user policy needed)
CREATE POLICY "Anyone can upload book covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-covers');

CREATE POLICY "Anyone can update book covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'book-covers');