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