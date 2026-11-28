ALTER TABLE public.tenant_subscriptions ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tenant_subscriptions.is_demo IS 'Privileged-only permanent Growth demo grant. Exclude from platform business metrics; deny automatic outbound messaging; AI consumption limits still apply.';
CREATE OR REPLACE FUNCTION public.protect_demo_classification() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF ((TG_OP = 'INSERT' AND NEW.is_demo) OR (TG_OP = 'UPDATE' AND NEW.is_demo IS DISTINCT FROM OLD.is_demo)) AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Demo classification requires privileged authorization' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_demo_classification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_demo_classification BEFORE INSERT OR UPDATE ON public.tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION public.protect_demo_classification();
CREATE VIEW public.admin_real_tenants WITH (security_invoker = true) AS
SELECT e.owner_id, e.id AS empresa_id FROM public.empresa e
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_subscriptions s WHERE s.owner_id = e.owner_id AND s.is_demo);
REVOKE ALL ON public.admin_real_tenants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_real_tenants TO service_role;
COMMENT ON VIEW public.admin_real_tenants IS 'Required owner scope for future platform customer/revenue/retention/usage metrics. Excludes demo tenants. Not a tenant-admin role permission.';