
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
