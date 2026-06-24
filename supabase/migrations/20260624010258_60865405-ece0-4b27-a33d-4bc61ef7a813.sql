
DROP POLICY IF EXISTS "notificacoes tenant select" ON public.notificacoes;
CREATE POLICY "notificacoes tenant select" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    public.current_owner_id() = owner_id
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[])
  );

CREATE OR REPLACE FUNCTION public.get_my_funcionario_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.funcionarios
  WHERE owner_id = public.current_owner_id()
    AND auth_user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_funcionario_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_funcionario_id() TO authenticated;

CREATE OR REPLACE VIEW public.funcionarios_self
WITH (security_invoker=on) AS
SELECT id, owner_id, nome, cargo, email, telefone, avatar_url, ativo,
       especialidades, horario_inicio, horario_fim, dias_disponiveis,
       perm_iniciar_atendimento, perm_finalizar_atendimento,
       perm_realizar_checklist, perm_ver_apenas_atribuidos, perm_ver_todos_veiculos
FROM public.funcionarios
WHERE auth_user_id = auth.uid();
GRANT SELECT ON public.funcionarios_self TO authenticated;

DROP POLICY IF EXISTS "funcionarios select" ON public.funcionarios;
CREATE POLICY "funcionarios select" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (
    public.current_owner_id() = owner_id
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[])
  );

REVOKE INSERT, UPDATE, DELETE ON public.public_page_events FROM anon, authenticated;
GRANT ALL ON public.public_page_events TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'lavaflow_tenant_update_public') THEN
    DROP POLICY "lavaflow_tenant_update_public" ON storage.objects;
  END IF;
END$$;
CREATE POLICY "lavaflow_tenant_update_public" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('service-images','company-logos','vehicle-assets','employee-photos','reward-images')
    AND public.storage_path_owner(name) = public.current_owner_id()
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[])
  )
  WITH CHECK (
    bucket_id IN ('service-images','company-logos','vehicle-assets','employee-photos','reward-images')
    AND public.storage_path_owner(name) = public.current_owner_id()
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[])
  );

CREATE OR REPLACE FUNCTION public.storage_path_owner(_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _name ~ '^[0-9a-fA-F-]{36}/' THEN substring(_name from 1 for 36)::uuid
    ELSE NULL
  END
$$;

REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, public.app_role) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.set_member_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text, public.app_role) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_tenant_members() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.list_tenant_members() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_owner_id() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.current_owner_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
