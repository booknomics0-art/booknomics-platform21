-- Replace multi-page public catalog downloads with a compact read-only category response.
-- SECURITY INVOKER preserves existing books RLS for anonymous/authenticated users.
CREATE OR REPLACE FUNCTION public.get_public_category_info(
  p_slug text DEFAULT NULL,
  p_alias text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_published_only boolean DEFAULT false,
  p_pick_labels text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_categories text[] := ARRAY[]::text[];
  v_category text;
  v_count bigint := 0;
  v_picks jsonb := '{}'::jsonb;
  v_label text;
  v_label_normalized text;
  v_target text;
BEGIN
  IF COALESCE(cardinality(p_pick_labels), 0) > 30 THEN
    RAISE EXCEPTION 'Too many curated labels';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT b.category ORDER BY b.category), ARRAY[]::text[])
  INTO v_categories
  FROM public.books b
  WHERE b.is_draft = false
    AND b.status IN ('published', 'published_noindex')
    AND (NOT p_published_only OR b.status = 'published')
    AND (p_language IS NULL OR b.language = p_language)
    AND b.category IS NOT NULL
    AND b.category <> '';

  IF p_slug IS NOT NULL THEN
    SELECT b.category, COUNT(*) FILTER (WHERE b.status = 'published')
    INTO v_category, v_count
    FROM public.books b
    WHERE b.is_draft = false
      AND b.status IN ('published', 'published_noindex')
      AND (NOT p_published_only OR b.status = 'published')
      AND (p_language IS NULL OR b.language = p_language)
      AND (
        (p_alias IS NOT NULL AND b.category = p_alias)
        OR trim(both '-' from regexp_replace(
             regexp_replace(
               regexp_replace(lower(b.category), '[/&]+', '-', 'g'),
               '[^a-z0-9ऀ-ॿ]+', '-', 'g'
             ), '-+', '-', 'g'
           )) = lower(p_slug)
      )
    GROUP BY b.category
    ORDER BY CASE WHEN p_alias IS NOT NULL AND b.category = p_alias THEN 0 ELSE 1 END, b.category
    LIMIT 1;
  END IF;

  IF v_category IS NOT NULL THEN
    FOREACH v_label IN ARRAY p_pick_labels LOOP
      IF v_label IS NULL OR length(v_label) > 160 THEN CONTINUE; END IF;
      v_label_normalized := trim(both ' ' from regexp_replace(
        regexp_replace(
          regexp_replace(
            replace(replace(lower(v_label), '’', ''), '''', ''),
            '[(][^)]*[)]', ' ', 'g'
          ), '[^a-z0-9ऀ-ॿ]+', ' ', 'g'
        ), ' +', ' ', 'g'
      ));
      IF v_label_normalized = '' THEN CONTINUE; END IF;

      SELECT COALESCE(b.seo_slug, b.slug)
      INTO v_target
      FROM public.books b
      CROSS JOIN LATERAL (
        SELECT trim(both ' ' from regexp_replace(
          regexp_replace(
            regexp_replace(
              replace(replace(lower(b.title), '’', ''), '''', ''),
              '[(][^)]*[)]', ' ', 'g'
            ), '[^a-z0-9ऀ-ॿ]+', ' ', 'g'
          ), ' +', ' ', 'g'
        )) AS normalized_title
      ) matched
      WHERE b.is_draft = false
        AND b.status = 'published'
        AND b.title IS NOT NULL
        AND COALESCE(b.seo_slug, b.slug) IS NOT NULL
        AND (
          matched.normalized_title = v_label_normalized
          OR matched.normalized_title LIKE v_label_normalized || ' %'
        )
      ORDER BY CASE WHEN matched.normalized_title = v_label_normalized THEN 0 ELSE 1 END, b.id
      LIMIT 1;

      IF v_target IS NOT NULL THEN
        v_picks := v_picks || jsonb_build_object(v_label, v_target);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'categories', v_categories,
    'category', v_category,
    'published_count', COALESCE(v_count, 0),
    'picks', v_picks
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_category_info(text,text,text,boolean,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_category_info(text,text,text,boolean,text[]) TO anon, authenticated;
