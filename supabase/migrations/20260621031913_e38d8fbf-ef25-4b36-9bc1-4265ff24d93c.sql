DROP POLICY IF EXISTS "notificacoes tenant select" ON public.notificacoes;
CREATE POLICY "notificacoes tenant select" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    current_owner_id() = owner_id
    AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[])
  );

DROP POLICY IF EXISTS "servicos select" ON public.servicos;
CREATE POLICY "servicos select" ON public.servicos
  FOR SELECT TO authenticated
  USING (
    current_owner_id() = owner_id
    AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::app_role[])
  );