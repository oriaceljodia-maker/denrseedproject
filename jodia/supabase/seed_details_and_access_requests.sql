-- DENR Seed Inventory: seed details and public access requests
-- Run this file once in the Supabase SQL Editor. Each statement is safe to rerun.

ALTER TABLE public.seeds
  ADD COLUMN IF NOT EXISTS scientific_name TEXT,
  ADD COLUMN IF NOT EXISTS source_location TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'packs',
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'Newly collected',
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_email_key
  ON public.access_requests (lower(email))
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_access_requests_created_at
  ON public.access_requests (created_at DESC);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.access_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.access_requests TO authenticated;

DROP POLICY IF EXISTS "Anyone can request access" ON public.access_requests;
CREATE POLICY "Anyone can request access" ON public.access_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email = lower(trim(email))
    AND email <> ''
    AND status = 'PENDING'
  );

DROP POLICY IF EXISTS "Admins can view access requests" ON public.access_requests;
CREATE POLICY "Admins can view access requests" ON public.access_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can update access requests" ON public.access_requests;
CREATE POLICY "Admins can update access requests" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
