
-- 1.1 user_roles: bloquear escalada de privilégio
DROP POLICY IF EXISTS "owner inserts roles" ON public.user_roles;
DROP POLICY IF EXISTS "owner updates roles" ON public.user_roles;
DROP POLICY IF EXISTS "owner deletes roles" ON public.user_roles;

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
-- SELECT permanece para o usuário ver os próprios papéis (via policy "see own roles")
-- service_role mantém acesso total para os triggers/funções SECURITY DEFINER

-- 1.2 agendamentos: paridade INSERT com UPDATE
DROP POLICY IF EXISTS "agendamentos owner write" ON public.agendamentos;
CREATE POLICY "agendamentos owner write" ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (current_owner_id() = owner_id);

DROP POLICY IF EXISTS "agendamentos delete" ON public.agendamentos;
CREATE POLICY "agendamentos delete" ON public.agendamentos
  FOR DELETE TO authenticated
  USING (current_owner_id() = owner_id);

-- 1.3 Revogar EXECUTE de funções internas
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_owner_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_bootstrap_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_entregue_credita_pontos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_entregue_comissao() FROM PUBLIC, anon, authenticated;

-- 1.4 Funções públicas (página /agendar/$slug) - garantir acesso explícito
GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_servicos_publicos(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agenda_config_publica(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ocupacao_dia(uuid, date) TO anon, authenticated;

-- vincular_colaborador: apenas authenticated (já valida has_role internamente)
GRANT EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) TO authenticated;

-- 1.5 Corrigir trigger AFTER que tenta mutar NEW (sem efeito)
-- Trocar para BEFORE UPDATE para que a atribuição a NEW.entregue_em funcione
DROP TRIGGER IF EXISTS os_entregue_pontos ON public.ordens_servico;
DROP TRIGGER IF EXISTS tg_os_entregue_credita_pontos ON public.ordens_servico;
CREATE TRIGGER tg_os_entregue_credita_pontos
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_os_entregue_credita_pontos();

-- 2.1 Índices de performance
CREATE INDEX IF NOT EXISTS idx_os_owner_created ON public.ordens_servico(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_owner_status ON public.ordens_servico(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_os_cliente_created ON public.ordens_servico(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_funcionario ON public.ordens_servico(funcionario_id) WHERE funcionario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agendamentos_owner_data ON public.agendamentos(owner_id, data_agendada);
CREATE INDEX IF NOT EXISTS idx_interacoes_owner_tipo ON public.interacoes_clientes(owner_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_owner ON public.clientes(owner_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_cliente ON public.veiculos(cliente_id);
