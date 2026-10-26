-- Booknomics's NEW, empty Supabase project only.
-- Apply in the SQL Editor of project otmjrtigeiuzktunodmb.
-- Do not run all of the repository's legacy supabase/migrations here.
-- Public book content and covers remain in Cloudflare D1/R2.
-- Auth identities live in auth.users; never copy legacy passwords or sessions.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  daily_goal_minutes integer not null default 15 check (daily_goal_minutes between 1 and 480),
  streak_count integer not null default 0 check (streak_count >= 0),
  last_active_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null check (char_length(book_id) between 1 and 160),
  -- Snapshot fields let a user's Library render without a D1 join/read.
  book_title text not null,
  book_slug text not null,
  book_author text not null default '',
  book_category text not null default 'Books',
  book_cover_color text not null default '#1f2937',
  book_cover_url text,
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists library_user_created_idx on public.library (user_id, created_at desc);

create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null check (char_length(book_id) between 1 and 160),
  completed boolean not null default false,
  last_read_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists reading_progress_user_idx on public.reading_progress (user_id, last_read_at desc);

create table if not exists public.book_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null check (char_length(book_id) between 1 and 160),
  content text not null check (char_length(content) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists book_notes_user_book_idx on public.book_notes (user_id, book_id, created_at desc);

create table if not exists public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  day_number integer not null check (day_number between 1 and 365),
  done boolean not null default false,
  score integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id, day_number)
);
create index if not exists habit_entries_user_idx on public.habit_entries (user_id, created_at desc);

create table if not exists public.user_book_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  quiz_score integer not null default 0 check (quiz_score >= 0),
  quiz_total integer not null default 0 check (quiz_total >= 0),
  flashcards_reviewed integer not null default 0 check (flashcards_reviewed >= 0),
  badge_awarded boolean not null default false,
  completed_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.path_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, path_id)
);

-- Entitlements and payments are server-owned. Never expose INSERT/UPDATE
-- policies to authenticated users: changing a client value cannot grant premium.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('weekly', 'monthly')),
  status text not null default 'creating' check (status in ('creating','pending','active','failed','expired','cancelled')),
  amount integer not null check (amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  razorpay_subscription_id text unique,
  razorpay_payment_id text,
  provider_status text,
  starts_at timestamptz,
  expires_at timestamptz,
  last_provider_event_at timestamptz,
  cancel_at_cycle_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_created_idx on public.subscriptions (user_id, created_at desc);
create unique index if not exists subscriptions_user_open_idx
  on public.subscriptions (user_id)
  where status in ('creating', 'pending', 'active');

-- Private server tables are never exposed through the public REST API.
create schema if not exists booknomics_private;
revoke all on schema booknomics_private from public, anon, authenticated;
grant usage on schema booknomics_private to service_role;

create table if not exists booknomics_private.razorpay_webhook_events (
  event_id text primary key,
  event_name text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create table if not exists booknomics_private.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
grant select, insert, update, delete on all tables in schema booknomics_private to service_role;

-- User-facing tables: each authenticated user can see/change only their own rows.
alter table public.profiles enable row level security;
alter table public.library enable row level security;
alter table public.reading_progress enable row level security;
alter table public.book_notes enable row level security;
alter table public.habit_entries enable row level security;
alter table public.user_book_mastery enable row level security;
alter table public.path_enrollments enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles own select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "library own select" on public.library for select to authenticated using ((select auth.uid()) = user_id);
create policy "library own insert" on public.library for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "library own update" on public.library for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "library own delete" on public.library for delete to authenticated using ((select auth.uid()) = user_id);

create policy "progress own select" on public.reading_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "progress own insert" on public.reading_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "progress own update" on public.reading_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "notes own select" on public.book_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes own insert" on public.book_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes own update" on public.book_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes own delete" on public.book_notes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "habits own select" on public.habit_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "habits own insert" on public.habit_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habits own update" on public.habit_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habits own delete" on public.habit_entries for delete to authenticated using ((select auth.uid()) = user_id);

create policy "mastery own select" on public.user_book_mastery for select to authenticated using ((select auth.uid()) = user_id);
-- Scores and badges must be issued by the trusted server, not the browser.

create policy "enrollments own select" on public.path_enrollments for select to authenticated using ((select auth.uid()) = user_id);
create policy "enrollments own insert" on public.path_enrollments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "enrollments own delete" on public.path_enrollments for delete to authenticated using ((select auth.uid()) = user_id);

create policy "subscriptions own select only" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
revoke all on public.profiles, public.library, public.reading_progress, public.book_notes,
  public.habit_entries, public.user_book_mastery, public.path_enrollments from anon;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, daily_goal_minutes) on public.profiles to authenticated;
grant select, insert, update, delete on public.library to authenticated;
grant select, insert, update on public.reading_progress to authenticated;
grant select, insert, update, delete on public.book_notes, public.habit_entries to authenticated;
revoke all on public.user_book_mastery from anon, authenticated;
grant select on public.user_book_mastery to authenticated;
grant select, insert, delete on public.path_enrollments to authenticated;

-- Profile creation is automatic after a verified signup/provider login.
create or replace function public.booknomics_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.booknomics_create_profile() from public, anon, authenticated;
drop trigger if exists on_booknomics_auth_user_created on auth.users;
create trigger on_booknomics_auth_user_created
after insert on auth.users for each row execute function public.booknomics_create_profile();

-- Verify an admin role server-side too; never trust a role supplied in user_metadata.
create or replace function public.booknomics_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from booknomics_private.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function public.booknomics_is_admin() from public, anon;
grant execute on function public.booknomics_is_admin() to authenticated;
