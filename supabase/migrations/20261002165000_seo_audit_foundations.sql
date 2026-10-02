-- SEO audit foundations: explicit translation relationships and persisted GSC page metrics.
-- Applied to production on 2026-10-02; kept here so repository migration history matches production.

alter table public.books
  add column if not exists alternate_book_id uuid null references public.books(id) on delete set null;

create index if not exists books_alternate_book_id_idx
  on public.books(alternate_book_id)
  where alternate_book_id is not null;

create table if not exists public.gsc_page_metrics (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  start_date date not null,
  end_date date not null,
  url text not null,
  clicks double precision not null default 0,
  impressions double precision not null default 0,
  ctr double precision not null default 0,
  position double precision not null default 0,
  captured_at timestamptz not null default now(),
  unique (site_url, start_date, end_date, url)
);

alter table public.gsc_page_metrics enable row level security;

drop policy if exists "Admins can read GSC page metrics" on public.gsc_page_metrics;
create policy "Admins can read GSC page metrics"
on public.gsc_page_metrics
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create index if not exists gsc_page_metrics_url_idx
  on public.gsc_page_metrics(url);

create index if not exists gsc_page_metrics_period_idx
  on public.gsc_page_metrics(end_date desc, start_date desc);
