
-- book_assets: one row per book holding learning assets
CREATE TABLE IF NOT EXISTS public.book_assets (
  book_id uuid PRIMARY KEY REFERENCES public.books(id) ON DELETE CASCADE,
  mindmap_url text,
  audio_url text,
  quiz_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  flashcard_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.book_assets TO anon, authenticated;
GRANT ALL ON public.book_assets TO service_role;
ALTER TABLE public.book_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "book_assets readable to all" ON public.book_assets FOR SELECT USING (true);
CREATE POLICY "book_assets admin write" ON public.book_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER book_assets_touch BEFORE UPDATE ON public.book_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- user mastery progress
CREATE TABLE IF NOT EXISTS public.user_book_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quiz_score integer NOT NULL DEFAULT 0,
  quiz_total integer NOT NULL DEFAULT 0,
  flashcards_reviewed integer NOT NULL DEFAULT 0,
  badge_awarded boolean NOT NULL DEFAULT false,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_book_mastery TO authenticated;
GRANT ALL ON public.user_book_mastery TO service_role;
ALTER TABLE public.user_book_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mastery self read" ON public.user_book_mastery FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mastery self insert" ON public.user_book_mastery FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mastery self update" ON public.user_book_mastery FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage policies for the book-assets bucket
CREATE POLICY "book-assets public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'book-assets');
CREATE POLICY "book-assets admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "book-assets admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'book-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "book-assets admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-assets' AND public.has_role(auth.uid(), 'admin'));
