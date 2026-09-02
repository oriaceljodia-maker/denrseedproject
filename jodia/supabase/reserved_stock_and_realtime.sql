-- DENR Seed Inventory: reserved stock for pending requests and live updates.
-- Run after personnel_requests_and_seed_traceability.sql.

ALTER TABLE public.seeds
  ADD COLUMN IF NOT EXISTS reserved_quantity NUMERIC NOT NULL DEFAULT 0
  CHECK (reserved_quantity >= 0);

CREATE OR REPLACE FUNCTION public.manage_request_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE available_quantity NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT quantity - reserved_quantity INTO available_quantity FROM public.seeds WHERE id = NEW.seed_id FOR UPDATE;
    IF available_quantity IS NULL OR NEW.quantity > available_quantity THEN
      RAISE EXCEPTION 'Requested quantity exceeds the currently available stock.';
    END IF;
    IF NEW.status = 'PENDING' THEN
      UPDATE public.seeds SET reserved_quantity = reserved_quantity + NEW.quantity, updated_at = NOW() WHERE id = NEW.seed_id;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED', 'CANCELLED') THEN
    UPDATE public.seeds
    SET reserved_quantity = GREATEST(reserved_quantity - OLD.quantity, 0), updated_at = NOW()
    WHERE id = OLD.seed_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manage_request_reservation ON public.requests;
CREATE TRIGGER manage_request_reservation
  BEFORE INSERT OR UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.manage_request_reservation();

-- Existing approval trigger continues to deduct actual stock when status changes to APPROVED.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'seeds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seeds;
  END IF;
END $$;
