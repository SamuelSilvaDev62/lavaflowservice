-- 1) Slug público: reforço de formato (unicidade já existe em empresa_slug_key)
ALTER TABLE public.empresa
  ADD CONSTRAINT empresa_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9](?:[a-z0-9-]{1,78})[a-z0-9]$') NOT VALID;

-- Normaliza slugs existentes fora do padrão (mantém unicidade)
UPDATE public.empresa
   SET slug = 'lava-' || substring(id::text, 1, 8)
 WHERE slug IS NOT NULL
   AND slug !~ '^[a-z0-9](?:[a-z0-9-]{1,78})[a-z0-9]$';

UPDATE public.empresa
   SET slug = 'lava-' || substring(id::text, 1, 8)
 WHERE slug IS NULL;

ALTER TABLE public.empresa VALIDATE CONSTRAINT empresa_slug_format;

-- 2) Enum de planos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_plan') THEN
    CREATE TYPE public.app_plan AS ENUM ('essencial', 'growth', 'intelligence');
  END IF;
END $$;

-- 3) Assinatura por tenant (owner_id = tenant)
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.app_plan,
  subscription_status text NOT NULL DEFAULT 'trialing',
  is_founders boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_subscriptions_select_gestao" ON public.tenant_subscriptions;
CREATE POLICY "tenant_subscriptions_select_gestao"
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (owner_id = public.current_owner_id());

CREATE TRIGGER trg_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS tenant_subscriptions_customer_idx
  ON public.tenant_subscriptions(stripe_customer_id);

-- 4) Idempotência de webhooks Stripe (somente servidor)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text NOT NULL PRIMARY KEY,
  type text NOT NULL,
  owner_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_webhook_events_no_client" ON public.stripe_webhook_events;
CREATE POLICY "stripe_webhook_events_no_client"
  ON public.stripe_webhook_events AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- 5) Plano vigente do tenant atual (leitura segura pelo app)
CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS TABLE(
  plan text,
  subscription_status text,
  is_founders boolean,
  stripe_price_id text,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean,
  has_customer boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ts.plan::text,
         ts.subscription_status,
         ts.is_founders,
         ts.stripe_price_id,
         ts.current_period_end,
         ts.trial_ends_at,
         ts.cancel_at_period_end,
         ts.stripe_customer_id IS NOT NULL
  FROM public.tenant_subscriptions ts
  WHERE ts.owner_id = public.current_owner_id()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

-- 6) Geração de slug público único e estável por estabelecimento
CREATE OR REPLACE FUNCTION public.unaccent_fallback(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(coalesce(_input, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

CREATE OR REPLACE FUNCTION public.slugify_public(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(lower(public.unaccent_fallback(_input)), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g')
  )
$$;

-- 7) Bootstrap de novos tenants: trial de 14 dias, sem premium silencioso
CREATE OR REPLACE FUNCTION public.tg_bootstrap_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.empresa(owner_id, nome_fantasia, slug)
  VALUES (NEW.id, 'Meu Lava-Rápido', 'lava-' || substring(NEW.id::text, 1, 8))
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.fidelidade_config(owner_id) VALUES (NEW.id)
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, owner_id, role)
  VALUES (NEW.id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.agenda_config(owner_id) VALUES (NEW.id)
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.tenant_subscriptions(owner_id, plan, subscription_status, trial_ends_at)
  VALUES (NEW.id, NULL, 'trialing', now() + interval '14 days')
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 8) Tenants existentes ganham registro de trial (não concede premium por acidente)
INSERT INTO public.tenant_subscriptions(owner_id, plan, subscription_status, trial_ends_at)
SELECT e.owner_id, NULL, 'trialing', now() + interval '14 days'
FROM public.empresa e
ON CONFLICT (owner_id) DO NOTHING;