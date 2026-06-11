
-- 1) Add strict write policies on user_roles (only owner can manage roles in their org)
CREATE POLICY "owner inserts roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner updates roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner deletes roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- 2) Tighten EXECUTE on SECURITY DEFINER functions: revoke from PUBLIC/anon where not intended.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_owner_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_owner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) TO authenticated;

-- Public booking helpers must remain callable by anon (used on /agendar/$slug)
GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_servicos_publicos(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ocupacao_dia(uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agenda_config_publica(uuid) TO anon, authenticated;
