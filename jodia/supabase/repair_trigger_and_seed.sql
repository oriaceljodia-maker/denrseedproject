-- ============================================================================
-- DENR Seed Inventory - REPAIR: trigger + seed data
-- ============================================================================
-- Run this in the Supabase SQL Editor (project: mxlfrjwoontxytwlvbia).
--
-- WHY: If adding a new user in the Dashboard fails with "failed to create/add",
-- it is almost always because the `on_auth_user_created` trigger is missing or
-- broken. The admin profile exists, but no NEW profiles are being auto-created
-- when users are added. Additionally, the seeds table may be empty if seed.sql
-- did not complete.
--
-- This script:
--   1. Re-creates a hardened, defensive handle_new_user() trigger function that
--      NEVER fails user creation (wrapped in exception handling).
--   2. Drops and re-creates the on_auth_user_created trigger.
--   3. Re-inserts seed data (idempotent via ON CONFLICT DO NOTHING on species).
--   4. Re-grants privileges (defensive).
-- ============================================================================

-- 1. Required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Hardened handle_new_user(): never lets auth.users insert fail.
--    If the profile insert hits any problem (e.g., metadata quirks), it logs
--    and returns normally so the auth user is still created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id, full_name, role, requires_password_change, is_active, created_at, updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1), 'User'),
      COALESCE(NEW.raw_user_meta_data->>'role', 'personnel'),
      COALESCE((NEW.raw_user_meta_data->>'requires_password_change')::boolean, true),
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log and swallow: do NOT block auth user creation.
    RAISE WARNING 'handle_new_user profile insert failed for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create the trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant table/function privileges defensively (in case they were lost)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.seeds TO anon, authenticated, service_role;
GRANT ALL ON public.requests TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_new_user_account(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;

-- 5. Re-insert seed data (idempotent by species_name)
INSERT INTO public.seeds (species_name, category, quantity, reorder_level)
SELECT * FROM (VALUES
  ('Narra (Pterocarpus indicus)', 'Indigenous Tree', 250, 20),
  ('Mahogany (Swietenia macrophylla)', 'Exotic Timber', 180, 25),
  ('Banaba (Lagerstroemia speciosa)', 'Medicinal / Ornamental', 95, 15),
  ('Katmon (Dillenia philippinensis)', 'Endemic Fruit Tree', 40, 10),
  ('Molave (Vitex parviflora)', 'Hardwood Timber', 8, 15),
  ('Agoho (Casuarina equisetifolia)', 'Coastal Tree', 120, 20)
) AS v(species_name, category, quantity, reorder_level)
WHERE NOT EXISTS (
  SELECT 1 FROM public.seeds s WHERE s.species_name = v.species_name
);

-- 6. Verify
SELECT 'profiles' AS tbl, count(*) AS rows_ FROM public.profiles
UNION ALL
SELECT 'seeds', count(*) FROM public.seeds;

-- ============================================================================
-- END
-- ============================================================================
