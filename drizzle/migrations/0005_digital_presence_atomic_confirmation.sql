CREATE FUNCTION public.set_digital_presence_confirmation(p_step text, p_done boolean) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_owner uuid := public.current_owner_id(); v_now timestamptz := now();
BEGIN
 IF auth.uid() IS NULL OR v_owner IS NULL OR NOT public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
 IF p_step NOT IN ('created','verified','photos','booking') OR p_done IS NULL THEN RAISE EXCEPTION 'Etapa inválida'; END IF;
 INSERT INTO public.digital_presence(owner_id, updated_by) VALUES(v_owner, auth.uid()) ON CONFLICT(owner_id) DO NOTHING;
 UPDATE public.digital_presence SET confirmations = CASE WHEN p_done THEN confirmations || jsonb_build_object(p_step, jsonb_build_object('at', v_now, 'by', auth.uid())) ELSE confirmations - p_step END, updated_by = auth.uid(), updated_at = v_now WHERE owner_id = v_owner;
END $$;
REVOKE ALL ON FUNCTION public.set_digital_presence_confirmation(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_digital_presence_confirmation(text, boolean) TO authenticated;
