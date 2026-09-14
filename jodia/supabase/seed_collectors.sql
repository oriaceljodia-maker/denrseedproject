-- DENR Seed Inventory: optional collection-team traceability.
-- Run once in the Supabase SQL Editor after the seed traceability migration.

ALTER TABLE public.seeds
  ADD COLUMN IF NOT EXISTS collectors TEXT;
