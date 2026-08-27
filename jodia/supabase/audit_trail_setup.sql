-- REQUIRED SUPABASE MIGRATION
-- Run this once in the Supabase SQL Editor. It creates an immutable audit trail
-- for administrative inventory, request-status, and account-status actions.
-- Existing successful-login records remain in login_activity and are combined
-- with these entries by the application.

CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at
  ON public.audit_trail (created_at DESC);

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Do not allow browser clients to insert, alter, or delete audit history.
REVOKE ALL ON public.audit_trail FROM anon, authenticated;
GRANT SELECT ON public.audit_trail TO authenticated;

DROP POLICY IF EXISTS "Admins can view audit trail" ON public.audit_trail;
CREATE POLICY "Admins can view audit trail" ON public.audit_trail
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.write_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_action TEXT;
  audit_details TEXT;
  audit_target_type TEXT;
  audit_target_id UUID;
  audit_metadata JSONB := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'seeds' THEN
    audit_target_type := 'seed';

    IF TG_OP = 'INSERT' THEN
      audit_target_id := NEW.id;
      audit_action := 'Added Seed: ' || NEW.species_name;
      audit_details := 'New seed variety added to inventory.';
    ELSIF TG_OP = 'DELETE' THEN
      audit_target_id := OLD.id;
      audit_action := 'Deleted Seed: ' || OLD.species_name;
      audit_details := 'Seed variety removed from inventory.';
    ELSE
      audit_target_id := NEW.id;
      IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
        audit_action := 'Adjusted Stock: ' || NEW.species_name;
        audit_details := format('Stock changed from %s to %s packs.', OLD.quantity, NEW.quantity);
        audit_metadata := jsonb_build_object('previous_quantity', OLD.quantity, 'new_quantity', NEW.quantity);
      ELSE
        audit_action := 'Updated Seed: ' || NEW.species_name;
        audit_details := 'Seed inventory details updated.';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'requests' THEN
    audit_target_type := 'request';
    audit_target_id := NEW.id;
    audit_action := 'Request ' || initcap(lower(NEW.status));
    audit_details := format('Request status changed from %s to %s.', OLD.status, NEW.status);
    audit_metadata := jsonb_build_object('previous_status', OLD.status, 'new_status', NEW.status);
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    audit_target_type := 'profile';
    audit_target_id := NEW.id;
    audit_action := CASE WHEN NEW.is_active THEN 'Enabled Account' ELSE 'Disabled Account' END;
    audit_details := 'Account status changed for ' || COALESCE(NEW.full_name, 'user') || '.';
    audit_metadata := jsonb_build_object('is_active', NEW.is_active);
  END IF;

  INSERT INTO public.audit_trail (actor_id, action, details, target_type, target_id, metadata)
  VALUES (auth.uid(), audit_action, audit_details, audit_target_type, audit_target_id, audit_metadata);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_seed_changes ON public.seeds;
CREATE TRIGGER audit_seed_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.seeds
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_trail();

DROP TRIGGER IF EXISTS audit_request_status_changes ON public.requests;
CREATE TRIGGER audit_request_status_changes
  AFTER UPDATE OF status ON public.requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.write_audit_trail();

DROP TRIGGER IF EXISTS audit_account_status_changes ON public.profiles;
CREATE TRIGGER audit_account_status_changes
  AFTER UPDATE OF is_active ON public.profiles
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION public.write_audit_trail();
