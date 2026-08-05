-- ============================================================
-- DENR Seed Inventory - Supabase Functions, Triggers & Policies
-- ============================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Automatic Stock Deduction Trigger on Request Approval
CREATE OR REPLACE FUNCTION handle_seed_request_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to 'APPROVED'
  IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    -- Verify adequate inventory
    IF (SELECT quantity FROM public.seeds WHERE id = NEW.seed_id) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient seed quantity in inventory.';
    END IF;

    -- Deduct approved quantity from seeds table
    UPDATE public.seeds
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.seed_id;
  END IF;

  -- Restore stock if an approved request is rejected or cancelled
  IF NEW.status IN ('REJECTED', 'CANCELLED') AND OLD.status = 'APPROVED' THEN
    UPDATE public.seeds
    SET quantity = quantity + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.seed_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_request_approved
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_seed_request_approval();


-- 2. Admin RPC Function to Provision Personnel Accounts
-- NOTE: This function creates a profile record. For a fully working
-- account, pair this with a Supabase Edge Function using the Admin API
-- (service_role) to create the actual auth user, then insert the profile
-- with the real auth user id. The profile id MUST match the auth.users.id.
CREATE OR REPLACE FUNCTION create_new_user_account(
  user_email TEXT,
  user_full_name TEXT,
  user_role TEXT DEFAULT 'personnel'
)
RETURNS JSONB AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Ensure caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only system admins can create user accounts.';
  END IF;

  -- Validate role
  IF user_role NOT IN ('admin', 'personnel') THEN
    RAISE EXCEPTION 'Invalid role. Must be "admin" or "personnel".';
  END IF;

  -- Create profile row (id must match an existing auth.users.id)
  -- IMPORTANT: This requires the auth user to already exist.
  -- Use the Supabase Admin API / Edge Function to create the auth user first,
  -- then pass the returned user id to this function.
  INSERT INTO public.profiles (id, full_name, role, requires_password_change, is_active)
  VALUES (gen_random_uuid(), user_full_name, user_role, true, true)
  RETURNING id INTO new_user_id;

  RETURN jsonb_build_object('user_id', new_user_id, 'status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Row-Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles reading" ON public.profiles FOR SELECT USING (true);

-- Users can update their own profile BUT cannot change role or is_active
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users cannot escalate role or reactivate" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Prevent role escalation and self-reactivation
    (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
    AND (is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid()))
  );

-- Seeds Policies
CREATE POLICY "Anyone authenticated can view seeds" ON public.seeds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert seeds" ON public.seeds FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update seeds" ON public.seeds FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete seeds" ON public.seeds FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Requests Policies
CREATE POLICY "Users view own or admin views all requests" ON public.requests FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Personnel can only submit requests for themselves
CREATE POLICY "Personnel can submit own requests" ON public.requests FOR INSERT WITH CHECK (
  user_id = auth.uid() AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can update request status" ON public.requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);