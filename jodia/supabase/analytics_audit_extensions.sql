-- DENR Seed Inventory: audit request submissions and maintenance changes.
-- Run after the existing audit_trail migration and system_maintenance_settings.sql.

CREATE OR REPLACE FUNCTION public.audit_request_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_trail (actor_id, action, details, target_type, target_id, metadata)
  VALUES (
    NEW.user_id,
    'Submitted Seed Request',
    format('Requested %s unit(s) for %s.', NEW.quantity, COALESCE(NEW.purpose_category, 'general use')),
    'request', NEW.id,
    jsonb_build_object('seed_id', NEW.seed_id, 'quantity', NEW.quantity, 'planting_site', NEW.planting_site, 'needed_date', NEW.needed_date)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_request_submission ON public.requests;
CREATE TRIGGER audit_request_submission
  AFTER INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_request_submission();

CREATE OR REPLACE FUNCTION public.audit_maintenance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_trail (actor_id, action, details, target_type, target_id, metadata)
  VALUES (
    NEW.updated_by,
    CASE WHEN NEW.maintenance_enabled THEN 'Enabled Maintenance Mode' ELSE 'Disabled Maintenance Mode' END,
    COALESCE(NULLIF(NEW.announcement_message, ''), 'No announcement message.'),
    'system_settings', NULL,
    jsonb_build_object('maintenance_enabled', NEW.maintenance_enabled)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_maintenance_change ON public.system_settings;
CREATE TRIGGER audit_maintenance_change
  AFTER UPDATE OF maintenance_enabled, announcement_message ON public.system_settings
  FOR EACH ROW WHEN (
    OLD.maintenance_enabled IS DISTINCT FROM NEW.maintenance_enabled
    OR OLD.announcement_message IS DISTINCT FROM NEW.announcement_message
  ) EXECUTE FUNCTION public.audit_maintenance_change();
