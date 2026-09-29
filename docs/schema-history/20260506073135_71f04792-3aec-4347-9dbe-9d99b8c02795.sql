
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS affiliate_link text;

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  user_id uuid,
  source text NOT NULL DEFAULT 'amazon',
  placement text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log affiliate click"
ON public.affiliate_clicks FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_book ON public.affiliate_clicks(book_id);
