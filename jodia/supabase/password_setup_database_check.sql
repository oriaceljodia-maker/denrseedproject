-- DENR: password first, authenticator second, dashboard last.
-- Copy this ENTIRE file into Supabase SQL Editor > New query and click Run.
-- READ-ONLY CHECK: it changes no tables, policies, passwords or MFA factors.
-- This screen-order update needs no new database migration.
-- Keep the existing mandatory TOTP policies and profile-recursion repair.
-- Do not rerun full_setup_with_admin.sql or a TOTP rollback for this update.
-- Expected: every row says PASS. If any row says CHECK REQUIRED, stop and
-- review that result; do not disable RLS or remove an authenticator to fix it.

WITH checks AS (
  SELECT 1 AS position, 'Password-setup flag exists' AS check_name, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'requires_password_change' AND data_type = 'boolean'
  ) AS passed
  UNION ALL
  SELECT 2, 'Profile row-level security remains enabled', EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relrowsecurity
  )
  UNION ALL
  SELECT 3, 'Existing protected MFA/admin helpers exist', (
    SELECT count(*) = 2 FROM pg_proc
    WHERE oid IN (
      to_regprocedure('denr_security.has_verified_totp()'),
      to_regprocedure('public.account_management_is_admin()')
    ) AND prosecdef
  )
  UNION ALL
  SELECT 4, 'Administrator profile policy uses the recursion repair', EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Admins can update account status' AND cmd = 'UPDATE'
      AND qual LIKE '%account_management_is_admin%'
      AND with_check LIKE '%account_management_is_admin%'
      AND qual NOT LIKE '%FROM profiles%' AND with_check NOT LIKE '%FROM profiles%'
  )
  UNION ALL
  SELECT 5, 'Own-profile bootstrap read policy remains installed', EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'DENR profile read before TOTP' AND cmd = 'SELECT'
      AND permissive = 'RESTRICTIVE' AND qual LIKE '%auth.uid()%'
  )
  UNION ALL
  SELECT 6, 'Profile updates still require verified TOTP', EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'DENR profile update after TOTP' AND cmd = 'UPDATE'
      AND permissive = 'RESTRICTIVE'
      AND qual LIKE '%has_verified_totp%' AND with_check LIKE '%has_verified_totp%'
  )
  UNION ALL
  SELECT 7, 'Portal tables retain mandatory TOTP policies', (
    SELECT count(*) = 5 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('seeds', 'requests', 'system_settings', 'audit_trail', 'login_activity')
      AND policyname = 'DENR require TOTP' AND cmd = 'ALL'
      AND permissive = 'RESTRICTIVE'
      AND qual LIKE '%has_verified_totp%' AND with_check LIKE '%has_verified_totp%'
  )
)
SELECT check_name, CASE WHEN passed THEN 'PASS' ELSE 'CHECK REQUIRED' END AS result
FROM checks ORDER BY position;
