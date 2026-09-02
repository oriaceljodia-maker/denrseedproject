-- DENR Seed Inventory: personnel request details and basic seed traceability.
-- Run this once in the Supabase SQL Editor. It is safe to rerun.

ALTER TABLE public.seeds
  ADD COLUMN IF NOT EXISTS seedlot_no TEXT,
  ADD COLUMN IF NOT EXISTS ipt_no TEXT,
  ADD COLUMN IF NOT EXISTS date_collected DATE;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS planting_site TEXT,
  ADD COLUMN IF NOT EXISTS needed_date DATE,
  ADD COLUMN IF NOT EXISTS purpose_category TEXT,
  ADD COLUMN IF NOT EXISTS beneficiaries_count INTEGER CHECK (beneficiaries_count IS NULL OR beneficiaries_count >= 0),
  ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- Add the request stages used by the personnel status timeline.
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED', 'READY_FOR_RELEASE', 'DISBURSED', 'CANCELLED')
  );

CREATE INDEX IF NOT EXISTS idx_requests_needed_date ON public.requests (needed_date);
