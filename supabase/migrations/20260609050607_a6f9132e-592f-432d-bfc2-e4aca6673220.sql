
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_owner_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_bootstrap_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_entregue_comissao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_entregue_credita_pontos() FROM PUBLIC, anon, authenticated;
