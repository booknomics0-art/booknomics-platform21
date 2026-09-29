
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
