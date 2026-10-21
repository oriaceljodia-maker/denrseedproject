-- Fix the production profiles UPDATE policy, without resetting any accounts.
-- Copy this WHOLE file into a new Supabase SQL Editor query and run it once.
-- Required: the existing account-management and mandatory-TOTP setup.
-- Safe to rerun. Do not rerun full_setup_with_admin.sql to fix this error.
BEGIN;

-- Reuse the existing SECURITY DEFINER check. A profiles policy must not
-- SELECT profiles directly: PostgreSQL can recursively expand its policies.
-- This helper verifies an active admin AND a verified TOTP session.
DROP POLICY IF EXISTS "Admins can update account status" ON public.profiles;
CREATE POLICY "Admins can update account status" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.account_management_is_admin()))
  WITH CHECK ((SELECT public.account_management_is_admin()));

COMMIT;

-- Verification: both expressions should call account_management_is_admin(),
-- with no direct SELECT from profiles. This final query changes no data.
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
  AND policyname = 'Admins can update account status';
