-- ============================================================
-- DENR Seed Inventory - Supabase Functions, Triggers & Policies
-- ============================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Automatic Stock Deduction Trigger on Request Approval
CREATE OR REPLACE FUNCTION handle_seed_request_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to 'APPROVED'
  IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    -- Verify adequate inventory
    IF (SELECT quantity FROM public.seeds WHERE id = NEW.seed_id) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient seed quantity in inventory.';
    END IF;

    -- Deduct approved quantity from seeds table
    UPDATE public.seeds
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.seed_id;
  END IF;

  -- Restore stock if an approved request is rejected or cancelled
  IF NEW.status IN ('REJECTED', 'CANCELLED') AND OLD.status = 'APPROVED' THEN
    UPDATE public.seeds
    SET quantity = quantity + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.seed_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_request_approved
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_seed_request_approval();


-- 1b. Auto-create profiles record whenever a new auth user is created.
-- The profile id MUST match auth.users.id so that login lookups resolve
-- correctly. This is the key fix for orphaned profiles that could never log in.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, role, requires_password_change, is_active, created_at, updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'personnel'),
    COALESCE((NEW.raw_user_meta_data->>'requires_password_change')::boolean, true),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 2. Admin RPC Function to Provision User Accounts
-- Creates a REAL auth user (inserted into auth.users). The trigger above
-- then auto-creates the matching profiles row with the exact same id.
-- NOTE: This function must be executed by the postgres role (it is SECURITY
-- DEFINER defaulting to the creating role) so it can write to auth.users.
CREATE OR REPLACE FUNCTION create_new_user_account(
  user_email TEXT,
  user_full_name TEXT,
  user_role TEXT DEFAULT 'personnel',
  user_password TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  temp_password TEXT;
BEGIN
  -- Ensure caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can create user accounts.';
  END IF;

  -- Validate role
  IF user_role NOT IN ('admin', 'personnel') THEN
    RAISE EXCEPTION 'Invalid role. Must be "admin" or "personnel".';
  END IF;

  -- Generate a temporary password if none was provided
  IF user_password IS NULL OR user_password = '' THEN
    temp_password := 'Temp@' || (floor(random() * 1000000))::text;
  ELSE
    temp_password := user_password;
  END IF;

  -- Create the actual auth user. The on_auth_user_created trigger will
  -- automatically create the matching profiles row.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, created_at,
    updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', user_email,
    crypt(temp_password, gen_salt('bf')),
    NOW(),
    NOW(), '', '',
    '', '', NOW(), NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', user_full_name, 'role', user_role),
    false, false, false
  );

  RETURN jsonb_build_object(
    'user_id', new_user_id,
    'email', user_email,
    'temporary_password', temp_password,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Row-Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles reading" ON public.profiles FOR SELECT USING (true);

-- Users can update their own profile BUT cannot change role or is_active
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users cannot escalate role or reactivate" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Prevent role escalation and self-reactivation
    (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
    AND (is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid()))
  );

-- Seeds Policies
CREATE POLICY "Anyone authenticated can view seeds" ON public.seeds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert seeds" ON public.seeds FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update seeds" ON public.seeds FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete seeds" ON public.seeds FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Requests Policies
CREATE POLICY "Users view own or admin views all requests" ON public.requests FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Personnel can only submit requests for themselves
CREATE POLICY "Personnel can submit own requests" ON public.requests FOR INSERT WITH CHECK (
  user_id = auth.uid() AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can update request status" ON public.requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);