-- Profile feature setup: run once in the Supabase SQL Editor.
-- This adds optional profile fields, creates a public avatar bucket, and fixes
-- the existing permissive profile-update policies so a user cannot self-promote.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS office TEXT,
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can view profile avatars" ON storage.objects;
CREATE POLICY "Users can view profile avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "Users upload own profile avatar" ON storage.objects;
CREATE POLICY "Users upload own profile avatar" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own profile avatar" ON storage.objects;
CREATE POLICY "Users update own profile avatar" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own profile avatar" ON storage.objects;
CREATE POLICY "Users delete own profile avatar" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_profile_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT is_active FROM public.profiles WHERE id = auth.uid() $$;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot escalate role or reactivate" ON public.profiles;
CREATE POLICY "Users update own profile safely" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_profile_role()
    AND is_active = public.current_profile_active()
  );
