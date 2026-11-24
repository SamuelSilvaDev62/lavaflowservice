-- Convert a booking into a work order in one database transaction.
-- A row lock on the booking prevents duplicate OS under concurrent requests.
-- SECURITY INVOKER preserves tenant RLS. Permission is validated against user_roles.
CREATE OR REPLACE FUNCTION public.iniciar_atendimento_atomico(
  p_owner_id uuid,
  p_agendamento_id uuid,
  p_funcionario_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ag public.agendamentos%ROWTYPE;
  v_valor numeric := 0;
  v_funcionario_id uuid;
  v_os_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.owner_id = p_owner_id
       AND ur.role::text IN ('owner', 'admin', 'gerente', 'atendente')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para iniciar este atendimento.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ag
    FROM public.agendamentos
   WHERE id = p_agendamento_id AND owner_id = p_owner_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_ag.ordem_id IS NOT NULL THEN
    RETURN v_ag.ordem_id;
  END IF;
  IF v_ag.status IN ('cancelado', 'nao_compareceu', 'concluido') THEN
    RAISE EXCEPTION 'Não é possível iniciar um agendamento encerrado.'
      USING ERRCODE = '23514';
  END IF;

  IF v_ag.servico_id IS NOT NULL THEN
    SELECT s.preco_padrao INTO v_valor FROM public.servicos s
     WHERE s.id = v_ag.servico_id AND s.owner_id = p_owner_id;
  END IF;
  v_valor := COALESCE(v_valor, 0) + COALESCE(v_ag.taxa_leva_traz, 0);
  v_funcionario_id := COALESCE(v_ag.funcionario_id, p_funcionario_id);
  IF v_funcionario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
     WHERE f.id = v_funcionario_id AND f.owner_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'Responsável não pertence ao estabelecimento.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.ordens_servico (
    owner_id, cliente_id, veiculo_id, servico_id, funcionario_id,
    valor, observacoes, status
  ) VALUES (
    p_owner_id, v_ag.cliente_id, v_ag.veiculo_id, v_ag.servico_id,
    v_funcionario_id, v_valor, v_ag.observacoes, 'aguardando'
  ) RETURNING id INTO v_os_id;

  UPDATE public.agendamentos
     SET status = 'em_andamento',
         ordem_id = v_os_id,
         leva_traz_status = CASE WHEN v_ag.leva_traz THEN 'em_servico' ELSE v_ag.leva_traz_status END
   WHERE id = p_agendamento_id AND owner_id = p_owner_id;

  RETURN v_os_id;
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_atendimento_atomico(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_atendimento_atomico(uuid,uuid,uuid) TO authenticated, service_role;
