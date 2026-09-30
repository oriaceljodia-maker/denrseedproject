-- DENR Seed Inventory: no-email personnel activation and mandatory TOTP.
-- Run this ONCE in Supabase SQL Editor, after your existing schema scripts.
-- It does not use SMTP. Administrators share the generated activation code
-- through their approved channel. Do not run full_setup_with_admin.sql again.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requires_totp_setup BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE public.profiles p SET email = lower(au.email)
FROM auth.users au WHERE au.id = p.id AND p.email IS NULL;

CREATE TABLE IF NOT EXISTS public.personnel_account_activations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.personnel_account_activations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.personnel_account_recoveries (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.personnel_account_recoveries ENABLE ROW LEVEL SECURITY;

-- Authoritative helpers: browser-controlled metadata is never used for roles.
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_profile_is_active()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = auth.uid()), false) $$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_profile_is_active() AND public.current_profile_role() = 'admin' $$;

-- Personnel access requires a verified TOTP session. Administrators retain
-- their existing access policy and can manage personnel activation.
CREATE OR REPLACE FUNCTION public.current_user_can_use_portal()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_profile_is_active() THEN RETURN false; END IF;
  IF public.current_profile_role() = 'admin' THEN RETURN true; END IF;
  IF public.current_profile_role() <> 'personnel' THEN RETURN false; END IF;
  RETURN COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
END;
$$;

