-- Apply ONLY to new Supabase project otmjrtigeiuzktunodmb.
-- A referral earns a profile badge, NOT a paid subscription.

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique default ('BN' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  created_at timestamptz not null default now()
);
create table if not exists public.referral_claims (
  referee_id uuid primary key references auth.users(id) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referee_id <> referrer_id)
);
create index if not exists referral_claims_referrer_idx on public.referral_claims (referrer_id, created_at desc);

alter table public.referral_codes enable row level security;
alter table public.referral_claims enable row level security;
create policy "referral code read own" on public.referral_codes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "referral claims read own" on public.referral_claims
  for select to authenticated using ((select auth.uid()) = referrer_id);
revoke all on public.referral_codes, public.referral_claims from public, anon, authenticated;
grant select on public.referral_codes, public.referral_claims to authenticated;

create or replace function public.booknomics_create_referral_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.referral_codes (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_booknomics_auth_user_referral_created on auth.users;
create trigger on_booknomics_auth_user_referral_created
after insert on auth.users for each row execute function public.booknomics_create_referral_code();
insert into public.referral_codes (user_id)
select id from auth.users on conflict (user_id) do nothing;

create or replace function public.booknomics_claim_referral(p_code text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid;
  v_referrer uuid;
  v_created timestamptz;
  v_inserted integer;
begin
  v_me := (select auth.uid());
  if v_me is null then raise exception 'Sign in required'; end if;
  if p_code is null or upper(p_code) !~ '^BN[A-F0-9]{12}$' then return false; end if;
  select user_id into v_referrer from public.referral_codes where code = upper(p_code);
  if v_referrer is null or v_referrer = v_me then return false; end if;
  select created_at into v_created from auth.users where id = v_me;
  if v_created is null or v_created < now() - interval '7 days' then return false; end if;

  insert into public.referral_claims (referee_id, referrer_id)
  values (v_me, v_referrer) on conflict (referee_id) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;
revoke all on function public.booknomics_claim_referral(text) from public, anon;
grant execute on function public.booknomics_claim_referral(text) to authenticated;
