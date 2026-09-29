
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
