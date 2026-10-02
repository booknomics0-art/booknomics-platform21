-- User demand loop: authenticated readers can request books; admins can triage demand.
create table if not exists public.book_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  author text,
  language text not null default 'en' check (language in ('en','hi','other')),
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'new' check (status in ('new','planned','in_progress','published','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists book_requests_user_title_author_uidx
  on public.book_requests (user_id, lower(btrim(title)), lower(btrim(coalesce(author, ''))));

create index if not exists book_requests_created_idx on public.book_requests(created_at desc);
create index if not exists book_requests_status_idx on public.book_requests(status, created_at desc);

alter table public.book_requests enable row level security;

drop policy if exists "Users view own book requests" on public.book_requests;
create policy "Users view own book requests"
  on public.book_requests for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Users create own book requests" on public.book_requests;
create policy "Users create own book requests"
  on public.book_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Admins update book requests" on public.book_requests;
create policy "Admins update book requests"
  on public.book_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins delete book requests" on public.book_requests;
create policy "Admins delete book requests"
  on public.book_requests for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

grant select, insert, update, delete on public.book_requests to authenticated;
grant all on public.book_requests to service_role;

create or replace function public.enforce_book_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.book_requests
    where user_id = new.user_id
      and created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Daily book request limit reached';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_book_request_rate_limit() from public, anon, authenticated;

drop trigger if exists trg_book_request_rate_limit on public.book_requests;
create trigger trg_book_request_rate_limit
before insert on public.book_requests
for each row execute function public.enforce_book_request_rate_limit();

drop trigger if exists trg_book_requests_updated_at on public.book_requests;
create trigger trg_book_requests_updated_at
before update on public.book_requests
for each row execute function public.touch_updated_at();
