ALTER TABLE public.books ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_books_status ON public.books(status);