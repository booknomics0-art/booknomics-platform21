-- Apply ONLY to new Supabase project otmjrtigeiuzktunodmb.
-- Hourly quotas for paid audio/AI endpoints authenticated by Supabase JWT.
-- The client cannot set a quota limit or another user's ID.

create table if not exists booknomics_private.premium_feature_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('audio', 'action_plan')),
  created_at timestamptz not null default now()
);
create index if not exists premium_feature_usage_user_idx
  on booknomics_private.premium_feature_usage (user_id, feature, created_at desc);
revoke all on booknomics_private.premium_feature_usage from public, anon, authenticated;

create or replace function public.booknomics_consume_feature_quota(p_feature text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_limit integer := 10;
  v_used integer;
begin
  v_user := (select auth.uid());
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_feature not in ('audio', 'action_plan') then raise exception 'Unknown feature'; end if;

  -- Serialize concurrent calls for the same user and feature, preventing a
  -- race where each request would pass a separate COUNT check.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text || ':' || p_feature));
  select count(*) into v_used
  from booknomics_private.premium_feature_usage
  where user_id = v_user and feature = p_feature
    and created_at > now() - interval '1 hour';
  if v_used >= v_limit then return false; end if;

  insert into booknomics_private.premium_feature_usage (user_id, feature)
  values (v_user, p_feature);
  return true;
end;
$$;

revoke all on function public.booknomics_consume_feature_quota(text) from public, anon;
grant execute on function public.booknomics_consume_feature_quota(text) to authenticated;
