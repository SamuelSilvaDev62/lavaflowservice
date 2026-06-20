-- Operational dashboard, Leva e Traz, collaborator capacity and notifications

ALTER TABLE public.agenda_config
  ADD COLUMN IF NOT EXISTS permitir_escolha_profissional boolean NOT NULL DEFAULT false;

ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS especialidades text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS horario_inicio time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS horario_fim time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS dias_disponiveis int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS capacidade_por_horario int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tempo_medio_servicos jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_capacidade_por_horario_check;
ALTER TABLE public.funcionarios
  ADD CONSTRAINT funcionarios_capacidade_por_horario_check
  CHECK (capacidade_por_horario BETWEEN 1 AND 20);

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS leva_traz boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS endereco_retirada text,
  ADD COLUMN IF NOT EXISTS endereco_devolucao text,
  ADD COLUMN IF NOT EXISTS horario_retirada time,
  ADD COLUMN IF NOT EXISTS horario_devolucao time,
  ADD COLUMN IF NOT EXISTS observacoes_leva_traz text,
  ADD COLUMN IF NOT EXISTS taxa_leva_traz numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leva_traz_status text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_leva_traz_status_check;
ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_leva_traz_status_check
  CHECK (leva_traz_status IN ('pendente','retirada_agendada','retirado','em_servico','pronto_para_devolucao','devolvido','cancelado'));

CREATE INDEX IF NOT EXISTS idx_agend_leva_traz
  ON public.agendamentos(owner_id, data_agendada, leva_traz)
  WHERE leva_traz = true;

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  prioridade text NOT NULL DEFAULT 'baixa',
  titulo text NOT NULL,
  mensagem text NOT NULL,
  rota text,
  referencia_tipo text,
  referencia_id uuid,
  lida boolean NOT NULL DEFAULT false,
  ignorada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes
  DROP CONSTRAINT IF EXISTS notificacoes_prioridade_check;
ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacoes_prioridade_check
  CHECK (prioridade IN ('alta','media','baixa'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificacoes tenant select" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes tenant write" ON public.notificacoes;

CREATE POLICY "notificacoes tenant select"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id);

CREATE POLICY "notificacoes tenant write"
  ON public.notificacoes FOR ALL TO authenticated
  USING (
    public.current_owner_id() = owner_id
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[])
  )
  WITH CHECK (
    public.current_owner_id() = owner_id
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[])
  );
