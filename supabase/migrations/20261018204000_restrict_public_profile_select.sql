-- Access to public community fields remains; private goal, activity date, and referral code do not.
REVOKE SELECT ON public.profiles FROM anon,authenticated;
GRANT SELECT (id,display_name,avatar_url,created_at,streak_count)
ON public.profiles TO anon,authenticated;
