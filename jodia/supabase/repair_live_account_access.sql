-- LIVE DATABASE REPAIR: account status changes and first-login password setup.
-- Supabase project: newdenr (ahwzzsqyjuyffbzlhmoj).
-- Paste this ENTIRE file into SQL Editor > New query and click Run.
-- This changes one access policy. It does not reset passwords, remove
-- authenticators, delete accounts, or change inventory/request records.
-- Safe to run again. Do not run full_setup_with_admin.sql instead.

BEGIN;

-- The existing helper already checks active administrator status and MFA.
-- Stop rather than weakening security if that required setup is absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = to_regprocedure('public.account_management_is_admin()')
      AND prosecdef
  ) OR to_regprocedure('denr_security.has_verified_totp()') IS NULL THEN
    RAISE EXCEPTION 'Required account-management/MFA helpers are missing. No repair was applied.';
  END IF;
END;
$$;

-- Remove the recursive SELECT from profiles inside its own UPDATE policy.
-- Preserve the existing owner, role, active-account and TOTP restrictions.
ALTER POLICY "Admins can update account status" ON public.profiles
  TO authenticated
  USING ((SELECT public.account_management_is_admin()))
  WITH CHECK ((SELECT public.account_management_is_admin()));

COMMIT;

-- Expected result: repair_status = REPAIR APPLIED.
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Admins can update account status'
    AND cmd = 'UPDATE'
    AND qual LIKE '%account_management_is_admin%'
    AND with_check LIKE '%account_management_is_admin%'
) THEN 'REPAIR APPLIED' ELSE 'REPAIR NOT APPLIED' END AS repair_status;
