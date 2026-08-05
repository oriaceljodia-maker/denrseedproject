-- ============================================================
-- DENR Seed Inventory - Seed Data
-- ============================================================
-- NOTE: The admin account is NOT created here. Manually inserting
-- into auth.users is unreliable (schema changes across versions and
-- there is no unique constraint on email). Create the admin auth user
-- via the Dashboard (Authentication -> Users -> Add user), then run
-- admin_setup.sql to promote them to the admin role.
INSERT INTO public.seeds (species_name, category, quantity, reorder_level) VALUES
('Narra (Pterocarpus indicus)', 'Indigenous Tree', 250, 20),
('Mahogany (Swietenia macrophylla)', 'Exotic Timber', 180, 25),
('Banaba (Lagerstroemia speciosa)', 'Medicinal / Ornamental', 95, 15),
('Katmon (Dillenia philippinensis)', 'Endemic Fruit Tree', 40, 10),
('Molave (Vitex parviflora)', 'Hardwood Timber', 8, 15),
('Agoho (Casuarina equisetifolia)', 'Coastal Tree', 120, 20);
