-- DENR Seed Inventory: rename the final distribution status to RELEASED.
-- Run once after personnel_requests_and_seed_traceability.sql.

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;

-- The personnel-cancellation guard correctly protects browser users, but
-- SQL Editor migrations do not have an auth.uid(). Disable it only for this
-- one controlled data rename and enable it again immediately afterward.
ALTER TABLE public.requests DISABLE TRIGGER guard_personnel_request_cancellation;

UPDATE public.requests
SET status = 'RELEASED', updated_at = NOW()
WHERE status = 'DISBURSED';

ALTER TABLE public.requests ENABLE TRIGGER guard_personnel_request_cancellation;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED', 'READY_FOR_RELEASE', 'RELEASED', 'CANCELLED')
  );
