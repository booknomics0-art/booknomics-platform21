-- Booknomics audiobook-summary queue.
-- Additive migration: does not modify existing book content or existing audio URLs.

create table if not exists public.audio_summary_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  book_id uuid not null references public.books(id) on delete cascade,
  language text not null check (language in ('en', 'hi')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  priority integer not null default 100,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  worker_id text,
  locked_at timestamptz,
  source_field text,
  source_chars integer,
  script_words integer,
  audio_url text,
  audio_duration_seconds numeric,
  tts_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists audio_summary_jobs_status_language_priority_idx
  on public.audio_summary_jobs (status, language, priority, created_at);

create index if not exists audio_summary_jobs_batch_idx
  on public.audio_summary_jobs (batch_id, status);

create index if not exists audio_summary_jobs_book_idx
  on public.audio_summary_jobs (book_id, created_at desc);

create unique index if not exists audio_summary_jobs_one_active_per_book_idx
  on public.audio_summary_jobs (book_id)
  where status in ('queued', 'processing');

alter table public.audio_summary_jobs enable row level security;

-- No client policies by design. The TTS worker uses the Supabase service role.

create or replace function public.enqueue_audio_summary_batch(
  p_language text default 'en',
  p_limit integer default 100
)
returns table(batch_id uuid, queued_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_count bigint := 0;
begin
  if lower(p_language) not in ('en', 'hi') then
    raise exception 'Unsupported language: %', p_language;
  end if;

  if p_limit < 1 or p_limit > 100 then
    raise exception 'Batch size must be between 1 and 100';
  end if;

  with picked as (
    select b.id,
           case when lower(b.language) = 'hi' then 'hi' else 'en' end as normalized_language,
           greatest(length(coalesce(b.deep_analysis, '')), length(coalesce(b.deep_summary, ''))) as best_source_chars
    from public.books b
    left join public.book_assets ba on ba.book_id = b.id
    where lower(b.language) = lower(p_language)
      and b.is_draft = false
      and b.status in ('published', 'published_noindex')
      and coalesce(ba.audio_url, '') = ''
      and greatest(length(coalesce(b.deep_analysis, '')), length(coalesce(b.deep_summary, ''))) >= 9000
      and not exists (
        select 1
        from public.audio_summary_jobs j
        where j.book_id = b.id
          and j.status in ('queued', 'processing')
      )
    order by
      case when b.status = 'published' then 0 else 1 end,
      b.created_at asc,
      b.id
    limit p_limit
  )
  insert into public.audio_summary_jobs (
    batch_id, book_id, language, status, priority, source_chars
  )
  select
    v_batch_id,
    p.id,
    p.normalized_language,
    'queued',
    100,
    p.best_source_chars
  from picked p;

  get diagnostics v_count = row_count;
  return query select v_batch_id, v_count;
end;
$$;

create or replace function public.claim_audio_summary_job(
  p_worker_id text,
  p_language text default 'en'
)
returns table(
  job_id uuid,
  batch_id uuid,
  book_id uuid,
  title text,
  author text,
  slug text,
  language text,
  source_text text,
  source_field text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select j.id
    from public.audio_summary_jobs j
    where j.status = 'queued'
      and j.language = lower(p_language)
      and j.attempt_count < j.max_attempts
    order by j.priority asc, j.created_at asc
    for update skip locked
    limit 1
  ), claimed as (
    update public.audio_summary_jobs j
    set status = 'processing',
        worker_id = p_worker_id,
        locked_at = now(),
        attempt_count = j.attempt_count + 1,
        updated_at = now()
    from candidate c
    where j.id = c.id
    returning j.*
  )
  select
    c.id,
    c.batch_id,
    b.id,
    b.title,
    b.author,
    b.slug,
    c.language,
    case
      when length(coalesce(b.deep_analysis, '')) >= length(coalesce(b.deep_summary, ''))
        then b.deep_analysis
      else b.deep_summary
    end as source_text,
    case
      when length(coalesce(b.deep_analysis, '')) >= length(coalesce(b.deep_summary, ''))
        then 'deep_analysis'
      else 'deep_summary'
    end as source_field
  from claimed c
  join public.books b on b.id = c.book_id;
end;
$$;

create or replace function public.complete_audio_summary_job(
  p_job_id uuid,
  p_audio_url text,
  p_duration_seconds numeric,
  p_script_words integer,
  p_source_field text,
  p_tts_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  select book_id into v_book_id
  from public.audio_summary_jobs
  where id = p_job_id and status = 'processing'
  for update;

  if v_book_id is null then
    raise exception 'Audio job not found or not processing: %', p_job_id;
  end if;

  insert into public.book_assets (book_id, audio_url, status, updated_at)
  values (v_book_id, p_audio_url, 'ready', now())
  on conflict (book_id) do update
    set audio_url = excluded.audio_url,
        status = 'ready',
        updated_at = now();

  update public.audio_summary_jobs
  set status = 'completed',
      audio_url = p_audio_url,
      audio_duration_seconds = p_duration_seconds,
      script_words = p_script_words,
      source_field = p_source_field,
      tts_metadata = coalesce(p_tts_metadata, '{}'::jsonb),
      error_message = null,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.fail_audio_summary_job(
  p_job_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.audio_summary_jobs
  set status = case when attempt_count >= max_attempts then 'failed' else 'queued' end,
      error_message = left(coalesce(p_error, 'Unknown error'), 4000),
      worker_id = null,
      locked_at = null,
      updated_at = now()
  where id = p_job_id and status = 'processing';
end;
$$;

-- Recover jobs abandoned by a crashed worker.
create or replace function public.requeue_stale_audio_summary_jobs(
  p_stale_after interval default interval '90 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.audio_summary_jobs
  set status = case when attempt_count >= max_attempts then 'failed' else 'queued' end,
      worker_id = null,
      locked_at = null,
      error_message = coalesce(error_message, 'Recovered after stale worker lock'),
      updated_at = now()
  where status = 'processing'
    and locked_at < now() - p_stale_after;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on table public.audio_summary_jobs from anon, authenticated;
revoke all on function public.enqueue_audio_summary_batch(text, integer) from public, anon, authenticated;
revoke all on function public.claim_audio_summary_job(text, text) from public, anon, authenticated;
revoke all on function public.complete_audio_summary_job(uuid, text, numeric, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_audio_summary_job(uuid, text) from public, anon, authenticated;
revoke all on function public.requeue_stale_audio_summary_jobs(interval) from public, anon, authenticated;

grant select, insert, update on table public.audio_summary_jobs to service_role;
grant execute on function public.enqueue_audio_summary_batch(text, integer) to service_role;
grant execute on function public.claim_audio_summary_job(text, text) to service_role;
grant execute on function public.complete_audio_summary_job(uuid, text, numeric, integer, text, jsonb) to service_role;
grant execute on function public.fail_audio_summary_job(uuid, text) to service_role;
grant execute on function public.requeue_stale_audio_summary_jobs(interval) to service_role;
