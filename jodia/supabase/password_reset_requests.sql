-- DENR Seed Inventory: admin-reviewed password reset requests.
-- Run once in the Supabase SQL Editor. This script is safe to run again.

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'DECLINED')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_pending_email_key
  ON public.password_reset_requests (lower(email))
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status_requested_at
  ON public.password_reset_requests (status, requested_at DESC);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.password_reset_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.password_reset_requests TO authenticated;

DROP POLICY IF EXISTS "Anyone can request a password reset" ON public.password_reset_requests;
CREATE POLICY "Anyone can request a password reset" ON public.password_reset_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email = lower(trim(email))
    AND email <> ''
    AND status = 'PENDING'
  );

DROP POLICY IF EXISTS "Admins can view password reset requests" ON public.password_reset_requests;
CREATE POLICY "Admins can view password reset requests" ON public.password_reset_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can update password reset requests" ON public.password_reset_requests;
CREATE POLICY "Admins can update password reset requests" ON public.password_reset_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
