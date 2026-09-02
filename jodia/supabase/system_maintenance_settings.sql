-- DENR Seed Inventory: shared maintenance mode.
-- Run this AFTER personnel_requests_and_seed_traceability.sql in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.system_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  maintenance_enabled BOOLEAN NOT NULL DEFAULT false,
  announcement_message TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.system_settings (id, maintenance_enabled, announcement_message)
VALUES (true, false, '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.system_settings TO authenticated;
GRANT UPDATE ON public.system_settings TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
CREATE POLICY "Admins can update system settings" ON public.system_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.maintenance_is_enabled()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT maintenance_enabled FROM public.system_settings WHERE id = true), false) $$;

-- Enforce maintenance restrictions at the database level, not just in the interface.
DROP POLICY IF EXISTS "Personnel can submit own requests" ON public.requests;
CREATE POLICY "Personnel can submit own requests" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.maintenance_is_enabled());

DROP POLICY IF EXISTS "Admins can update request status" ON public.requests;
CREATE POLICY "Admins can update request status" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    AND NOT public.maintenance_is_enabled()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
  END IF;
END $$;
