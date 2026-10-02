-- 20260503135353_3c9ed739-5db4-4cf6-9fd5-7ccefcfbefde

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  cover_color TEXT NOT NULL DEFAULT 'amber',
  tagline TEXT,
  overview TEXT,
  key_ideas TEXT,
  deep_analysis TEXT,
  daily_application TEXT,
  reading_time INT DEFAULT 12,
  rating NUMERIC(3,2) DEFAULT 4.5,
  year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Books are public" ON public.books FOR SELECT USING (true);
-- Supabase Data API grants are explicit on new projects. RLS still controls rows.
GRANT SELECT ON public.books TO anon, authenticated;
GRANT ALL ON public.books TO service_role;

-- Library
CREATE TABLE public.library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own library" ON public.library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users add to own library" ON public.library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own library" ON public.library FOR DELETE USING (auth.uid() = user_id);

-- Auto profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 20260503135437_fbf9f279-0023-41dd-8fbf-a65d82566970
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 20260503140538_458ec9ab-94bd-4f90-8994-e72d11116cd5
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS cover_url text;

-- 20260503140850_d2f53877-e564-4fbe-8dd0-3bf8cf5e69a5
UPDATE public.books AS b SET cover_url = v.url FROM (VALUES ('antifragile','https://covers.openlibrary.org/b/id/9180157-L.jpg'),('atomic-habits','https://books.google.com/books/content?id=WmqyDwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('bhagavad-gita','https://books.google.com/books/content?id=a-Oh_-rK5SQC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('blink','https://covers.openlibrary.org/b/id/14421850-L.jpg'),('can-t-hurt-me','https://books.google.com/books/content?id=IeYmEAAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('deep-work','https://covers.openlibrary.org/b/id/7988607-L.jpg'),('educated','https://books.google.com/books/content?id=JZwpDwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('ego-is-the-enemy','https://books.google.com/books/content?id=8cSZDwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('essentialism','https://books.google.com/books/content?id=q-QdEAAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('flow','https://books.google.com/books/content?id=E51kzgEACAAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('freakonomics','https://covers.openlibrary.org/b/id/11172914-L.jpg'),('getting-things-done','https://books.google.com/books/content?id=ebNDDwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('good-to-great','https://covers.openlibrary.org/b/id/53111-L.jpg'),('grit','https://books.google.com/books/content?id=Xh2rEAAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('hooked','https://books.google.com/books/content?id=dsz5AwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('how-to-win-friends','https://books.google.com/books/content?id=hCf-DwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('influence','https://books.google.com/books/content?id=5dfv0HJ1TEoC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('man-search-meaning','https://books.google.com/books/content?id=umJ8DgAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('meditations','https://books.google.com/books/content?id=VVsmU-4YwFsC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('mindset','https://books.google.com/books/content?id=fT6U0Ee7_kQC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('never-split-the-difference','https://books.google.com/books/content?id=RmdqCgAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('nudge','https://books.google.com/books/content?id=2rUsEAAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('outliers','https://books.google.com/books/content?id=ialrgIT41OAC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('predictably-irrational','https://books.google.com/books/content?id=lwKRgkLNgXsC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('principles','https://covers.openlibrary.org/b/id/8315355-L.jpg'),('range','https://books.google.com/books/content?id=TzG5wgEACAAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('rich-dad-poor-dad','https://books.google.com/books/content?id=kRqeDwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('sapiens','https://books.google.com/books/content?id=FmyBAwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('shoe-dog','https://books.google.com/books/content?id=wO3PCgAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('start-with-why','https://books.google.com/books/content?id=tUaNDQAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-100-startup','https://books.google.com/books/content?id=lSqzcvQLqS0C&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-7-habits','https://covers.openlibrary.org/b/id/10079937-L.jpg'),('the-alchemist','https://books.google.com/books/content?id=FEL8DlqjYEkC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('black-swan','https://books.google.com/books/content?id=gWW4SkJjM08C&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-body-keeps-score','https://covers.openlibrary.org/b/id/8315367-L.jpg'),('the-courage-to-be-disliked','https://books.google.com/books/content?id=hGFEDwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-e-myth','https://books.google.com/books/content?id=HHJVIpbpSgsC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-four-agreements','https://covers.openlibrary.org/b/id/924521-L.jpg'),('the-hard-thing','https://books.google.com/books/content?id=620pAgAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-lean-startup','https://books.google.com/books/content?id=tvfyz-4JILwC&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-obstacle-is-the-way','https://covers.openlibrary.org/b/id/14428233-L.jpg'),('the-one-thing','https://covers.openlibrary.org/b/id/10351762-L.jpg'),('the-power-of-now','https://books.google.com/books/content?id=QFQ7DwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-subtle-art','https://books.google.com/books/content?id=W8bJ0AEACAAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('the-tipping-point','https://covers.openlibrary.org/b/id/10873292-L.jpg'),('the-war-of-art','https://books.google.com/books/content?id=sR3hAAAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('thinking-fast-and-slow','https://books.google.com/books/content?id=TA7Q27RWlj0C&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('when-breath-becomes-air','https://books.google.com/books/content?id=93faCwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('why-we-sleep','https://books.google.com/books/content?id=ZlU3DwAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api'),('zero-to-one','https://books.google.com/books/content?id=POOJDQAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api')) AS v(slug,url) WHERE b.slug = v.slug;

-- 20260503143637_dd781ee1-8b7e-4035-9861-a1273189ca04
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS idx_books_language ON public.books(language);

-- 20260503145809_d6571f38-8287-4e22-b3fa-5baaf2a2ab30
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS action_system text,
  ADD COLUMN IF NOT EXISTS practice_tracker text,
  ADD COLUMN IF NOT EXISTS reflection_questions text;

-- 20260503150701_0c9955ea-012e-4833-86f4-6bc61bd8c174
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

-- 20260503150811_fce680e3-46fe-41ae-986a-9b1e9c77a86b
DROP POLICY IF EXISTS "Book covers public read" ON storage.objects;
CREATE POLICY "Book covers direct read"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers' AND name IS NOT NULL);
-- Note: Supabase public bucket still serves files via /object/public/... regardless of list policy.


-- 20260504062258_bbc7ecc1-668d-4266-81b0-d9d629bf1bcc

-- 1. Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('starter','pro')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','cancelled','expired')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_order ON public.subscriptions(razorpay_order_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 2. has_active_subscription helper
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- 3. Habit entries (7-day tracker per book)
CREATE TABLE public.habit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  book_id UUID NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  done BOOLEAN NOT NULL DEFAULT false,
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id, day_number)
);
ALTER TABLE public.habit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own habit entries select" ON public.habit_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own habit entries insert" ON public.habit_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own habit entries update" ON public.habit_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own habit entries delete" ON public.habit_entries FOR DELETE USING (auth.uid() = user_id);

