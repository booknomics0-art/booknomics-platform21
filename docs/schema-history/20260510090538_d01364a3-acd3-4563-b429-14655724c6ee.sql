
-- 1. book_modules: replace blanket public read with premium-aware policy
DROP POLICY IF EXISTS "Modules are public" ON public.book_modules;

CREATE POLICY "Free modules public, premium gated"
ON public.book_modules
FOR SELECT
TO public
USING (
  is_premium = false
  OR (auth.uid() IS NOT NULL AND public.has_active_subscription(auth.uid()))
  OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
);

-- 2. storage.objects: restrict book-covers writes to admins only
DROP POLICY IF EXISTS "Anyone can upload book covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update book covers" ON storage.objects;

CREATE POLICY "Admins upload book covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update book covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete book covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'::app_role));
