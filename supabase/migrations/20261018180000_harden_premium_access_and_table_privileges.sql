-- Booknomics security hardening: 2026-10-18.
-- Keep public summaries indexable; protect premium action fields at the database boundary.
-- Backout (only if needed): GRANT SELECT ON public.books TO anon, authenticated;
-- ALTER FUNCTION public.get_premium_summary(uuid) SECURITY INVOKER;
BEGIN;
REVOKE SELECT ON TABLE public.books FROM anon, authenticated;
GRANT SELECT (id, slug, title, author, category, cover_color, tagline, overview, key_ideas, deep_analysis, daily_application, reading_time, rating, year, created_at, cover_url, language, affiliate_link, is_draft, status, meta_title, meta_description, og_image, deep_summary, seo_slug, seo_keywords, old_slugs, alternate_book_id) ON TABLE public.books TO anon, authenticated;
-- This function checks auth.uid() and my_active_tier() before returning action fields.
-- SECURITY DEFINER is required after restricting direct column grants.
ALTER FUNCTION public.get_premium_summary(uuid) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.get_premium_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_premium_summary(uuid) TO anon, authenticated;
-- Neither browser role needs schema-changing privileges on data tables.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
COMMIT;
