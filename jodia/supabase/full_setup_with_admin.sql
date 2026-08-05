-- ============================================================
-- DENR Seed Inventory - Full Database Setup with Admin
-- Run this script in Supabase SQL editor as a privileged role.
-- It creates the application schema, triggers, RLS policies, seed data,
-- and bootstraps the admin auth user and profile.
-- ============================================================

-- 0) Required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create app tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'personnel' CHECK (role IN ('admin', 'personnel')),
  requires_password_change BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seed_id UUID NOT NULL REFERENCES public.seeds(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED')),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.requests (user_id);
CREATE INDEX IF NOT EXISTS idx_requests_seed_id ON public.requests (seed_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- 3) Grants for the app schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON SCHEMA public TO postgres, service_role;

GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.seeds TO anon, authenticated, service_role;
GRANT ALL ON public.requests TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- 4) App functions and triggers
CREATE OR REPLACE FUNCTION handle_seed_request_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    IF (SELECT quantity FROM public.seeds WHERE id = NEW.seed_id) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient seed quantity in inventory.';
    END IF;

    UPDATE public.seeds
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.seed_id;
  END IF;

  IF NEW.status IN ('REJECTED', 'CANCELLED') AND OLD.status = 'APPROVED' THEN
    UPDATE public.seeds
    SET quantity = quantity + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.seed_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_request_approved ON public.requests;
CREATE TRIGGER on_request_approved
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_seed_request_approval();

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_new_user_account(
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
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can create user accounts.';
  END IF;

  IF user_role NOT IN ('admin', 'personnel') THEN
    RAISE EXCEPTION 'Invalid role. Must be "admin" or "personnel".';
  END IF;

  IF user_password IS NULL OR user_password = '' THEN
    temp_password := 'Temp@' || (floor(random() * 1000000))::text;
  ELSE
    temp_password := user_password;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, created_at,
    updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous
  )
  SELECT
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', user_email,
    crypt(temp_password, gen_salt('bf')),
    NOW(),
    NOW(), '', '',
    '', '', NOW(), NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', user_full_name, 'role', user_role),
    false, false, false
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(user_email)
  );

  RETURN jsonb_build_object(
    'user_id', new_user_id,
    'email', user_email,
    'temporary_password', temp_password,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_new_user_account(TEXT, TEXT, TEXT, TEXT)
  TO authenticated, anon;

-- 5) Row-level security policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles reading" ON public.profiles;
CREATE POLICY "Public profiles reading" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users cannot escalate role or reactivate" ON public.profiles;
CREATE POLICY "Users cannot escalate role or reactivate" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
    AND (is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Anyone authenticated can view seeds" ON public.seeds;
CREATE POLICY "Anyone authenticated can view seeds" ON public.seeds
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can insert seeds" ON public.seeds;
CREATE POLICY "Admins can insert seeds" ON public.seeds
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update seeds" ON public.seeds;
CREATE POLICY "Admins can update seeds" ON public.seeds
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete seeds" ON public.seeds;
CREATE POLICY "Admins can delete seeds" ON public.seeds
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users view own or admin views all requests" ON public.requests;
CREATE POLICY "Users view own or admin views all requests" ON public.requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Personnel can submit own requests" ON public.requests;
CREATE POLICY "Personnel can submit own requests" ON public.requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Admins can update request status" ON public.requests;
CREATE POLICY "Admins can update request status" ON public.requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6) Seed inventory data
INSERT INTO public.seeds (species_name, category, quantity, reorder_level) VALUES
('Narra (Pterocarpus indicus)', 'Indigenous Tree', 250, 20),
('Mahogany (Swietenia macrophylla)', 'Exotic Timber', 180, 25),
('Banaba (Lagerstroemia speciosa)', 'Medicinal / Ornamental', 95, 15),
('Katmon (Dillenia philippinensis)', 'Endemic Fruit Tree', 40, 10),
('Molave (Vitex parviflora)', 'Hardwood Timber', 8, 15),
('Agoho (Casuarina equisetifolia)', 'Coastal Tree', 120, 20)
ON CONFLICT DO NOTHING;

-- 7) Create admin auth user if it does not already exist
WITH desired_admin AS (
  SELECT 'admin@denr.gov.ph'::text AS email,
         'Admin User'::text AS full_name,
         'admin'::text AS role,
         'admin123456'::text AS raw_password
),
existing_admin AS (
  SELECT id FROM auth.users WHERE lower(email) = lower((SELECT email FROM desired_admin))
)
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  invited_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  email,
  crypt(raw_password, gen_salt('bf')),
  NOW(),
  NOW(), '', '',
  '', '', NOW(), NOW(),
  jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
  jsonb_build_object('full_name', full_name, 'role', role, 'requires_password_change', true),
  false, false, false
FROM desired_admin
WHERE NOT EXISTS (SELECT 1 FROM existing_admin);

-- 8) Ensure the admin profile row exists
INSERT INTO public.profiles (id, full_name, role, requires_password_change, is_active, created_at, updated_at)
SELECT au.id, 'Admin User', 'admin', true, true, NOW(), NOW()
FROM auth.users au
WHERE lower(au.email) = lower('admin@denr.gov.ph')
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- 9) Verify admin user and profile
SELECT
  au.id,
  au.email,
  p.full_name,
  p.role,
  p.requires_password_change,
  p.is_active
FROM auth.users au
JOIN public.profiles p ON p.id = au.id
WHERE lower(au.email) = lower('admin@denr.gov.ph');
