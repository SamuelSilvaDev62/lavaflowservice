
-- ====== FUNCIONARIOS: modo de comissão ======
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS comissao_modo text NOT NULL DEFAULT 'global';

ALTER TABLE public.funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_comissao_modo_check;
ALTER TABLE public.funcionarios
  ADD CONSTRAINT funcionarios_comissao_modo_check
  CHECK (comissao_modo IN ('global','por_servico'));

-- ====== COMISSOES POR SERVIÇO ======
CREATE TABLE IF NOT EXISTS public.comissoes_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('fixo','percentual')),
  valor numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, servico_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes_servico TO authenticated;
GRANT ALL ON public.comissoes_servico TO service_role;
ALTER TABLE public.comissoes_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own comissoes_servico"
  ON public.comissoes_servico
  FOR ALL TO authenticated
  USING (current_owner_id() = owner_id)
  WITH CHECK (current_owner_id() = owner_id);

CREATE INDEX IF NOT EXISTS idx_comsv_owner_func ON public.comissoes_servico(owner_id, funcionario_id);

-- ====== PAGAMENTOS DE COMISSÃO ======
CREATE TABLE IF NOT EXISTS public.pagamentos_comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  observacao text,
  pago_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_comissao TO authenticated;
GRANT ALL ON public.pagamentos_comissao TO service_role;
ALTER TABLE public.pagamentos_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pagamentos_comissao"
  ON public.pagamentos_comissao
  FOR ALL TO authenticated
  USING (current_owner_id() = owner_id)
  WITH CHECK (current_owner_id() = owner_id);

CREATE INDEX IF NOT EXISTS idx_pgcom_owner_func ON public.pagamentos_comissao(owner_id, funcionario_id, pago_em DESC);

-- ====== COMISSOES: linkar a pagamento ======
ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS pagamento_id uuid
  REFERENCES public.pagamentos_comissao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comissoes_pagamento ON public.comissoes(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_owner_pagto ON public.comissoes(owner_id, funcionario_id) WHERE pagamento_id IS NULL;

-- ====== TRIGGER: respeitar comissões por serviço ======
CREATE OR REPLACE FUNCTION public.tg_os_entregue_comissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  f public.funcionarios%ROWTYPE;
  cs public.comissoes_servico%ROWTYPE;
  v_valor numeric(10,2);
  v_tipo text;
BEGIN
  IF NEW.status = 'entregue' AND (OLD.status IS DISTINCT FROM 'entregue') AND NEW.funcionario_id IS NOT NULL THEN
    SELECT * INTO f FROM public.funcionarios WHERE id = NEW.funcionario_id;
    IF f.id IS NOT NULL THEN
      v_valor := NULL;
      v_tipo := f.comissao_tipo;

      IF f.comissao_modo = 'por_servico' AND NEW.servico_id IS NOT NULL THEN
        SELECT * INTO cs FROM public.comissoes_servico
          WHERE funcionario_id = f.id AND servico_id = NEW.servico_id LIMIT 1;
        IF cs.id IS NOT NULL THEN
          v_tipo := cs.tipo;
          IF cs.tipo = 'percentual' THEN
            v_valor := ROUND(COALESCE(NEW.valor,0) * COALESCE(cs.valor,0) / 100, 2);
          ELSE
            v_valor := COALESCE(cs.valor, 0);
          END IF;
        END IF;
      END IF;

      IF v_valor IS NULL THEN
        IF f.comissao_tipo = 'percentual' THEN
          v_valor := ROUND(COALESCE(NEW.valor,0) * COALESCE(f.comissao_valor,0) / 100, 2);
        ELSE
          v_valor := COALESCE(f.comissao_valor, 0);
        END IF;
      END IF;

      IF v_valor > 0 THEN
        INSERT INTO public.comissoes(owner_id, funcionario_id, ordem_id, valor, tipo)
        VALUES (NEW.owner_id, NEW.funcionario_id, NEW.id, v_valor, v_tipo)
        ON CONFLICT (ordem_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ====== AGENDAMENTOS: colaborador responsável ======
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS funcionario_id uuid
  REFERENCES public.funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agend_owner_data_func
  ON public.agendamentos(owner_id, data_agendada, funcionario_id);

-- ====== CLIENTES: campos extras ======
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- ====== VEICULOS: marca ======
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS marca text;