-- 4. Book notes
CREATE TABLE public.book_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  book_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notes select own" ON public.book_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notes insert own" ON public.book_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notes update own" ON public.book_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Notes delete own" ON public.book_notes FOR DELETE USING (auth.uid() = user_id);

-- 5. Reading progress
CREATE TABLE public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  book_id UUID NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Progress select own" ON public.reading_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Progress insert own" ON public.reading_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Progress update own" ON public.reading_progress FOR UPDATE USING (auth.uid() = user_id);

-- 6. Profile streak fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- 7. updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_habit_updated BEFORE UPDATE ON public.habit_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON public.book_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- 20260504062322_ead3e885-b1bd-4f92-aa1c-b32ef513e9d4

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;


-- 20260506073135_71f04792-3aec-4347-9dbe-9d99b8c02795

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


-- 20260507063127_7b513f9b-6bb6-4888-82b4-def128f7f638
UPDATE books SET overview = (SELECT overview FROM (VALUES (1)) AS t(x)) WHERE false; -- placeholder, real SQL below


-- 20260508155059_ea61aeeb-1717-4ed9-9674-de6778f0a095

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


-- 20260508175303_c6ca5182-9c79-4dc2-ab09-b95b031a75e7

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add draft flag to books
ALTER TABLE public.books ADD COLUMN is_draft boolean NOT NULL DEFAULT true;

-- Existing books should remain published
UPDATE public.books SET is_draft = false;

-- Replace public select policy
DROP POLICY IF EXISTS "Books are public" ON public.books;

CREATE POLICY "Published books are public"
ON public.books FOR SELECT
USING (is_draft = false);

