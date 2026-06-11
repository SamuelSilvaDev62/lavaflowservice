
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS slug text UNIQUE;

UPDATE public.empresa
SET slug = 'lava-' || substring(id::text, 1, 8)
WHERE slug IS NULL;

DO $$ BEGIN
  CREATE TYPE agendamento_status AS ENUM ('agendado','confirmado','em_andamento','concluido','cancelado','nao_compareceu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.agenda_config (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hora_inicio time NOT NULL DEFAULT '08:00',
  hora_fim time NOT NULL DEFAULT '18:00',
  dias_semana int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  intervalo_min int NOT NULL DEFAULT 30 CHECK (intervalo_min IN (15,30,60)),
  capacidade_simultanea int NOT NULL DEFAULT 1 CHECK (capacidade_simultanea BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_config TO authenticated;
GRANT ALL ON public.agenda_config TO service_role;
ALTER TABLE public.agenda_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agenda_config leitura" ON public.agenda_config
  FOR SELECT TO authenticated USING (current_owner_id() = owner_id);
CREATE POLICY "agenda_config write" ON public.agenda_config
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  servico_id uuid REFERENCES public.servicos(id) ON DELETE SET NULL,
  data_agendada date NOT NULL,
  hora_agendada time NOT NULL,
  status agendamento_status NOT NULL DEFAULT 'agendado',
  observacoes text,
  ordem_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'interno',
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmado_em timestamptz,
  cancelado_em timestamptz,
  concluido_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_owner_data ON public.agendamentos(owner_id, data_agendada);
CREATE INDEX IF NOT EXISTS idx_agendamentos_owner_status ON public.agendamentos(owner_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agendamentos leitura" ON public.agendamentos
  FOR SELECT TO authenticated USING (current_owner_id() = owner_id);
CREATE POLICY "agendamentos owner write" ON public.agendamentos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "agendamentos update" ON public.agendamentos
  FOR UPDATE TO authenticated USING (current_owner_id() = owner_id) WITH CHECK (current_owner_id() = owner_id);
CREATE POLICY "agendamentos delete" ON public.agendamentos
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.tg_bootstrap_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  RETURN NEW;
END;
$$;

-- Garante agenda_config pra empresas já existentes
INSERT INTO public.agenda_config(owner_id)
SELECT owner_id FROM public.empresa
ON CONFLICT (owner_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(_slug text)
RETURNS TABLE(id uuid, owner_id uuid, nome_fantasia text, telefone text, whatsapp text, endereco text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, owner_id, nome_fantasia, telefone, whatsapp, endereco, slug
  FROM public.empresa WHERE slug = _slug LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_servicos_publicos(_owner uuid)
RETURNS TABLE(id uuid, nome text, preco_padrao numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome, preco_padrao FROM public.servicos
  WHERE owner_id = _owner AND ativo = true ORDER BY nome;
$$;
GRANT EXECUTE ON FUNCTION public.get_servicos_publicos(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_ocupacao_dia(_owner uuid, _data date)
RETURNS TABLE(hora_agendada time, qtd bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hora_agendada, count(*)::bigint
  FROM public.agendamentos
  WHERE owner_id = _owner AND data_agendada = _data
    AND status NOT IN ('cancelado','nao_compareceu')
  GROUP BY hora_agendada;
$$;
GRANT EXECUTE ON FUNCTION public.get_ocupacao_dia(uuid, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_agenda_config_publica(_owner uuid)
RETURNS TABLE(hora_inicio time, hora_fim time, dias_semana int[], intervalo_min int, capacidade_simultanea int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hora_inicio, hora_fim, dias_semana, intervalo_min, capacidade_simultanea
  FROM public.agenda_config WHERE owner_id = _owner LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_agenda_config_publica(uuid) TO anon, authenticated;
