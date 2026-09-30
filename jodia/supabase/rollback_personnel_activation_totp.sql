-- DENR Seed Inventory rollback: remove no-email activation, recovery codes,
-- and mandatory personnel TOTP. Run ONCE only after the code rollback deploys.
-- This restores the previous manual temporary-password account workflow.

BEGIN;

-- Restore the previous active-personnel policies before removing the helper.
DROP POLICY IF EXISTS "Portal users can view active seeds" ON public.seeds;
DROP POLICY IF EXISTS "Active users can view active seeds" ON public.seeds;
CREATE POLICY "Active users can view active seeds" ON public.seeds
  FOR SELECT TO authenticated USING (public.current_profile_is_active());

DROP POLICY IF EXISTS "Portal users view permitted requests" ON public.requests;
DROP POLICY IF EXISTS "Active users view permitted requests" ON public.requests;
CREATE POLICY "Active users view permitted requests" ON public.requests
  FOR SELECT TO authenticated
  USING (public.current_profile_is_active() AND (user_id = auth.uid() OR public.current_user_is_admin()));

DROP POLICY IF EXISTS "Portal personnel submit requests" ON public.requests;
DROP POLICY IF EXISTS "Active personnel submit own requests" ON public.requests;
CREATE POLICY "Active personnel submit own requests" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_is_active() AND user_id = auth.uid() AND NOT public.maintenance_is_enabled());

DROP POLICY IF EXISTS "Portal personnel cancel own pending request" ON public.requests;
DROP POLICY IF EXISTS "Active personnel cancel own pending request" ON public.requests;
CREATE POLICY "Active personnel cancel own pending request" ON public.requests
  FOR UPDATE TO authenticated
  USING (public.current_profile_is_active() AND user_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (public.current_profile_is_active() AND user_id = auth.uid() AND status = 'CANCELLED');

REVOKE ALL ON FUNCTION public.create_personnel_activation_account(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_personnel_recovery_code(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_personnel_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_personnel_recovery_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_password_setup_complete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_personnel_activation() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.complete_personnel_activation();
DROP FUNCTION IF EXISTS public.mark_password_setup_complete();
DROP FUNCTION IF EXISTS public.validate_personnel_activation();
DROP FUNCTION IF EXISTS public.validate_personnel_recovery_code();
DROP FUNCTION IF EXISTS public.issue_personnel_recovery_code(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_personnel_activation_account(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.current_user_can_use_portal();

DROP TABLE IF EXISTS public.personnel_account_recoveries;
DROP TABLE IF EXISTS public.personnel_account_activations;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS requires_totp_setup,
  DROP COLUMN IF EXISTS activation_expires_at,
  DROP COLUMN IF EXISTS activation_completed_at,
  DROP COLUMN IF EXISTS recovery_expires_at,
  DROP COLUMN IF EXISTS email;

COMMIT;