CREATE POLICY "Admins see all books"
ON public.books FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert books"
ON public.books FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update books"
ON public.books FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete books"
ON public.books FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


-- 20260508181401_34853efa-531a-4e4e-91d6-eb31e75f9f19
-- Historical blanket admin seed intentionally disabled for new installations.
-- Assign the verified owner explicitly after migrating users; see docs/DEPLOYMENT.md.


-- 20260509031420_c2b29adf-acdb-40fd-8818-58fd9120e3e7
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_books_status ON public.books(status);

-- 20260510030626_b3bd9478-ea10-45c4-880f-787178fa254d

-- Discussions: questions asked on books with AI-generated expert perspective
CREATE TABLE public.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  expert_perspective TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_discussions_book ON public.discussions(book_id, created_at DESC);
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Discussions are public" ON public.discussions FOR SELECT USING (true);
CREATE POLICY "Users create own discussions" ON public.discussions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own discussions" ON public.discussions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own discussions" ON public.discussions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all discussions" ON public.discussions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER discussions_touch BEFORE UPDATE ON public.discussions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Replies
CREATE TABLE public.discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_replies_discussion ON public.discussion_replies(discussion_id, created_at);
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Replies public" ON public.discussion_replies FOR SELECT USING (true);
CREATE POLICY "Users create own replies" ON public.discussion_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own replies" ON public.discussion_replies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Helpful votes (one per user per discussion)
CREATE TABLE public.discussion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(discussion_id, user_id)
);
ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes public" ON public.discussion_votes FOR SELECT USING (true);
CREATE POLICY "Users create own votes" ON public.discussion_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own votes" ON public.discussion_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Counter triggers
CREATE OR REPLACE FUNCTION public.bump_helpful_count() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.discussions SET helpful_count = helpful_count + 1 WHERE id = NEW.discussion_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.discussions SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.discussion_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER votes_count AFTER INSERT OR DELETE ON public.discussion_votes FOR EACH ROW EXECUTE FUNCTION public.bump_helpful_count();

CREATE OR REPLACE FUNCTION public.bump_reply_count() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.discussions SET reply_count = reply_count + 1 WHERE id = NEW.discussion_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.discussions SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.discussion_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER replies_count AFTER INSERT OR DELETE ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.bump_reply_count();


-- 20260510090538_d01364a3-acd3-4563-b429-14655724c6ee

-- 1. book_modules: replace blanket public read with premium-aware policy
DROP POLICY IF EXISTS "Modules are public" ON public.book_modules;

CREATE POLICY "Free modules public, premium gated"
ON public.book_modules
FOR SELECT
TO public
USING (
  is_premium = false
  OR (auth.uid() IS NOT NULL AND public.has_active_subscription(auth.uid()))
  OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
);

-- 2. storage.objects: restrict book-covers writes to admins only
DROP POLICY IF EXISTS "Anyone can upload book covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update book covers" ON storage.objects;

CREATE POLICY "Admins upload book covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update book covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete book covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role));


-- 20260511030454_603de565-0254-4747-ab66-106bf9d9d249

