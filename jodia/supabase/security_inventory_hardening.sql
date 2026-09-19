-- DENR Seed Inventory: security, decimal quantities, archiving, and request integrity.
-- Run ONCE in the Supabase SQL Editor after the existing project migrations.
-- Review this file before running it in a live database.

BEGIN;

-- 1. Preserve history: active seeds can be archived instead of deleted.
ALTER TABLE public.seeds
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_seeds_active ON public.seeds (is_archived, species_name);

-- 2. Quantities may use decimals, for example 0.5 kg or 12.25 g.
ALTER TABLE public.seeds
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC,
  ALTER COLUMN reorder_level TYPE NUMERIC USING reorder_level::NUMERIC;
ALTER TABLE public.requests
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC;

-- 3. Security helper functions. These read the authoritative profile row,
-- never browser-controlled auth metadata.
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_profile_is_active()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = auth.uid()), false) $$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_profile_is_active() AND public.current_profile_role() = 'admin' $$;

-- Auth sign-up metadata must never grant an administrator role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, requires_password_change, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'personnel', true, true, NOW(), NOW()
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- The browser-facing account RPC can create personnel accounts only. It never
-- returns a password and requires a password supplied by the administrator.
CREATE OR REPLACE FUNCTION public.create_new_user_account(
  user_email TEXT,
  user_full_name TEXT,
  user_role TEXT DEFAULT 'personnel',
  user_password TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only active system administrators can create accounts.';
  END IF;
  IF lower(trim(COALESCE(user_role, 'personnel'))) <> 'personnel' THEN
    RAISE EXCEPTION 'This account form can create personnel accounts only.';
  END IF;
  IF trim(COALESCE(user_email, '')) = '' OR trim(COALESCE(user_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Email and full name are required.';
  END IF;
  IF length(COALESCE(user_password, '')) < 12 THEN
    RAISE EXCEPTION 'Temporary password must contain at least 12 characters.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(user_email))) THEN
    RAISE EXCEPTION 'An account already exists for this email address.';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, recovery_token, email_change_token_new,
    email_change, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', lower(trim(user_email)),
    crypt(user_password, gen_salt('bf')), NOW(), NOW(), '', '', '', '', NOW(), NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', trim(user_full_name)), false, false, false
  );

  UPDATE public.profiles
  SET role = 'personnel', requires_password_change = true, is_active = true, updated_at = NOW()
  WHERE id = new_user_id;
  RETURN jsonb_build_object('user_id', new_user_id, 'email', lower(trim(user_email)), 'status', 'success');
END;
$$;
REVOKE ALL ON FUNCTION public.create_new_user_account(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_new_user_account(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 4. Profile privacy and active-account access enforcement.
DROP POLICY IF EXISTS "Public profiles reading" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users view own profile or admins view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_is_admin());
DROP POLICY IF EXISTS "Users update own profile safely" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot escalate role or reactivate" ON public.profiles;
CREATE POLICY "Active users update own profile safely" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.current_profile_is_active())
  WITH CHECK (id = auth.uid() AND public.current_profile_is_active()
    AND role = public.current_profile_role());

DROP POLICY IF EXISTS "Anyone authenticated can view seeds" ON public.seeds;
CREATE POLICY "Active users can view active seeds" ON public.seeds
  FOR SELECT TO authenticated USING (public.current_profile_is_active());

DROP POLICY IF EXISTS "Admins can insert seeds" ON public.seeds;
DROP POLICY IF EXISTS "Admins can update seeds" ON public.seeds;
DROP POLICY IF EXISTS "Admins can delete seeds" ON public.seeds;
CREATE POLICY "Active admins manage seeds" ON public.seeds
  FOR ALL TO authenticated
  USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "Users view own or admin views all requests" ON public.requests;
DROP POLICY IF EXISTS "Personnel can submit own requests" ON public.requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.requests;
DROP POLICY IF EXISTS "Personnel can cancel own pending requests" ON public.requests;
CREATE POLICY "Active users view permitted requests" ON public.requests
  FOR SELECT TO authenticated
  USING (public.current_profile_is_active() AND (user_id = auth.uid() OR public.current_user_is_admin()));
CREATE POLICY "Active personnel submit own requests" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_is_active() AND user_id = auth.uid() AND NOT public.maintenance_is_enabled());
CREATE POLICY "Active admins update requests" ON public.requests
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin() AND NOT public.maintenance_is_enabled())
  WITH CHECK (public.current_user_is_admin());
CREATE POLICY "Active personnel cancel own pending request" ON public.requests
  FOR UPDATE TO authenticated
  USING (public.current_profile_is_active() AND user_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (public.current_profile_is_active() AND user_id = auth.uid() AND status = 'CANCELLED');

-- 5. Prevent over-reserving an archived seed, prevent stock below reservations,
-- and enforce the request workflow server-side.
CREATE OR REPLACE FUNCTION public.manage_request_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE available_quantity NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT quantity - reserved_quantity INTO available_quantity
    FROM public.seeds WHERE id = NEW.seed_id AND is_archived = false FOR UPDATE;
    IF available_quantity IS NULL OR NEW.quantity > available_quantity THEN
      RAISE EXCEPTION 'Requested quantity exceeds the currently available stock.';
    END IF;
    IF NEW.status = 'PENDING' THEN
      UPDATE public.seeds SET reserved_quantity = reserved_quantity + NEW.quantity, updated_at = NOW() WHERE id = NEW.seed_id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED', 'CANCELLED') THEN
    UPDATE public.seeds
    SET reserved_quantity = GREATEST(reserved_quantity - OLD.quantity, 0), updated_at = NOW()
    WHERE id = OLD.seed_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_seed_stock_levels()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantity < 0 OR NEW.reorder_level < 0 OR NEW.reserved_quantity < 0 THEN
    RAISE EXCEPTION 'Inventory quantities cannot be negative.';
  END IF;
  IF NEW.quantity < NEW.reserved_quantity THEN
    RAISE EXCEPTION 'Stock quantity cannot be lower than reserved quantity.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_seed_stock_levels ON public.seeds;
CREATE TRIGGER protect_seed_stock_levels BEFORE INSERT OR UPDATE OF quantity, reorder_level, reserved_quantity
ON public.seeds FOR EACH ROW EXECUTE FUNCTION public.protect_seed_stock_levels();

CREATE OR REPLACE FUNCTION public.enforce_request_integrity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_role TEXT := public.current_profile_role();
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.seed_id IS DISTINCT FROM OLD.seed_id OR NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      RAISE EXCEPTION 'Request owner, seed, and quantity cannot be changed after submission.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF actor_role = 'admin' THEN
        IF NOT ((OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED'))
          OR (OLD.status = 'APPROVED' AND NEW.status = 'READY_FOR_RELEASE')
          OR (OLD.status = 'READY_FOR_RELEASE' AND NEW.status = 'RELEASED')) THEN
          RAISE EXCEPTION 'Invalid administrator request status transition.';
        END IF;
      ELSIF OLD.user_id = auth.uid() AND OLD.status = 'PENDING' AND NEW.status = 'CANCELLED' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'Invalid request status transition.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_request_integrity ON public.requests;
CREATE TRIGGER enforce_request_integrity BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_request_integrity();

COMMIT;
