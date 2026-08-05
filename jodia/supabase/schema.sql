-- ============================================================
-- DENR Seed Inventory - Database Schema
-- Run BEFORE functions_and_triggers.sql and seed.sql.
-- ============================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Profiles table (mirrors auth.users, id MUST match auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'personnel' CHECK (role IN ('admin', 'personnel')),
  requires_password_change BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seeds / Inventory table
CREATE TABLE IF NOT EXISTS public.seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Requests table
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

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.requests (user_id);
CREATE INDEX IF NOT EXISTS idx_requests_seed_id ON public.requests (seed_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- 5. Schema & Table Privileges
-- The anon (public/anonymous) and authenticated roles need USAGE on the
-- public schema and table privileges so the API keys can query the tables.
-- Without these grants, the app returns "permission denied for schema public".
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON SCHEMA public TO postgres, service_role;

GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.seeds TO anon, authenticated, service_role;
GRANT ALL ON public.requests TO anon, authenticated, service_role;

-- Ensure future tables in public are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
