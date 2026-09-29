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