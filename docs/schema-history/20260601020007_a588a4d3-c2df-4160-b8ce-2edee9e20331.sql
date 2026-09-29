
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
