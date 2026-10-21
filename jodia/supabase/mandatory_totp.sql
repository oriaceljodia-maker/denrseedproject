-- DENR: require verified TOTP for ALL existing/new admin and personnel accounts.
-- Standalone Supabase SQL Editor script, not an email template.
-- Deploy the matching frontend FIRST, then run this file in one query.
-- Does not delete accounts, reset passwords, or edit existing MFA factors.
BEGIN;

CREATE SCHEMA IF NOT EXISTS denr_security;
REVOKE ALL ON SCHEMA denr_security FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA denr_security TO authenticated;

-- Private helper avoids profiles-policy recursion and checks the authoritative
-- account status. A stale AAL2 token alone cannot pass after all TOTP factors
-- have been removed. No secrets are returned or copied to application tables.
CREATE OR REPLACE FUNCTION denr_security.has_verified_totp()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_active AND role IN ('admin', 'personnel'))
    AND EXISTS (SELECT 1 FROM auth.mfa_factors
      WHERE user_id = auth.uid() AND factor_type = 'totp' AND status = 'verified')
$$;
REVOKE ALL ON FUNCTION denr_security.has_verified_totp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION denr_security.has_verified_totp() TO authenticated;

-- RESTRICTIVE policies combine with, rather than replace, the existing
-- ownership/admin/maintenance policies. Permissive policies cannot bypass MFA.
DO $$
DECLARE portal_table TEXT;
BEGIN
  FOREACH portal_table IN ARRAY ARRAY['seeds', 'requests', 'system_settings', 'audit_trail', 'login_activity']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', portal_table);
    EXECUTE format('DROP POLICY IF EXISTS "DENR require TOTP" ON public.%I', portal_table);
    EXECUTE format('CREATE POLICY "DENR require TOTP" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT denr_security.has_verified_totp()))
      WITH CHECK ((SELECT denr_security.has_verified_totp()))', portal_table);
  END LOOP;
END;
$$;

-- Bootstrap: the app must read ONLY its own profile before enrollment to
-- check active status and password setup. Every profile write requires MFA.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DENR profile read before TOTP" ON public.profiles;
CREATE POLICY "DENR profile read before TOTP" ON public.profiles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT denr_security.has_verified_totp()));
DROP POLICY IF EXISTS "DENR profile insert after TOTP" ON public.profiles;
CREATE POLICY "DENR profile insert after TOTP" ON public.profiles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT denr_security.has_verified_totp()));
DROP POLICY IF EXISTS "DENR profile update after TOTP" ON public.profiles;
CREATE POLICY "DENR profile update after TOTP" ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT denr_security.has_verified_totp()))
  WITH CHECK ((SELECT denr_security.has_verified_totp()));
DROP POLICY IF EXISTS "DENR profile delete after TOTP" ON public.profiles;
CREATE POLICY "DENR profile delete after TOTP" ON public.profiles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT denr_security.has_verified_totp()));

-- Keep Get Access available to signed-out users. Reviewing access requests
-- still requires both the existing admin policy and a verified authenticator.
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DENR access request read after TOTP" ON public.access_requests;
CREATE POLICY "DENR access request read after TOTP" ON public.access_requests
  AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT denr_security.has_verified_totp()));
DROP POLICY IF EXISTS "DENR access request update after TOTP" ON public.access_requests;
CREATE POLICY "DENR access request update after TOTP" ON public.access_requests
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT denr_security.has_verified_totp())) WITH CHECK ((SELECT denr_security.has_verified_totp()));
DROP POLICY IF EXISTS "DENR access request delete after TOTP" ON public.access_requests;
CREATE POLICY "DENR access request delete after TOTP" ON public.access_requests
  AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT denr_security.has_verified_totp()));

-- Private request letters and signed-in avatar operations require MFA.
-- Existing public avatar URLs and unrelated buckets retain their behavior.
DROP POLICY IF EXISTS "DENR storage after TOTP" ON storage.objects;
CREATE POLICY "DENR storage after TOTP" ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id NOT IN ('request-letters', 'profile-avatars') OR (SELECT denr_security.has_verified_totp()))
  WITH CHECK (bucket_id NOT IN ('request-letters', 'profile-avatars') OR (SELECT denr_security.has_verified_totp()));

-- SECURITY DEFINER account creation bypasses RLS. Its existing authorization
-- helper must check MFA too, so calling the RPC directly cannot skip it.
CREATE OR REPLACE FUNCTION public.account_management_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT denr_security.has_verified_totp() AND EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active AND role = 'admin') $$;
REVOKE ALL ON FUNCTION public.account_management_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_management_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT denr_security.has_verified_totp() AND EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active AND role = 'admin') $$;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- Replace the legacy UPDATE policy too. Its direct profiles subquery causes
-- 42P17 recursion on profile updates, including first-login password setup.
DROP POLICY IF EXISTS "Admins can update account status" ON public.profiles;
CREATE POLICY "Admins can update account status" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.account_management_is_admin()))
  WITH CHECK ((SELECT public.account_management_is_admin()));

-- Older deployments may retain this RPC after its UI button was removed.
-- Preserve its behavior, but require active administrator + MFA when present.
DO $block$
BEGIN
  IF to_regprocedure('public.clear_audit_activity()') IS NOT NULL THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.clear_audit_activity()
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
      BEGIN
        IF NOT public.account_management_is_admin() THEN
          RAISE EXCEPTION 'An active administrator with authenticator verification is required.';
        END IF;
        DELETE FROM public.audit_trail;
        DELETE FROM public.login_activity;
      END;
      $body$
    $ddl$;
    REVOKE ALL ON FUNCTION public.clear_audit_activity() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.clear_audit_activity() TO authenticated;
  END IF;
END;
$block$;

COMMIT;