-- REACTIONS
CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('helpful','powerful','insightful','applied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id, type)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions public read" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Users add own reaction" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reaction" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_reactions_book ON public.reactions(book_id);

-- COMMUNITY POINTS LEDGER
CREATE TABLE public.community_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Points public read" ON public.community_points FOR SELECT USING (true);
CREATE INDEX idx_points_user ON public.community_points(user_id);
CREATE INDEX idx_points_created ON public.community_points(created_at DESC);

-- AWARD HELPER
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _points int, _reason text, _ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.community_points(user_id, points, reason, ref_id)
  VALUES (_user_id, _points, _reason, _ref);
END $$;

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.tg_award_book_complete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed = true AND (OLD.completed IS DISTINCT FROM true) THEN
    PERFORM public.award_points(NEW.user_id, 20, 'book_completed', NEW.book_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_book_complete
AFTER INSERT OR UPDATE ON public.reading_progress
FOR EACH ROW EXECUTE FUNCTION public.tg_award_book_complete();

CREATE OR REPLACE FUNCTION public.tg_award_discussion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 5, 'comment', NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_award_discussion AFTER INSERT ON public.discussions
FOR EACH ROW EXECUTE FUNCTION public.tg_award_discussion();
CREATE TRIGGER trg_award_reply AFTER INSERT ON public.discussion_replies
FOR EACH ROW EXECUTE FUNCTION public.tg_award_discussion();

CREATE OR REPLACE FUNCTION public.tg_award_library_save() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 3, 'saved_insight', NEW.book_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_award_library AFTER INSERT ON public.library
FOR EACH ROW EXECUTE FUNCTION public.tg_award_library_save();

CREATE OR REPLACE FUNCTION public.tg_award_helpful_vote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author uuid;
BEGIN
  SELECT user_id INTO _author FROM public.discussions WHERE id = NEW.discussion_id;
  IF _author IS NOT NULL AND _author <> NEW.user_id THEN
    PERFORM public.award_points(_author, 10, 'helpful_vote_received', NEW.discussion_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_award_helpful AFTER INSERT ON public.discussion_votes
FOR EACH ROW EXECUTE FUNCTION public.tg_award_helpful_vote();

-- LEADERBOARD VIEW
CREATE OR REPLACE VIEW public.leaderboard_view
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  p.streak_count,
  COALESCE((SELECT SUM(points) FROM public.community_points cp WHERE cp.user_id = p.id), 0)::int AS total_points,
  COALESCE((SELECT COUNT(*) FROM public.reading_progress rp WHERE rp.user_id = p.id AND rp.completed = true), 0)::int AS books_completed,
  COALESCE((SELECT COUNT(*) FROM public.discussions d WHERE d.user_id = p.id), 0)::int +
  COALESCE((SELECT COUNT(*) FROM public.discussion_replies dr WHERE dr.user_id = p.id), 0)::int AS comments_count
FROM public.profiles p;

GRANT SELECT ON public.leaderboard_view TO anon, authenticated;


-- 20260511030518_921f6a8e-df75-4415-92d0-9ff7d864fe8b

REVOKE ALL ON FUNCTION public.award_points(uuid,int,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_book_complete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_discussion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_library_save() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_helpful_vote() FROM PUBLIC, anon, authenticated;


-- 20260512031955_3dfce988-0274-417d-ae7c-39f550894a63
-- Extend reactions table for comment-level reactions
ALTER TABLE public.reactions ADD COLUMN IF NOT EXISTS comment_id uuid;

-- Unique constraint: one reaction per user per (book, comment, type). NULL comment_id = book reaction.
CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique_idx
  ON public.reactions (user_id, book_id, COALESCE(comment_id, '00000000-0000-0000-0000-000000000000'::uuid), type);

-- Threaded comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  helpful_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_solved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_book_idx ON public.comments(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.comments(parent_comment_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments public read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users create own comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all comments" ON public.comments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER comments_touch BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Award 5 points per comment
CREATE OR REPLACE FUNCTION public.tg_award_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 5, 'comment', NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_award_comment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER comments_award_points AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_comment();

-- Bump helpful_count on comments via comment-level reactions of type 'helpful'
CREATE OR REPLACE FUNCTION public.tg_bump_comment_helpful()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.comment_id IS NOT NULL AND NEW.type = 'helpful' THEN
    UPDATE public.comments SET helpful_count = helpful_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' AND OLD.comment_id IS NOT NULL AND OLD.type = 'helpful' THEN
    UPDATE public.comments SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_bump_comment_helpful() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reactions_bump_comment_helpful ON public.reactions;
CREATE TRIGGER reactions_bump_comment_helpful
  AFTER INSERT OR DELETE ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_comment_helpful();

-- 20260516021855_955a27c6-f0e7-4c15-863b-438db07d4a26
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image text;

-- 20260522023144_c2f06c62-4f3e-46e3-96f7-f7e4e39ea127
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS deep_summary text;

-- 20260531020048_67608fd9-58e7-455c-b011-2b48cf92fe1d

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


-- 20260531020118_de8c71fb-067c-4ccf-8ace-43a3c5835073

-- Recreate gen_referral_code with explicit search_path and lock down EXECUTE
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

REVOKE ALL ON FUNCTION public.gen_referral_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_referral_code() TO service_role;

-- handle_new_user is a trigger fn; revoke direct execution from clients
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- 20260601020007_a588a4d3-c2df-4160-b8ce-2edee9e20331

-- Add daily goal to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_goal_minutes integer NOT NULL DEFAULT 10;

-- Learning paths
CREATE TABLE public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  theme_color text NOT NULL DEFAULT 'amber',
  icon text NOT NULL DEFAULT 'sparkles',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.learning_paths TO anon;
GRANT SELECT ON public.learning_paths TO authenticated;
GRANT ALL ON public.learning_paths TO service_role;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Paths are public" ON public.learning_paths FOR SELECT USING (true);

CREATE TABLE public.learning_path_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  position integer NOT NULL,
  UNIQUE(path_id, book_id)
);
CREATE INDEX idx_lpb_path ON public.learning_path_books(path_id, position);
GRANT SELECT ON public.learning_path_books TO anon;
GRANT SELECT ON public.learning_path_books TO authenticated;
GRANT ALL ON public.learning_path_books TO service_role;
ALTER TABLE public.learning_path_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Path books are public" ON public.learning_path_books FOR SELECT USING (true);

CREATE TABLE public.path_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, path_id)
);
GRANT SELECT, INSERT, DELETE ON public.path_enrollments TO authenticated;
GRANT ALL ON public.path_enrollments TO service_role;
ALTER TABLE public.path_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own enrollments" ON public.path_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users enroll self" ON public.path_enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unenroll self" ON public.path_enrollments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed paths
INSERT INTO public.learning_paths (slug, title, description, theme_color, icon, sort_order) VALUES
  ('wealth-path', 'The Wealth Path', 'Build financial intelligence from money mindset to investing fundamentals.', 'emerald', 'trending-up', 1),
  ('mental-toughness', 'Mental Toughness', 'Forge resilience, discipline, and an unshakeable mind.', 'orange', 'flame', 2),
  ('productivity-pro', 'Productivity Pro', 'Master focus, prioritization, and getting the right things done.', 'blue', 'target', 3),
  ('mindset-mastery', 'Mindset Mastery', 'Reprogram beliefs and rewire how you think for life.', 'purple', 'brain', 4),
  ('influence-communication', 'Influence & Communication', 'Win people, negotiate well, and lead with clarity.', 'rose', 'message-circle', 5);

-- Seed path books (ordered)
WITH p AS (SELECT id, slug FROM public.learning_paths), b AS (SELECT id, slug FROM public.books)
INSERT INTO public.learning_path_books (path_id, book_id, position)
SELECT p.id, b.id, x.pos FROM (VALUES
  ('wealth-path','rich-dad-poor-dad',1),
  ('wealth-path','principles',2),
  ('wealth-path','the-intelligent-investor-cmkh',3),
  ('wealth-path','the-100-startup',4),
  ('wealth-path','zero-to-one',5),
  ('mental-toughness','can-t-hurt-me',1),
  ('mental-toughness','grit',2),
  ('mental-toughness','the-obstacle-is-the-way',3),
  ('mental-toughness','ego-is-the-enemy',4),
  ('mental-toughness','meditations',5),
  ('productivity-pro','atomic-habits',1),
  ('productivity-pro','deep-work',2),
  ('productivity-pro','essentialism',3),
  ('productivity-pro','the-one-thing',4),
  ('productivity-pro','getting-things-done',5),
  ('mindset-mastery','mindset',1),
  ('mindset-mastery','the-power-of-your-subconscious-mind-6znj',2),
  ('mindset-mastery','thinking-fast-and-slow',3),
  ('mindset-mastery','the-7-habits',4),
  ('mindset-mastery','man-search-meaning',5),
  ('influence-communication','how-to-win-friends',1),
  ('influence-communication','never-split-the-difference',2),
  ('influence-communication','influence',3),
  ('influence-communication','start-with-why',4),
  ('influence-communication','the-subtle-art',5)
) AS x(path_slug, book_slug, pos)
JOIN p ON p.slug = x.path_slug
JOIN b ON b.slug = x.book_slug;


-- 20260605034918_1869c785-a838-4f5c-b0f9-bca2360f06a1

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


-- 20260606023806_c407bd4e-31b0-458b-850c-22b37d5582a8

-- App settings (admin-only key/value, e.g. n8n_webhook_url)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_app_settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Promotion logs (n8n dispatch history)
CREATE TABLE public.promotion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  book_title TEXT,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed
  http_status INT,
  response TEXT,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_logs TO authenticated;
GRANT ALL ON public.promotion_logs TO service_role;
ALTER TABLE public.promotion_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage promotion_logs" ON public.promotion_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_promotion_logs_book ON public.promotion_logs(book_id);
CREATE INDEX idx_promotion_logs_created ON public.promotion_logs(created_at DESC);


-- 20260608022021_73ef1dd8-6ac6-4b22-8991-7d4a35d1d688
ALTER TABLE public.book_assets ADD COLUMN IF NOT EXISTS chapter_markers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 20260608141824_be57c6dd-98e0-4c81-86db-63c6a4e68a2f

CREATE OR REPLACE FUNCTION public.published_today_count_ist()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.books
  WHERE is_draft = false
    AND (created_at AT TIME ZONE 'Asia/Kolkata')::date
        = (now() AT TIME ZONE 'Asia/Kolkata')::date;
$$;

GRANT EXECUTE ON FUNCTION public.published_today_count_ist() TO authenticated;


-- 20260608141855_87693f86-624b-49c5-824d-bc8467d04c25

CREATE OR REPLACE FUNCTION public.published_today_count_ist()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.books
  WHERE is_draft = false
    AND (created_at AT TIME ZONE 'Asia/Kolkata')::date
        = (now() AT TIME ZONE 'Asia/Kolkata')::date;
$$;
REVOKE EXECUTE ON FUNCTION public.published_today_count_ist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_today_count_ist() TO authenticated, anon;


-- 20260608141938_06fad8dc-b191-4512-8fe1-d3c3b90f6566

CREATE TABLE public.admin_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempted_email TEXT,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed','denied')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_access_logs TO authenticated;
GRANT ALL ON public.admin_access_logs TO service_role;

ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can record an access attempt"
  ON public.admin_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can read access logs"
  ON public.admin_access_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX admin_access_logs_created_at_idx
  ON public.admin_access_logs (created_at DESC);


-- 20260609023615_29b8792e-fb65-41c3-a944-12ea54b10dbe

-- Tighten community_points: only owner can read own activity
DROP POLICY IF EXISTS "Points public read" ON public.community_points;
CREATE POLICY "Users read own points"
ON public.community_points
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Tighten referrals: only parties involved can read
DROP POLICY IF EXISTS "Referrals public read" ON public.referrals;
CREATE POLICY "Users read own referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- Tighten affiliate_clicks INSERT: prevent spoofing other users' user_id
DROP POLICY IF EXISTS "Anyone can log affiliate click" ON public.affiliate_clicks;
CREATE POLICY "Log affiliate click (own or anon)"
ON public.affiliate_clicks
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());


-- 20260622165500_28ca0ecf-e134-46e8-9e70-2426fe38768e

-- Helper: admin email check via JWT (no recursion, no user_roles dependency)
CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'amansrivast2104@gmail.com'
$$;

-- updated_at trigger fn (reuse if exists)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================================================
-- seo_audits
-- =========================================================
CREATE TABLE public.seo_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  url text NOT NULL,
  on_page_score int,
  off_page_score int,
  polishing_score int,
  humanized_score int,
  seo_readiness_score int,
  indexed_status text,
  average_position numeric,
  clicks int DEFAULT 0,
  impressions int DEFAULT 0,
  ctr numeric,
  top_queries jsonb DEFAULT '[]'::jsonb,
  audit_details jsonb DEFAULT '{}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seo_audits_book_id_idx ON public.seo_audits(book_id);
CREATE INDEX seo_audits_url_idx ON public.seo_audits(url);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_audits TO authenticated;
GRANT ALL ON public.seo_audits TO service_role;
ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages seo_audits" ON public.seo_audits FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER seo_audits_touch BEFORE UPDATE ON public.seo_audits
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- seo_indexing_jobs
-- =========================================================
CREATE TABLE public.seo_indexing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  gsc_status text,
  last_checked_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seo_indexing_jobs_status_idx ON public.seo_indexing_jobs(status);
CREATE INDEX seo_indexing_jobs_book_id_idx ON public.seo_indexing_jobs(book_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_indexing_jobs TO authenticated;
GRANT ALL ON public.seo_indexing_jobs TO service_role;
ALTER TABLE public.seo_indexing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages seo_indexing_jobs" ON public.seo_indexing_jobs FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER seo_indexing_jobs_touch BEFORE UPDATE ON public.seo_indexing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- social_accounts
-- =========================================================
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_name text,
  profile_url text,
  connected boolean NOT NULL DEFAULT false,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX social_accounts_platform_idx ON public.social_accounts(platform);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages social_accounts" ON public.social_accounts FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER social_accounts_touch BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- social_posts
-- =========================================================
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  platform text NOT NULL,
  post_type text,
  content text,
  media_url text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_posts_book_idx ON public.social_posts(book_id);
CREATE INDEX social_posts_platform_status_idx ON public.social_posts(platform, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages social_posts" ON public.social_posts FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER social_posts_touch BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- backlink_records
-- =========================================================
CREATE TABLE public.backlink_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  target_url text NOT NULL,
  anchor_text text,
  domain text,
  status text DEFAULT 'planned',
  dofollow boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX backlink_records_book_idx ON public.backlink_records(book_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backlink_records TO authenticated;
GRANT ALL ON public.backlink_records TO service_role;
ALTER TABLE public.backlink_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages backlink_records" ON public.backlink_records FOR ALL TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE TRIGGER backlink_records_touch BEFORE UPDATE ON public.backlink_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- url_redirects
-- =========================================================
CREATE TABLE public.url_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_path text NOT NULL UNIQUE,
  new_path text NOT NULL,
  status_code int NOT NULL DEFAULT 301,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.url_redirects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.url_redirects TO authenticated;
GRANT ALL ON public.url_redirects TO service_role;
ALTER TABLE public.url_redirects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read redirects" ON public.url_redirects FOR SELECT USING (true);
CREATE POLICY "Admin writes redirects" ON public.url_redirects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_email());
CREATE POLICY "Admin updates redirects" ON public.url_redirects FOR UPDATE TO authenticated
  USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
CREATE POLICY "Admin deletes redirects" ON public.url_redirects FOR DELETE TO authenticated
  USING (public.is_admin_email());
CREATE TRIGGER url_redirects_touch BEFORE UPDATE ON public.url_redirects
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();


-- 20260622165527_169f20a1-d8fc-4fb2-af46-605e66868a1e

CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'amansrivast2104@gmail.com'
$$;


-- 20260624200856_c952efe1-ee15-41ce-a936-e1f08b4b6397

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan = ANY (ARRAY['starter','pro','free','weekly','monthly','quarterly']));

DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.get_active_tier(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
     WHERE user_id = _user_id
       AND status = 'active'
       AND plan IN ('weekly','monthly','quarterly')
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY expires_at DESC NULLS LAST, created_at DESC
     LIMIT 1),
    'free'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_active_tier(uuid) TO authenticated, anon, service_role;


-- 20260624200926_97f00f68-9d9a-4878-8da6-08dac0dd07c3

REVOKE EXECUTE ON FUNCTION public.get_active_tier(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.get_active_tier(uuid);

CREATE OR REPLACE FUNCTION public.my_active_tier()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
     WHERE user_id = auth.uid()
       AND status = 'active'
       AND plan IN ('weekly','monthly','quarterly')
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY expires_at DESC NULLS LAST, created_at DESC
     LIMIT 1),
    'free'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.my_active_tier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_active_tier() TO authenticated, service_role;


-- 20260708181051_f2f30919-0cba-4d24-836b-3fbc18421718

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS seo_slug text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS old_slugs text[] DEFAULT '{}'::text[];

CREATE UNIQUE INDEX IF NOT EXISTS books_seo_slug_unique
  ON public.books (seo_slug) WHERE seo_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS books_old_slugs_gin
  ON public.books USING gin (old_slugs);

CREATE OR REPLACE FUNCTION public.tg_track_slug_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Track changes to canonical slug
  IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD.slug IS NOT NULL AND length(OLD.slug) > 0 THEN
    IF NOT (COALESCE(NEW.old_slugs, '{}'::text[]) @> ARRAY[OLD.slug]) THEN
      NEW.old_slugs := array_append(COALESCE(NEW.old_slugs, '{}'::text[]), OLD.slug);
    END IF;
  END IF;
  -- Track changes to seo_slug (the keyword URL)
  IF NEW.seo_slug IS DISTINCT FROM OLD.seo_slug AND OLD.seo_slug IS NOT NULL AND length(OLD.seo_slug) > 0 THEN
    IF NOT (COALESCE(NEW.old_slugs, '{}'::text[]) @> ARRAY[OLD.seo_slug]) THEN
      NEW.old_slugs := array_append(COALESCE(NEW.old_slugs, '{}'::text[]), OLD.seo_slug);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_track_slug_history ON public.books;
CREATE TRIGGER trg_books_track_slug_history
  BEFORE UPDATE OF slug, seo_slug ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.tg_track_slug_history();


-- 20260803051516_c1443c25-e502-4c45-be40-0e8de2b79a6c
update public.books set seo_slug = 'aansu-jaishankar-prasad-saransh-in-hindi' where slug = 'aansu';
update public.books set seo_slug = 'tamas-bhisham-sahni-saransh-in-hindi' where slug = 'tamas';
update public.books set seo_slug = 'black-swan-summary-key-lessons' where slug = 'black-swan';

-- 20260812181329_47ce3746-3192-4252-8f0f-14a124c7315d
-- 1) Remove blanket read access on books from public roles
REVOKE SELECT ON public.books FROM anon;
REVOKE SELECT ON public.books FROM authenticated;

-- 2) Re-grant read access ONLY on free/public columns
GRANT SELECT (
  id, slug, title, author, category, cover_color, tagline, overview,
  reading_time, rating, year, created_at, cover_url, language,
  affiliate_link, is_draft, status, meta_title, meta_description,
  og_image, seo_slug, seo_keywords, old_slugs
) ON public.books TO anon, authenticated;

GRANT ALL ON public.books TO service_role;

-- 3) Admin-only full-access view (runs with owner rights, gated by admin check)
DROP VIEW IF EXISTS public.books_admin;
CREATE VIEW public.books_admin
WITH (security_invoker = false) AS
SELECT * FROM public.books
WHERE public.is_admin_email() OR public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.books_admin TO authenticated;

