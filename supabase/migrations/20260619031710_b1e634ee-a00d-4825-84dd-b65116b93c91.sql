
-- =====================================================================
-- ONDA 1: Hardening crítico de RLS, GRANTs e SECURITY DEFINER
-- =====================================================================

-- 1.1 — Fechar INSERT cross-tenant em ordens_servico e agendamentos
DROP POLICY IF EXISTS "ordens owner write" ON public.ordens_servico;
CREATE POLICY "ordens insert" ON public.ordens_servico
  FOR INSERT TO authenticated
  WITH CHECK (public.current_owner_id() = owner_id);

DROP POLICY IF EXISTS "agendamentos owner write" ON public.agendamentos;
CREATE POLICY "agendamentos insert" ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_owner_id() = owner_id);

-- 1.2 — Trocar role {public} -> {authenticated} nas 8 tabelas afetadas
-- (mantém a mesma semântica auth.uid() = owner_id para tabelas owner-only;
--  usa current_owner_id() para tabelas operacionais acessíveis a colaboradores)

-- empresa: owner-only
DROP POLICY IF EXISTS "own empresa" ON public.empresa;
CREATE POLICY "empresa owner all" ON public.empresa
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- fidelidade_config: owner-only
DROP POLICY IF EXISTS "own fidelidade_config" ON public.fidelidade_config;
CREATE POLICY "fidelidade_config owner all" ON public.fidelidade_config
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- planos_assinatura: owner-only (configuração de planos)
DROP POLICY IF EXISTS "own planos" ON public.planos_assinatura;
CREATE POLICY "planos owner all" ON public.planos_assinatura
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- recompensas: owner-only (configuração de recompensas)
DROP POLICY IF EXISTS "own recompensas" ON public.recompensas;
CREATE POLICY "recompensas owner all" ON public.recompensas
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- assinaturas_clientes: operacional (colaboradores podem ver/atualizar)
DROP POLICY IF EXISTS "own assinaturas" ON public.assinaturas_clientes;
CREATE POLICY "assinaturas tenant all" ON public.assinaturas_clientes
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

-- avaliacoes: operacional
DROP POLICY IF EXISTS "own avaliacoes" ON public.avaliacoes;
CREATE POLICY "avaliacoes tenant all" ON public.avaliacoes
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

-- interacoes_clientes: operacional
DROP POLICY IF EXISTS "own interacoes" ON public.interacoes_clientes;
CREATE POLICY "interacoes tenant all" ON public.interacoes_clientes
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

-- pontos_movimentos: operacional (lançado por triggers / colaboradores)
DROP POLICY IF EXISTS "own pontos" ON public.pontos_movimentos;
CREATE POLICY "pontos tenant all" ON public.pontos_movimentos
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

-- 1.2b — Adicionar WITH CHECK simétrico em policies FOR ALL existentes
-- que só tinham USING (proteção contra UPDATE que muda owner_id)
DROP POLICY IF EXISTS "clientes owner write" ON public.clientes;
CREATE POLICY "clientes owner write" ON public.clientes
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "func owner write" ON public.funcionarios;
CREATE POLICY "func owner write" ON public.funcionarios
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "servicos owner write" ON public.servicos;
CREATE POLICY "servicos owner write" ON public.servicos
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "veiculos owner write" ON public.veiculos;
CREATE POLICY "veiculos owner write" ON public.veiculos
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "agenda_config write" ON public.agenda_config;
CREATE POLICY "agenda_config write" ON public.agenda_config
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own comissoes" ON public.comissoes;
CREATE POLICY "comissoes tenant all" ON public.comissoes
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

DROP POLICY IF EXISTS "own comissoes_servico" ON public.comissoes_servico;
CREATE POLICY "comissoes_servico tenant all" ON public.comissoes_servico
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

DROP POLICY IF EXISTS "own pagamentos_comissao" ON public.pagamentos_comissao;
CREATE POLICY "pagamentos_comissao tenant all" ON public.pagamentos_comissao
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

-- 1.3 — GRANTs explícitos em todas as 19 tabelas públicas (auth-only)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas_clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes_servico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidelidade_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interacoes_clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_comissao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_assinatura TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pontos_movimentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recompensas TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;

GRANT ALL ON public.agenda_config TO service_role;
GRANT ALL ON public.agendamentos TO service_role;
GRANT ALL ON public.assinaturas_clientes TO service_role;
GRANT ALL ON public.avaliacoes TO service_role;
GRANT ALL ON public.clientes TO service_role;
GRANT ALL ON public.comissoes TO service_role;
GRANT ALL ON public.comissoes_servico TO service_role;
GRANT ALL ON public.empresa TO service_role;
GRANT ALL ON public.fidelidade_config TO service_role;
GRANT ALL ON public.funcionarios TO service_role;
GRANT ALL ON public.interacoes_clientes TO service_role;
GRANT ALL ON public.ordens_servico TO service_role;
GRANT ALL ON public.pagamentos_comissao TO service_role;
GRANT ALL ON public.planos_assinatura TO service_role;
GRANT ALL ON public.pontos_movimentos TO service_role;
GRANT ALL ON public.recompensas TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.servicos TO service_role;
GRANT ALL ON public.veiculos TO service_role;

-- 1.4 — Hardening de funções SECURITY DEFINER
-- Internas: revogar EXECUTE de PUBLIC/anon, manter authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_owner_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_owner_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) TO authenticated;

-- Triggers internas: revogar de PUBLIC (não devem ser invocáveis via Data API)
REVOKE EXECUTE ON FUNCTION public.tg_bootstrap_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_entregue_credita_pontos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_entregue_comissao() FROM PUBLIC, anon, authenticated;

-- Funções públicas de booking: continuam acessíveis a anon (API pública)
-- get_empresa_by_slug, get_servicos_publicos, get_ocupacao_dia, get_agenda_config_publica
-- já estão como SECURITY DEFINER com projeção segura — mantidas.
