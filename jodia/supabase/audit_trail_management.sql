-- DENR Seed Inventory: administrator-only audit clearing for controlled testing.
-- This deliberately permits clearing sign-in and audit entries. Use only when needed.

CREATE OR REPLACE FUNCTION public.clear_audit_activity()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can clear audit activity.';
  END IF;

  DELETE FROM public.audit_trail;
  DELETE FROM public.login_activity;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_audit_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_audit_activity() TO authenticated;