-- 4) Premium content only for users with an active paid tier (server-enforced)
CREATE OR REPLACE FUNCTION public.get_premium_summary(p_book_id uuid)
RETURNS TABLE (
  id uuid, slug text, title text, deep_summary text, deep_analysis text,
  key_ideas text, daily_application text, practice_tracker text,
  reflection_questions text, real_life_example text, action_system text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.my_active_tier() INTO v_tier;

  IF v_tier IS NULL OR v_tier = 'free' THEN
    IF NOT (public.is_admin_email() OR public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'Premium subscription required';
    END IF;
  END IF;

  RETURN QUERY
  SELECT b.id, b.slug, b.title, b.deep_summary, b.deep_analysis,
         b.key_ideas, b.daily_application, b.practice_tracker,
         b.reflection_questions, b.real_life_example, b.action_system
  FROM public.books b
  WHERE b.id = p_book_id AND b.is_draft = false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_premium_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_premium_summary(uuid) TO authenticated;

-- 20260928190145_migration_hardening
-- Apply only after the original migrations, before importing data.
BEGIN;
-- Preserve old policy references while removing the previous owner's email bypass.
CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

-- The archive contains policies for this bucket, but never creates the bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-assets', 'book-assets', true) ON CONFLICT (id) DO NOTHING;

-- Uniqueness makes payment/order replay detectable. Abort if existing data conflicts.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_unique_order
ON public.subscriptions (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_unique_payment
ON public.subscriptions (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Explicit writes for projects whose default grants do not expose new tables.
GRANT SELECT, INSERT, DELETE ON public.library TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.books TO authenticated;
-- Books SELECT remains column-restricted by the preceding premium migration.
REVOKE EXECUTE ON FUNCTION public.get_premium_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_premium_summary(uuid) TO authenticated;

-- An owner-written audit trail for every book edit, including MCP changes.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE private.book_edit_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id uuid NOT NULL,
  actor_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb NOT NULL,
  new_data jsonb NOT NULL
);
ALTER TABLE private.book_edit_audit ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION private.audit_book_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Trigger-only function; interactive callers need a verified administrator.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator role required';
  END IF;
  INSERT INTO private.book_edit_audit(book_id, actor_id, old_data, new_data)
  VALUES (NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_book_edit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_book_edit AFTER UPDATE ON public.books
FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION private.audit_book_edit();
COMMIT;

