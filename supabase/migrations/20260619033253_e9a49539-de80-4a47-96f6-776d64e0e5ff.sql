-- =========================================================
-- 1. HELPERS DE AUTORIZAÇÃO
-- =========================================================

CREATE OR REPLACE FUNCTION public.has_any_role(_user uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user AND role = ANY (_roles)
  )
$$;

-- Papel efetivo do usuário no tenant atual (maior privilégio)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role::text
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'gerente' THEN 3
    WHEN 'atendente' THEN 4
    WHEN 'lavador' THEN 5
    WHEN 'colaborador' THEN 5
    ELSE 99 END
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- =========================================================
-- 2. POLICIES — RECRIAR COM PAPÉIS
-- =========================================================

-- Conjuntos:
--   ADMIN  = {owner, admin}
--   GESTAO = {owner, admin, gerente}
--   OPER   = {owner, admin, gerente, atendente}
--   COLAB  = {lavador, colaborador}

------ EMPRESA ------
DROP POLICY IF EXISTS "empresa owner all" ON public.empresa;
CREATE POLICY "empresa select" ON public.empresa FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "empresa write" ON public.empresa FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ AGENDA_CONFIG ------
DROP POLICY IF EXISTS "agenda_config leitura" ON public.agenda_config;
DROP POLICY IF EXISTS "agenda_config write" ON public.agenda_config;
CREATE POLICY "agenda_config select" ON public.agenda_config FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "agenda_config write" ON public.agenda_config FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ FIDELIDADE_CONFIG ------
DROP POLICY IF EXISTS "fidelidade_config owner all" ON public.fidelidade_config;
CREATE POLICY "fidelidade_config select" ON public.fidelidade_config FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "fidelidade_config write" ON public.fidelidade_config FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ PLANOS_ASSINATURA ------
DROP POLICY IF EXISTS "planos owner all" ON public.planos_assinatura;
CREATE POLICY "planos select" ON public.planos_assinatura FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "planos write" ON public.planos_assinatura FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ RECOMPENSAS ------
DROP POLICY IF EXISTS "recompensas owner all" ON public.recompensas;
CREATE POLICY "recompensas select" ON public.recompensas FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "recompensas write" ON public.recompensas FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ SERVICOS ------
DROP POLICY IF EXISTS "servicos leitura" ON public.servicos;
DROP POLICY IF EXISTS "servicos owner write" ON public.servicos;
CREATE POLICY "servicos select" ON public.servicos FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id);
CREATE POLICY "servicos write" ON public.servicos FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ COMISSOES_SERVICO ------
DROP POLICY IF EXISTS "comissoes_servico tenant all" ON public.comissoes_servico;
CREATE POLICY "comissoes_servico select" ON public.comissoes_servico FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[]));
CREATE POLICY "comissoes_servico write" ON public.comissoes_servico FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ FUNCIONARIOS ------
DROP POLICY IF EXISTS "func leitura" ON public.funcionarios;
DROP POLICY IF EXISTS "func owner write" ON public.funcionarios;
CREATE POLICY "funcionarios select" ON public.funcionarios FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[]))
  );
CREATE POLICY "funcionarios write" ON public.funcionarios FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ USER_ROLES ------
DROP POLICY IF EXISTS "see own roles" ON public.user_roles;
CREATE POLICY "user_roles select" ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  );
-- writes em user_roles continuam restritos: só via vincular_colaborador (SECURITY DEFINER)

------ CLIENTES ------
DROP POLICY IF EXISTS "clientes leitura" ON public.clientes;
DROP POLICY IF EXISTS "clientes owner write" ON public.clientes;
CREATE POLICY "clientes select" ON public.clientes FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "clientes write" ON public.clientes FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));

------ VEICULOS ------
DROP POLICY IF EXISTS "veiculos leitura" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos owner write" ON public.veiculos;
CREATE POLICY "veiculos select" ON public.veiculos FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "veiculos write" ON public.veiculos FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));

