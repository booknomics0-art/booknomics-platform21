create or replace view public.admin_book_catalog
with (security_invoker = true)
as
select
  b.id,
  b.title,
  b.author,
  b.category,
  b.language,
  b.is_draft,
  b.cover_url,
  b.status,
  b.slug,
  b.affiliate_link,
  b.meta_title,
  b.meta_description,
  b.seo_slug,
  b.created_at,
  (nullif(btrim(coalesce(b.overview, '')), '') is not null) as has_overview,
  (nullif(btrim(coalesce(b.key_ideas, '')), '') is not null) as has_key_ideas,
  (nullif(btrim(coalesce(b.deep_analysis, '')), '') is not null) as has_deep_analysis,
  (nullif(btrim(coalesce(b.meta_title, '')), '') is not null) as has_meta_title,
  (nullif(btrim(coalesce(b.meta_description, '')), '') is not null) as has_meta_description,
  exists (
    select 1
    from public.book_assets ba
    where ba.book_id = b.id
      and nullif(btrim(coalesce(ba.audio_url, '')), '') is not null
  ) as audio_ready
from public.books b
where public.has_role((select auth.uid()), 'admin'::public.app_role);

revoke all on table public.admin_book_catalog from public, anon;
grant select on table public.admin_book_catalog to authenticated, service_role;

comment on view public.admin_book_catalog is
  'Lightweight admin-only catalog projection. Uses security_invoker so books/book_assets RLS still applies.';
