CREATE TABLE IF NOT EXISTS public.tenant_ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_enabled boolean NOT NULL DEFAULT true,
  preferred_tone text,
  business_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ai_settings TO authenticated;
GRANT ALL ON public.tenant_ai_settings TO service_role;

ALTER TABLE public.tenant_ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_ai_settings_select" ON public.tenant_ai_settings;
CREATE POLICY "tenant_ai_settings_select" ON public.tenant_ai_settings
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_owner_id() AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

DROP POLICY IF EXISTS "tenant_ai_settings_write" ON public.tenant_ai_settings;
CREATE POLICY "tenant_ai_settings_write" ON public.tenant_ai_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_owner_id() AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (tenant_id = public.current_owner_id() AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

DROP TRIGGER IF EXISTS trg_tenant_ai_settings_updated_at ON public.tenant_ai_settings;
CREATE TRIGGER trg_tenant_ai_settings_updated_at
  BEFORE UPDATE ON public.tenant_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();