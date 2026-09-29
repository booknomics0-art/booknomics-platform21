
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
