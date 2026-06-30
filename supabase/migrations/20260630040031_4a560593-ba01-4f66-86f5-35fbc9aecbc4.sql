CREATE TABLE IF NOT EXISTS public.tenant_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  ai_enabled boolean NOT NULL DEFAULT true,
  monthly_token_limit integer NOT NULL DEFAULT 200000,
  monthly_task_limit integer NOT NULL DEFAULT 300,
  auto_insights_enabled boolean NOT NULL DEFAULT true,
  auto_execute_enabled boolean NOT NULL DEFAULT false,
  preferred_tone text NOT NULL DEFAULT 'profissional',
  business_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ai_settings TO authenticated;
GRANT ALL ON public.tenant_ai_settings TO service_role;

ALTER TABLE public.tenant_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_ai_settings_select_members"
  ON public.tenant_ai_settings FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_owner_id());

CREATE POLICY "tenant_ai_settings_insert_admin"
  ON public.tenant_ai_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_owner_id()
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  );

CREATE POLICY "tenant_ai_settings_update_admin"
  ON public.tenant_ai_settings FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_owner_id()
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  )
  WITH CHECK (
    tenant_id = public.current_owner_id()
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  );

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_tenant_ai_settings ON public.tenant_ai_settings;
CREATE TRIGGER set_updated_at_tenant_ai_settings
  BEFORE UPDATE ON public.tenant_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();