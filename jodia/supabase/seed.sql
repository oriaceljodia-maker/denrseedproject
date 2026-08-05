-- ============================================================
-- DENR Seed Inventory - Seed Data
-- ============================================================
INSERT INTO public.seeds (species_name, category, quantity, reorder_level) VALUES
('Narra (Pterocarpus indicus)', 'Indigenous Tree', 250, 20),
('Mahogany (Swietenia macrophylla)', 'Exotic Timber', 180, 25),
('Banaba (Lagerstroemia speciosa)', 'Medicinal / Ornamental', 95, 15),
('Katmon (Dillenia philippinensis)', 'Endemic Fruit Tree', 40, 10),
('Molave (Vitex parviflora)', 'Hardwood Timber', 8, 15),
('Agoho (Casuarina equisetifolia)', 'Coastal Tree', 120, 20);

-- ============================================================
-- Bootstrap Admin Account
-- Inserts a real auth user (admin) which fires the
-- on_auth_user_created trigger to auto-create the profiles row.
-- CHANGE THE PASSWORD BEFORE PRODUCTION.
-- ============================================================
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
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@denr.gov.ph',
  crypt('Admin@12345', gen_salt('bf')),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
  jsonb_build_object('full_name', 'System Administrator', 'role', 'admin'),
  false,
  false,
  false
)
ON CONFLICT (email) DO NOTHING;
