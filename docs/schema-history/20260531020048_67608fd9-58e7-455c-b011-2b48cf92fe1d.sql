
-- ============ REVIEWS ============
CREATE TABLE public.book_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text NOT NULL DEFAULT '',
  upvote_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);
CREATE INDEX idx_book_reviews_book ON public.book_reviews(book_id, upvote_count DESC, created_at DESC);

GRANT SELECT ON public.book_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_reviews TO authenticated;
GRANT ALL ON public.book_reviews TO service_role;

ALTER TABLE public.book_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews public read" ON public.book_reviews FOR SELECT USING (true);
CREATE POLICY "Users create own review" ON public.book_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own review" ON public.book_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own review" ON public.book_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_book_reviews_updated_at
BEFORE UPDATE ON public.book_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ REVIEW UPVOTES ============
CREATE TABLE public.review_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.book_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
CREATE INDEX idx_review_upvotes_review ON public.review_upvotes(review_id);

GRANT SELECT ON public.review_upvotes TO anon;
GRANT SELECT, INSERT, DELETE ON public.review_upvotes TO authenticated;
GRANT ALL ON public.review_upvotes TO service_role;

ALTER TABLE public.review_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Upvotes public read" ON public.review_upvotes FOR SELECT USING (true);
CREATE POLICY "Users add own upvote" ON public.review_upvotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own upvote" ON public.review_upvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_bump_review_upvote()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.book_reviews SET upvote_count = upvote_count + 1 WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.book_reviews SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_review_upvote_ins AFTER INSERT ON public.review_upvotes
FOR EACH ROW EXECUTE FUNCTION public.tg_bump_review_upvote();
CREATE TRIGGER trg_review_upvote_del AFTER DELETE ON public.review_upvotes
FOR EACH ROW EXECUTE FUNCTION public.tg_bump_review_upvote();

-- ============ REFERRALS ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

-- Backfill existing profiles
UPDATE public.profiles SET referral_code = public.gen_referral_code() WHERE referral_code IS NULL;

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);

GRANT SELECT ON public.referrals TO anon;
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrals public read" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "Users record own referral" ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referred_user_id AND referrer_user_id <> referred_user_id);

-- Update handle_new_user to auto-assign a referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    public.gen_referral_code()
  );
  RETURN NEW;
END;
$$;
