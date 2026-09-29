ALTER TABLE public.books ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_books_language ON public.books(language);