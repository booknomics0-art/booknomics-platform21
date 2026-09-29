CREATE OR REPLACE FUNCTION private.get_admin_books()
RETURNS SETOF public.books
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator role required';
  END IF;
  RETURN QUERY SELECT * FROM public.books;
END;
$$;
REVOKE ALL ON FUNCTION private.get_admin_books() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_admin_books() TO authenticated;
CREATE OR REPLACE VIEW public.books_admin WITH (security_invoker = true)
AS SELECT * FROM private.get_admin_books();
REVOKE ALL ON public.books_admin FROM anon;
GRANT SELECT ON public.books_admin TO authenticated;
