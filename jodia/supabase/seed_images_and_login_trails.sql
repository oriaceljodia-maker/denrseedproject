-- Apply this migration to an existing DENR Seed Inventory database.
-- It adds optional catalog imagery and a privacy-conscious successful-login audit trail.

ALTER TABLE public.seeds
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE public.seeds
SET image_url = CASE species_name
  WHEN 'Narra (Pterocarpus indicus)' THEN 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=900&q=80'
  WHEN 'Mahogany (Swietenia macrophylla)' THEN 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80'
  WHEN 'Banaba (Lagerstroemia speciosa)' THEN 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80'
  WHEN 'Katmon (Dillenia philippinensis)' THEN 'https://images.unsplash.com/photo-1488837092640-4ec78d1b4c5c?auto=format&fit=crop&w=900&q=80'
  WHEN 'Molave (Vitex parviflora)' THEN 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=900&q=80'
  WHEN 'Agoho (Casuarina equisetifolia)' THEN 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80'
  ELSE image_url
END
WHERE image_url IS NULL;

CREATE TABLE IF NOT EXISTS public.login_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (outcome IN ('SUCCESS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_activity_user_id
  ON public.login_activity (user_id, created_at DESC);

GRANT ALL ON public.login_activity TO anon, authenticated, service_role;
ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can record their successful login" ON public.login_activity;
CREATE POLICY "Users can record their successful login" ON public.login_activity
  FOR INSERT WITH CHECK (user_id = auth.uid() AND outcome = 'SUCCESS');

DROP POLICY IF EXISTS "Admins can view login activity" ON public.login_activity;
CREATE POLICY "Admins can view login activity" ON public.login_activity
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can clear login activity" ON public.login_activity;
CREATE POLICY "Admins can clear login activity" ON public.login_activity
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Dashboard live updates for seed inventory and requests.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'seeds') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seeds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
  END IF;
END $$;

-- Allow only authenticated administrator profiles to remove seed inventory records.
DROP POLICY IF EXISTS "Admins can delete seeds" ON public.seeds;
CREATE POLICY "Admins can delete seeds" ON public.seeds
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow administrators to enable or disable personnel accounts from the Users page.
DROP POLICY IF EXISTS "Admins can update account status" ON public.profiles;
CREATE POLICY "Admins can update account status" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
