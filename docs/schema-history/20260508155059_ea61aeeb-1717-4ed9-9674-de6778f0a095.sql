
CREATE TABLE public.book_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  part_number int NOT NULL,
  part_key text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_premium boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, part_number, language)
);

CREATE INDEX idx_book_modules_book ON public.book_modules(book_id, part_number);

ALTER TABLE public.book_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modules are public" ON public.book_modules FOR SELECT USING (true);

CREATE TRIGGER trg_book_modules_updated
BEFORE UPDATE ON public.book_modules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
