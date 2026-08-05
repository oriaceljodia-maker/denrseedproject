-- ============================================================
-- Admin Account Setup (reliable bootstrap)
-- ============================================================
--
-- The manual INSERT INTO auth.users in seed.sql is fragile across
-- Supabase versions (schema keeps changing), so it may not create
-- a working login. Use this reliable approach instead:
--
-- STEP 1 (in the Supabase Dashboard):
--   Authentication -> Users -> "Add user"
--   Email: admin@denr.gov.ph
--   Password: <your chosen password>
--   Leave "Auto Confirm User" ON.
--   This creates a REAL auth user and fires the on_auth_user_created
--   trigger, which auto-creates the matching profiles row.
--
-- STEP 2 (run this SQL in the SQL Editor):
--   Promotes that user to an admin and forces a password change
--   on first login.

-- Grant auth.users read permission to the authenticated role so this
-- script can resolve the auth user by email.
GRANT SELECT ON auth.users TO authenticated;

-- Promote to admin (find the auth user by email, update profile by id)
UPDATE public.profiles p
SET role = 'admin',
    requires_password_change = true,
    is_active = true,
    updated_at = NOW()
WHERE p.id = (
  SELECT au.id
  FROM auth.users au
  WHERE lower(au.email) = lower('admin@denr.gov.ph')
  LIMIT 1
);

-- If the trigger did not create a profile row, create it now
INSERT INTO public.profiles (id, full_name, role, requires_password_change, is_active, created_at, updated_at)
SELECT au.id, 'System Administrator', 'admin', true, true, NOW(), NOW()
FROM auth.users au
WHERE lower(au.email) = lower('admin@denr.gov.ph')
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Verify (should return 1 row with role = 'admin')
SELECT p.id, au.email, p.role, p.requires_password_change, p.is_active
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE lower(au.email) = lower('admin@denr.gov.ph');
