-- Restrict private profile attributes to account owner, preserve public community identity.
-- Use a non-privileged public RPC wrapper and private SECURITY DEFINER helper.
CREATE OR REPLACE FUNCTION private.get_my_profile_extras_internal() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'referral_code', p.referral_code,
      'last_active_date', p.last_active_date,
      'daily_goal_minutes', p.daily_goal_minutes
    ) FROM public.profiles p WHERE p.id = auth.uid()
  ), '{}'::jsonb);
$body$;
REVOKE ALL ON FUNCTION private.get_my_profile_extras_internal() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.get_my_profile_extras_internal() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_my_profile_extras() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $body$
  SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE private.get_my_profile_extras_internal() END;
$body$;
REVOKE ALL ON FUNCTION public.get_my_profile_extras() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_extras() TO authenticated;
