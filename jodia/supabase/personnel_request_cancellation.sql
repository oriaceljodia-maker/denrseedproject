-- DENR Seed Inventory: let Personnel cancel only their own pending requests.
-- Run after system_maintenance_settings.sql and reserved_stock_and_realtime.sql.

DROP POLICY IF EXISTS "Personnel can cancel own pending requests" ON public.requests;
CREATE POLICY "Personnel can cancel own pending requests" ON public.requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (user_id = auth.uid() AND status = 'CANCELLED');

-- RLS checks the request owner and final status. This trigger additionally
-- prevents Personnel from changing request details while cancelling.
CREATE OR REPLACE FUNCTION public.guard_personnel_request_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    IF OLD.user_id <> auth.uid()
      OR OLD.status <> 'PENDING'
      OR NEW.status <> 'CANCELLED'
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.seed_id IS DISTINCT FROM OLD.seed_id
      OR NEW.quantity IS DISTINCT FROM OLD.quantity
      OR NEW.purpose IS DISTINCT FROM OLD.purpose
      OR NEW.planting_site IS DISTINCT FROM OLD.planting_site
      OR NEW.needed_date IS DISTINCT FROM OLD.needed_date
      OR NEW.purpose_category IS DISTINCT FROM OLD.purpose_category
      OR NEW.beneficiaries_count IS DISTINCT FROM OLD.beneficiaries_count
      OR NEW.contact_number IS DISTINCT FROM OLD.contact_number
      OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
    THEN
      RAISE EXCEPTION 'Personnel may only cancel their own pending request.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_personnel_request_cancellation ON public.requests;
CREATE TRIGGER guard_personnel_request_cancellation
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_request_cancellation();