-- The browser sends a cryptographically generated activation code. The code is
-- stored only as the password hash in Supabase Auth and expires in 48 hours.
CREATE OR REPLACE FUNCTION public.create_personnel_activation_account(
  user_email TEXT,
  user_full_name TEXT,
  activation_code TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_user_id UUID := gen_random_uuid();
DECLARE normalized_email TEXT := lower(trim(COALESCE(user_email, '')));
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only active system administrators can create accounts.';
  END IF;
  IF normalized_email = '' OR trim(COALESCE(user_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Email and full name are required.';
  END IF;
  IF length(COALESCE(activation_code, '')) < 16 OR length(activation_code) > 80 THEN
    RAISE EXCEPTION 'Activation code is invalid.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = normalized_email) THEN
    RAISE EXCEPTION 'An account already exists for this email address.';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, recovery_token, email_change_token_new,
    email_change, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', normalized_email,
    crypt(activation_code, gen_salt('bf')), NOW(), NOW(), '', '', '', '', NOW(), NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', trim(user_full_name)), false, false, false
  );

  UPDATE public.profiles
  SET role = 'personnel', is_active = true, requires_password_change = true,
      requires_totp_setup = true, activation_expires_at = NOW() + INTERVAL '48 hours',
      activation_completed_at = NULL, recovery_expires_at = NULL,
      email = normalized_email, updated_at = NOW()
  WHERE id = new_user_id;

  INSERT INTO public.personnel_account_activations (user_id, expires_at, created_by)
  VALUES (new_user_id, NOW() + INTERVAL '48 hours', auth.uid());

  RETURN jsonb_build_object('user_id', new_user_id, 'email', normalized_email, 'expires_in_hours', 48);
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_personnel_recovery_code(
  target_user_id UUID,
  recovery_code TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only active system administrators can issue recovery codes.';
  END IF;
  IF length(COALESCE(recovery_code, '')) < 16 OR length(recovery_code) > 80 THEN
    RAISE EXCEPTION 'Recovery code is invalid.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id AND role = 'personnel') THEN
    RAISE EXCEPTION 'Personnel account not found.';
  END IF;
  UPDATE auth.users SET encrypted_password = crypt(recovery_code, gen_salt('bf')), updated_at = NOW()
  WHERE id = target_user_id;
  UPDATE public.profiles SET requires_password_change = true,
    recovery_expires_at = NOW() + INTERVAL '48 hours', updated_at = NOW()
  WHERE id = target_user_id;
  INSERT INTO public.personnel_account_recoveries (user_id, expires_at, completed_at, issued_by, issued_at)
  VALUES (target_user_id, NOW() + INTERVAL '48 hours', NULL, auth.uid(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET expires_at = EXCLUDED.expires_at, completed_at = NULL,
    issued_by = EXCLUDED.issued_by, issued_at = EXCLUDED.issued_at;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_personnel_recovery_code()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.personnel_account_recoveries
    WHERE user_id = auth.uid() AND completed_at IS NULL AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'This recovery code is invalid, used, or expired.';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_personnel_activation()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.personnel_account_activations
    WHERE user_id = auth.uid() AND activated_at IS NULL AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'This activation code is invalid, used, or expired.';
  END IF;
  RETURN true;
END;
$$;

-- Called only after Supabase Auth has accepted the user's chosen password.
CREATE OR REPLACE FUNCTION public.mark_password_setup_complete()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;
  IF EXISTS (SELECT 1 FROM public.personnel_account_activations WHERE user_id = auth.uid() AND activated_at IS NULL AND expires_at <= NOW()) THEN
    RAISE EXCEPTION 'This activation code has expired.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personnel_account_recoveries WHERE user_id = auth.uid() AND completed_at IS NULL AND expires_at <= NOW()) THEN
    RAISE EXCEPTION 'This recovery code has expired.';
  END IF;
  UPDATE public.profiles
  SET requires_password_change = false, updated_at = NOW()
  WHERE id = auth.uid();
  UPDATE public.personnel_account_recoveries SET completed_at = NOW()
  WHERE user_id = auth.uid() AND completed_at IS NULL;
  RETURN true;
END;
$$;

-- Completes activation only if Supabase reports a verified TOTP factor.
CREATE OR REPLACE FUNCTION public.complete_personnel_activation()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.personnel_account_activations
    WHERE user_id = auth.uid() AND activated_at IS NULL AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Activation is no longer valid.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = auth.uid() AND factor_type = 'totp' AND status = 'verified'
  ) THEN
    RAISE EXCEPTION 'A verified authenticator is required.';
  END IF;
  UPDATE public.personnel_account_activations SET activated_at = NOW() WHERE user_id = auth.uid();
  UPDATE public.profiles
  SET activation_completed_at = NOW(), requires_totp_setup = false, updated_at = NOW()
  WHERE id = auth.uid();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_personnel_activation_account(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_personnel_recovery_code(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_personnel_activation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_personnel_recovery_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_password_setup_complete() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_personnel_activation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_personnel_activation_account(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_personnel_recovery_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_personnel_activation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_personnel_recovery_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_password_setup_complete() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_personnel_activation() TO authenticated;

-- Enforce the new personnel TOTP requirement at database level for seeds and requests.
DROP POLICY IF EXISTS "Anyone authenticated can view seeds" ON public.seeds;
DROP POLICY IF EXISTS "Active users can view active seeds" ON public.seeds;
CREATE POLICY "Portal users can view active seeds" ON public.seeds
  FOR SELECT TO authenticated USING (public.current_user_can_use_portal());

DROP POLICY IF EXISTS "Users view own or admin views all requests" ON public.requests;
DROP POLICY IF EXISTS "Active users view permitted requests" ON public.requests;
CREATE POLICY "Portal users view permitted requests" ON public.requests
  FOR SELECT TO authenticated
  USING (public.current_user_can_use_portal() AND (user_id = auth.uid() OR public.current_user_is_admin()));

DROP POLICY IF EXISTS "Personnel can submit own requests" ON public.requests;
DROP POLICY IF EXISTS "Active personnel submit own requests" ON public.requests;
CREATE POLICY "Portal personnel submit requests" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_use_portal() AND user_id = auth.uid() AND NOT public.maintenance_is_enabled());

DROP POLICY IF EXISTS "Personnel can cancel own pending request" ON public.requests;
DROP POLICY IF EXISTS "Active personnel cancel own pending request" ON public.requests;
CREATE POLICY "Portal personnel cancel own pending request" ON public.requests
  FOR UPDATE TO authenticated
  USING (public.current_user_can_use_portal() AND user_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (public.current_user_can_use_portal() AND user_id = auth.uid() AND status = 'CANCELLED');

COMMIT;
