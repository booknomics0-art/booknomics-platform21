
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS seo_slug text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS old_slugs text[] DEFAULT '{}'::text[];

CREATE UNIQUE INDEX IF NOT EXISTS books_seo_slug_unique
  ON public.books (seo_slug) WHERE seo_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS books_old_slugs_gin
  ON public.books USING gin (old_slugs);

CREATE OR REPLACE FUNCTION public.tg_track_slug_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Track changes to canonical slug
  IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD.slug IS NOT NULL AND length(OLD.slug) > 0 THEN
    IF NOT (COALESCE(NEW.old_slugs, '{}'::text[]) @> ARRAY[OLD.slug]) THEN
      NEW.old_slugs := array_append(COALESCE(NEW.old_slugs, '{}'::text[]), OLD.slug);
    END IF;
  END IF;
  -- Track changes to seo_slug (the keyword URL)
  IF NEW.seo_slug IS DISTINCT FROM OLD.seo_slug AND OLD.seo_slug IS NOT NULL AND length(OLD.seo_slug) > 0 THEN
    IF NOT (COALESCE(NEW.old_slugs, '{}'::text[]) @> ARRAY[OLD.seo_slug]) THEN
      NEW.old_slugs := array_append(COALESCE(NEW.old_slugs, '{}'::text[]), OLD.seo_slug);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_track_slug_history ON public.books;
CREATE TRIGGER trg_books_track_slug_history
  BEFORE UPDATE OF slug, seo_slug ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.tg_track_slug_history();
