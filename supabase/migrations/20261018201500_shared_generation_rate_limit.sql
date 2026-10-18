-- Shared, atomic rate limiting across all Edge Function instances.
-- Public RPC is callable only by service_role; browser roles cannot spend or reset buckets.
CREATE TABLE IF NOT EXISTS private.security_rate_buckets (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0
);
REVOKE ALL ON private.security_rate_buckets FROM PUBLIC, anon, authenticated;
ALTER TABLE private.security_rate_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  _key text, _max_requests integer, _window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_ok boolean;
BEGIN
  IF _key IS NULL OR length(_key) > 160 OR length(_key) < 3
     OR _max_requests < 1 OR _max_requests > 1000
     OR _window_seconds < 60 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration';
  END IF;
  INSERT INTO private.security_rate_buckets AS r (bucket_key, window_start, hit_count)
    VALUES (_key, now(), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET window_start = CASE
      WHEN r.window_start <= now() - make_interval(secs => _window_seconds) THEN now()
      ELSE r.window_start END,
      hit_count = CASE
        WHEN r.window_start <= now() - make_interval(secs => _window_seconds) THEN 1
        ELSE r.hit_count + 1 END
    WHERE r.window_start <= now() - make_interval(secs => _window_seconds)
       OR r.hit_count < _max_requests
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$body$;
REVOKE ALL ON FUNCTION public.consume_security_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(text,integer,integer) TO service_role;