------ AGENDAMENTOS (lavador vê apenas os seus) ------
DROP POLICY IF EXISTS "agendamentos leitura" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos insert" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos update" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos delete" ON public.agendamentos;
CREATE POLICY "agendamentos select" ON public.agendamentos FOR SELECT TO authenticated
  USING (
    (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
    OR (
      has_any_role(auth.uid(), ARRAY['lavador','colaborador']::app_role[])
      AND funcionario_id IN (SELECT id FROM public.funcionarios WHERE auth_user_id = auth.uid())
    )
  );
CREATE POLICY "agendamentos insert" ON public.agendamentos FOR INSERT TO authenticated
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "agendamentos update" ON public.agendamentos FOR UPDATE TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "agendamentos delete" ON public.agendamentos FOR DELETE TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[]));

------ ORDENS_SERVICO ------
DROP POLICY IF EXISTS "ordens leitura" ON public.ordens_servico;
DROP POLICY IF EXISTS "ordens insert" ON public.ordens_servico;
DROP POLICY IF EXISTS "ordens update" ON public.ordens_servico;
DROP POLICY IF EXISTS "ordens owner delete" ON public.ordens_servico;
CREATE POLICY "ordens select" ON public.ordens_servico FOR SELECT TO authenticated
  USING (
    (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
    OR (
      has_any_role(auth.uid(), ARRAY['lavador','colaborador']::app_role[])
      AND funcionario_id IN (SELECT id FROM public.funcionarios WHERE auth_user_id = auth.uid())
    )
  );
CREATE POLICY "ordens insert" ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
-- Lavador pode atualizar status da própria OS; demais perfis com permissão geral
CREATE POLICY "ordens update" ON public.ordens_servico FOR UPDATE TO authenticated
  USING (
    (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
    OR (
      has_any_role(auth.uid(), ARRAY['lavador','colaborador']::app_role[])
      AND funcionario_id IN (SELECT id FROM public.funcionarios WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
    OR (
      has_any_role(auth.uid(), ARRAY['lavador','colaborador']::app_role[])
      AND funcionario_id IN (SELECT id FROM public.funcionarios WHERE auth_user_id = auth.uid())
    )
  );
CREATE POLICY "ordens delete" ON public.ordens_servico FOR DELETE TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ COMISSOES ------
DROP POLICY IF EXISTS "comissoes tenant all" ON public.comissoes;
CREATE POLICY "comissoes select" ON public.comissoes FOR SELECT TO authenticated
  USING (
    (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
    OR (
      has_any_role(auth.uid(), ARRAY['lavador','colaborador']::app_role[])
      AND funcionario_id IN (SELECT id FROM public.funcionarios WHERE auth_user_id = auth.uid())
    )
  );
CREATE POLICY "comissoes write" ON public.comissoes FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ PAGAMENTOS_COMISSAO ------
DROP POLICY IF EXISTS "pagamentos_comissao tenant all" ON public.pagamentos_comissao;
CREATE POLICY "pagamentos_comissao select" ON public.pagamentos_comissao FOR SELECT TO authenticated
  USING (
    (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
    OR (
      has_any_role(auth.uid(), ARRAY['lavador','colaborador']::app_role[])
      AND funcionario_id IN (SELECT id FROM public.funcionarios WHERE auth_user_id = auth.uid())
    )
  );
CREATE POLICY "pagamentos_comissao write" ON public.pagamentos_comissao FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

------ ASSINATURAS_CLIENTES ------
DROP POLICY IF EXISTS "assinaturas tenant all" ON public.assinaturas_clientes;
CREATE POLICY "assinaturas select" ON public.assinaturas_clientes FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "assinaturas write" ON public.assinaturas_clientes FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[]));

------ INTERACOES_CLIENTES ------
DROP POLICY IF EXISTS "interacoes tenant all" ON public.interacoes_clientes;
CREATE POLICY "interacoes select" ON public.interacoes_clientes FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "interacoes write" ON public.interacoes_clientes FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));

------ AVALIACOES ------
DROP POLICY IF EXISTS "avaliacoes tenant all" ON public.avaliacoes;
CREATE POLICY "avaliacoes select" ON public.avaliacoes FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "avaliacoes write" ON public.avaliacoes FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));

