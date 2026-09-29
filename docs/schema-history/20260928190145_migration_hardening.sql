-- Apply only after the original migrations, before importing data.
BEGIN;
-- Preserve old policy references while removing the previous owner's email bypass.
CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

-- The archive contains policies for this bucket, but never creates the bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-assets', 'book-assets', true) ON CONFLICT (id) DO NOTHING;

-- Uniqueness makes payment/order replay detectable. Abort if existing data conflicts.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_unique_order
ON public.subscriptions (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_unique_payment
ON public.subscriptions (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Explicit writes for projects whose default grants do not expose new tables.
GRANT SELECT, INSERT, DELETE ON public.library TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.books TO authenticated;
-- Books SELECT remains column-restricted by the preceding premium migration.
REVOKE EXECUTE ON FUNCTION public.get_premium_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_premium_summary(uuid) TO authenticated;

-- An owner-written audit trail for every book edit, including MCP changes.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE private.book_edit_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id uuid NOT NULL,
  actor_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb NOT NULL,
  new_data jsonb NOT NULL
);
ALTER TABLE private.book_edit_audit ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION private.audit_book_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Trigger-only function; interactive callers need a verified administrator.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator role required';
  END IF;
  INSERT INTO private.book_edit_audit(book_id, actor_id, old_data, new_data)
  VALUES (NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_book_edit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_book_edit AFTER UPDATE ON public.books
FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION private.audit_book_edit();
COMMIT;
