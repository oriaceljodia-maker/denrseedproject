-- DENR: Admin/Personnel account creation and optional private request letters.
-- Copy this WHOLE file into Supabase > SQL Editor > New query, then Run.
-- Apply before deploying the matching frontend changes. Safe to run again.
-- Uses the project's existing profiles, requests, and maintenance setup.
-- Preserves existing accounts, inventory, requests, and history.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.requests') IS NULL
    OR to_regprocedure('public.maintenance_is_enabled()') IS NULL THEN
    RAISE EXCEPTION 'Existing DENR tables and system_maintenance_settings.sql are required first.';
  END IF;
END;
$$;

-- Read actual account roles, not editable Auth user metadata.
CREATE OR REPLACE FUNCTION public.request_letter_user_is_active()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND is_active AND role IN ('personnel', 'admin')) $$;

CREATE OR REPLACE FUNCTION public.account_management_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND is_active AND role = 'admin') $$;

REVOKE ALL ON FUNCTION public.request_letter_user_is_active() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.account_management_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_letter_user_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_management_is_admin() TO authenticated;

-- Ordinary Auth signup cannot choose an administrator role. The guarded RPC
-- below assigns the selected application role after creating the Auth user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, requires_password_change, is_active, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'personnel', true, true, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_new_user_account(
  user_email TEXT, user_full_name TEXT,
  user_role TEXT DEFAULT 'personnel', user_password TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, extensions, public AS $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  account_email TEXT := lower(trim(COALESCE(user_email, '')));
  account_role TEXT := lower(trim(COALESCE(user_role, 'personnel')));
BEGIN
  IF NOT public.account_management_is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can create accounts.';
  END IF;
  IF account_role NOT IN ('personnel', 'admin') THEN
    RAISE EXCEPTION 'Choose Personnel or Admin.';
  END IF;
  IF account_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR trim(COALESCE(user_full_name, '')) = '' THEN
    RAISE EXCEPTION 'A valid email address and full name are required.';
  END IF;
  IF length(COALESCE(user_password, '')) < 12 THEN
    RAISE EXCEPTION 'Temporary password must contain at least 12 characters.';
  END IF;
  -- Serialize account creation for the same email, including simultaneous clicks.
  PERFORM pg_advisory_xact_lock(hashtextextended('denr-account:' || account_email, 0));
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = account_email) THEN
    RAISE EXCEPTION 'An account already exists for this email address.';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    email_change, phone_change, phone_change_token, reauthentication_token,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    account_email, crypt(user_password, gen_salt('bf')), NOW(),
    '', '', '', '', '', '', '', '', NOW(), NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', trim(user_full_name), 'role', account_role), false, false, false
  );
  -- Email identity is required by Supabase Auth for a complete email/password account.
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid(), new_user_id, new_user_id::TEXT,
    jsonb_build_object('sub', new_user_id::TEXT, 'email', account_email, 'email_verified', true, 'phone_verified', false),
    'email', NOW(), NOW());

  INSERT INTO public.profiles (id, full_name, role, requires_password_change, is_active, created_at, updated_at)
  VALUES (new_user_id, trim(user_full_name), account_role, true, true, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role,
    requires_password_change = true, is_active = true, updated_at = NOW();
  RETURN jsonb_build_object('user_id', new_user_id, 'email', account_email, 'role', account_role, 'status', 'success');
END;
$$;
REVOKE ALL ON FUNCTION public.create_new_user_account(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_new_user_account(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- These fields may be left blank by the requester. Existing values are retained.
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS planting_site TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS request_letter_path TEXT,
  ADD COLUMN IF NOT EXISTS request_letter_name TEXT,
  ADD COLUMN IF NOT EXISTS request_letter_type TEXT,
  ADD COLUMN IF NOT EXISTS request_letter_size BIGINT;
ALTER TABLE public.requests
  ALTER COLUMN planting_site DROP NOT NULL,
  ALTER COLUMN contact_number DROP NOT NULL,
  ALTER COLUMN purpose DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_request_letter_path
  ON public.requests (request_letter_path) WHERE request_letter_path IS NOT NULL;

-- One private file per request, with server-side size and content-type limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('request-letters', 'request-letters', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET public = false,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Validate each new attachment against its uploaded Storage object. Linked
-- attachments cannot be swapped during approval, rejection, or cancellation.
CREATE OR REPLACE FUNCTION public.guard_request_letter()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE object_metadata JSONB; extension TEXT; expected_type TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.request_letter_path IS DISTINCT FROM OLD.request_letter_path
      OR NEW.request_letter_name IS DISTINCT FROM OLD.request_letter_name
      OR NEW.request_letter_type IS DISTINCT FROM OLD.request_letter_type
      OR NEW.request_letter_size IS DISTINCT FROM OLD.request_letter_size THEN
      RAISE EXCEPTION 'A submitted request letter cannot be changed.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.request_letter_path IS NULL THEN
    IF NEW.request_letter_name IS NOT NULL OR NEW.request_letter_type IS NOT NULL
      OR NEW.request_letter_size IS NOT NULL THEN
      RAISE EXCEPTION 'Request letter metadata requires an uploaded file.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() OR NOT public.request_letter_user_is_active()
    OR public.maintenance_is_enabled() THEN
    RAISE EXCEPTION 'You cannot attach a request letter to this request.';
  END IF;
  IF NEW.request_letter_name IS NULL OR trim(NEW.request_letter_name) = ''
    OR NEW.request_letter_size IS NULL OR NEW.request_letter_size NOT BETWEEN 1 AND 10485760
    OR NEW.request_letter_type IS NULL THEN
    RAISE EXCEPTION 'A request letter must have a name, type, and size of at most 10 MB.';
  END IF;
  IF NEW.request_letter_path !~ ('^' || NEW.user_id::TEXT || '/' || NEW.id::TEXT ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|doc|docx)$') THEN
    RAISE EXCEPTION 'Invalid request letter path.';
  END IF;
  extension := split_part(NEW.request_letter_path, '.', 2);
  expected_type := CASE extension WHEN 'pdf' THEN 'application/pdf'
    WHEN 'jpg' THEN 'image/jpeg' WHEN 'jpeg' THEN 'image/jpeg' WHEN 'png' THEN 'image/png'
    WHEN 'doc' THEN 'application/msword'
    WHEN 'docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' END;
  SELECT metadata INTO object_metadata FROM storage.objects
    WHERE bucket_id = 'request-letters' AND name = NEW.request_letter_path;
  IF NOT FOUND OR object_metadata->>'mimetype' IS DISTINCT FROM expected_type
    OR NEW.request_letter_type IS DISTINCT FROM expected_type
    OR (object_metadata->>'size')::BIGINT IS DISTINCT FROM NEW.request_letter_size THEN
    RAISE EXCEPTION 'Upload the matching request letter before submitting the request.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_request_letter() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_request_letter ON public.requests;
CREATE TRIGGER guard_request_letter BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_letter();

DROP POLICY IF EXISTS "DENR request letters upload" ON storage.objects;
CREATE POLICY "DENR request letters upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-letters' AND public.request_letter_user_is_active()
    AND NOT public.maintenance_is_enabled() AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS "DENR request letters read" ON storage.objects;
CREATE POLICY "DENR request letters read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'request-letters' AND public.request_letter_user_is_active()
    AND ((storage.foldername(name))[1] = auth.uid()::TEXT
      OR (public.account_management_is_admin() AND EXISTS (
        SELECT 1 FROM public.requests r WHERE r.request_letter_path = storage.objects.name))));

-- Storage.remove also needs SELECT access. Owners may remove only unlinked
-- uploads (for example, when request submission fails). No overwrite policy.
DROP POLICY IF EXISTS "DENR request letters cleanup" ON storage.objects;
CREATE POLICY "DENR request letters cleanup" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'request-letters' AND public.request_letter_user_is_active()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND NOT EXISTS (SELECT 1 FROM public.requests r WHERE r.request_letter_path = storage.objects.name));

COMMIT;

-- Expected: private bucket, 10485760-byte limit, and the five supported MIME types.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'request-letters';
