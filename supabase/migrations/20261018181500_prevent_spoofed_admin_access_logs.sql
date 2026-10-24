-- Protect admin audit logs from user-id and success-status spoofing.
BEGIN;
-- Authenticated users may only record their own access attempts.
-- An "allowed" admin event requires the actual admin role.
DROP POLICY IF EXISTS "Signed-in users can record an access attempt" ON public.admin_access_logs;
CREATE POLICY "Signed-in users can record own access attempts"
ON public.admin_access_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND (attempted_email IS NULL OR lower(attempted_email) = lower((auth.jwt() ->> 'email')))
  AND (
    outcome = 'denied'
    OR (outcome = 'allowed' AND private.has_role((select auth.uid()), 'admin'::public.app_role))
  )
);
COMMIT;