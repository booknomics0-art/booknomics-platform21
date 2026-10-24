-- Move premium SECURITY DEFINER implementation out of the API exposed public schema.
BEGIN;
-- Non-exposed privileged helper: keeps role/subscription checks on server.
CREATE OR REPLACE FUNCTION private.get_premium_summary_internal(p_book_id uuid)
RETURNS TABLE(
  id uuid, slug text, title text, deep_summary text, deep_analysis text,
  key_ideas text, daily_application text, practice_tracker text,
  reflection_questions text, real_life_example text, action_system text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_tier text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT public.my_active_tier() INTO v_tier;
  IF v_tier IS NULL OR v_tier = 'free' THEN
    IF NOT (public.is_admin_email() OR private.has_role(auth.uid(), 'admin'::public.app_role)) THEN
      RETURN;
    END IF;
  END IF;
  RETURN QUERY
  SELECT b.id,b.slug,b.title,b.deep_summary,b.deep_analysis,b.key_ideas,
         b.daily_application,b.practice_tracker,b.reflection_questions,
         b.real_life_example,b.action_system
  FROM public.books b WHERE b.id=p_book_id AND b.is_draft=false;
END;
$body$;
REVOKE ALL ON FUNCTION private.get_premium_summary_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_premium_summary_internal(uuid) TO authenticated, service_role;
-- Public RPC is unprivileged; anon returns an empty result as before.
CREATE OR REPLACE FUNCTION public.get_premium_summary(p_book_id uuid)
RETURNS TABLE(
  id uuid, slug text, title text, deep_summary text, deep_analysis text,
  key_ideas text, daily_application text, practice_tracker text,
  reflection_questions text, real_life_example text, action_system text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO ''
AS $body$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM private.get_premium_summary_internal(p_book_id);
END;
$body$;
REVOKE ALL ON FUNCTION public.get_premium_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_premium_summary(uuid) TO anon,authenticated;
COMMIT;
