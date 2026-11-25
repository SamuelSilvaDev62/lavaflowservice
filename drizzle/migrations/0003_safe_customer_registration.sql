CREATE OR REPLACE FUNCTION public.cadastrar_cliente_seguro(p_nome text, p_telefone text DEFAULT NULL, p_origem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_owner uuid := public.current_owner_id();
  v_nome text := btrim(p_nome);
  v_phone text := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  v_row public.clientes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_owner IS NULL OR NOT public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar clientes.' USING ERRCODE = '42501';
  END IF;
  IF v_nome IS NULL OR length(v_nome) NOT BETWEEN 1 AND 120 OR length(coalesce(p_telefone,'')) > 20 OR length(coalesce(p_origem,'')) > 50 THEN
    RAISE EXCEPTION 'Dados do cliente inválidos.' USING ERRCODE = '22023';
  END IF;
  IF length(v_phone) IN (12,13) AND left(v_phone,2) = '55' THEN v_phone := substr(v_phone,3); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-registration:' || v_owner::text, 0));
  SELECT c.* INTO v_row FROM public.clientes c
  WHERE c.owner_id = v_owner AND (
    (v_phone <> '' AND
      CASE WHEN length(regexp_replace(coalesce(c.telefone,''),'[^0-9]','','g')) IN (12,13) AND left(regexp_replace(coalesce(c.telefone,''),'[^0-9]','','g'),2) = '55'
        THEN substr(regexp_replace(coalesce(c.telefone,''),'[^0-9]','','g'),3)
        ELSE regexp_replace(coalesce(c.telefone,''),'[^0-9]','','g') END = v_phone)
    OR (v_phone = '' AND coalesce(regexp_replace(c.telefone,'[^0-9]','','g'),'') = '' AND lower(btrim(c.nome)) = lower(v_nome))
  ) ORDER BY c.created_at,c.id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('cliente',to_jsonb(v_row),'existente',true); END IF;
  INSERT INTO public.clientes(owner_id,nome,telefone,origem_cliente)
    VALUES(v_owner,v_nome,nullif(btrim(p_telefone),''),nullif(btrim(p_origem),'')) RETURNING * INTO v_row;
  RETURN jsonb_build_object('cliente',to_jsonb(v_row),'existente',false);
END;
$$;
REVOKE ALL ON FUNCTION public.cadastrar_cliente_seguro(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_cliente_seguro(text,text,text) TO authenticated;