------ PONTOS_MOVIMENTOS ------
DROP POLICY IF EXISTS "pontos tenant all" ON public.pontos_movimentos;
CREATE POLICY "pontos select" ON public.pontos_movimentos FOR SELECT TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));
CREATE POLICY "pontos write" ON public.pontos_movimentos FOR ALL TO authenticated
  USING (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]))
  WITH CHECK (current_owner_id() = owner_id AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[]));

-- =========================================================
-- 3. VINCULAR COLABORADOR — aceita papel
-- =========================================================
CREATE OR REPLACE FUNCTION public.vincular_colaborador(
  _funcionario_id uuid,
  _email text,
  _role app_role DEFAULT 'lavador'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_owner uuid := auth.uid();
BEGIN
  IF NOT public.has_any_role(v_owner, ARRAY['owner','admin']::app_role[]) THEN
    RAISE EXCEPTION 'Apenas owner ou admin podem vincular colaboradores';
  END IF;

  IF _role::text NOT IN ('admin','gerente','atendente','lavador') THEN
    RAISE EXCEPTION 'Papel inválido: %', _role;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE id = _funcionario_id AND owner_id = current_owner_id()) THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário cadastrado com este e-mail. Peça ao colaborador para criar a conta primeiro em /auth.';
  END IF;

  UPDATE public.funcionarios
     SET email = _email, auth_user_id = v_user_id
   WHERE id = _funcionario_id;

  -- Remove papéis antigos no MESMO tenant para evitar duplicidade
  DELETE FROM public.user_roles
   WHERE user_id = v_user_id
     AND owner_id = current_owner_id()
     AND role <> 'owner';

  INSERT INTO public.user_roles(user_id, owner_id, role)
  VALUES (v_user_id, current_owner_id(), _role)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text, app_role) TO authenticated;

-- =========================================================
-- 4. SET ROLE — função para owner/admin trocar papel de membro
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_member_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid := current_owner_id();
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]) THEN
    RAISE EXCEPTION 'Sem permissão para alterar papéis';
  END IF;
  IF _role::text NOT IN ('admin','gerente','atendente','lavador') THEN
    RAISE EXCEPTION 'Papel inválido: %', _role;
  END IF;
  -- Não permite mexer no owner
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND owner_id = v_owner AND role = 'owner') THEN
    RAISE EXCEPTION 'Não é possível alterar o papel do proprietário';
  END IF;
  -- Admin não pode promover/rebaixar outro admin (só owner pode)
  IF _role = 'admin' AND NOT public.has_any_role(auth.uid(), ARRAY['owner']::app_role[]) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode designar admins';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND owner_id = v_owner AND role = 'admin')
     AND NOT public.has_any_role(auth.uid(), ARRAY['owner']::app_role[]) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode rebaixar um admin';
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = _user_id AND owner_id = v_owner AND role <> 'owner';
  INSERT INTO public.user_roles(user_id, owner_id, role)
  VALUES (_user_id, v_owner, _role)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, app_role) TO authenticated;

-- =========================================================
-- 5. LIST MEMBERS — para a tela de configurações
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_tenant_members()
RETURNS TABLE(user_id uuid, email text, role app_role, funcionario_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ur.user_id, u.email::text, ur.role, f.nome
  FROM public.user_roles ur
  LEFT JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.funcionarios f ON f.auth_user_id = ur.user_id AND f.owner_id = ur.owner_id
  WHERE ur.owner_id = current_owner_id()
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  ORDER BY CASE ur.role::text
    WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'gerente' THEN 3
    WHEN 'atendente' THEN 4 WHEN 'lavador' THEN 5 WHEN 'colaborador' THEN 5
    ELSE 99 END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_tenant_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_tenant_members() TO authenticated;