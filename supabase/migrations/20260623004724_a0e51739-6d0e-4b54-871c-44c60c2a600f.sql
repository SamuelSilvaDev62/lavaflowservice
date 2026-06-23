
-- =========================
-- Storage RLS Policies
-- =========================
-- Helper: extract owner_id (uuid prefix) from object path "{ownerId}/..."
CREATE OR REPLACE FUNCTION public.storage_path_owner(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _name ~ '^[0-9a-fA-F-]{36}/' THEN substring(_name from 1 for 36)::uuid
    ELSE NULL
  END
$$;

-- Drop any prior policies we manage (idempotent)
DO $$
DECLARE p text;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname LIKE 'lavaflow_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p);
  END LOOP;
END $$;

-- Public buckets: anyone can read
CREATE POLICY "lavaflow_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('service-images','company-logos','reward-images','employee-photos','vehicle-assets'));

-- Public buckets: tenant members (owner/admin/gerente) can write to their own prefix
CREATE POLICY "lavaflow_tenant_insert_public"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('service-images','company-logos','reward-images','employee-photos','vehicle-assets')
  AND public.storage_path_owner(name) = public.current_owner_id()
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[])
);

CREATE POLICY "lavaflow_tenant_update_public"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('service-images','company-logos','reward-images','employee-photos','vehicle-assets')
  AND public.storage_path_owner(name) = public.current_owner_id()
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[])
)
WITH CHECK (
  bucket_id IN ('service-images','company-logos','reward-images','employee-photos','vehicle-assets')
  AND public.storage_path_owner(name) = public.current_owner_id()
);

CREATE POLICY "lavaflow_tenant_delete_public"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('service-images','company-logos','reward-images','employee-photos','vehicle-assets')
  AND public.storage_path_owner(name) = public.current_owner_id()
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[])
);

-- Private bucket os-anexos: tenant members only (read + write)
CREATE POLICY "lavaflow_anexos_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'os-anexos'
  AND public.storage_path_owner(name) = public.current_owner_id()
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente','lavador','colaborador']::app_role[])
);

CREATE POLICY "lavaflow_anexos_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'os-anexos'
  AND public.storage_path_owner(name) = public.current_owner_id()
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente','lavador','colaborador']::app_role[])
);

CREATE POLICY "lavaflow_anexos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'os-anexos'
  AND public.storage_path_owner(name) = public.current_owner_id()
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[])
)
WITH CHECK (
  bucket_id = 'os-anexos'
  AND public.storage_path_owner(name) = public.current_owner_id()
);

CREATE POLICY "lavaflow_anexos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'os-anexos'
  AND public.storage_path_owner(name) = public.current_owner_id()
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[])
);

-- =========================
-- Extend public services RPC
-- =========================
DROP FUNCTION IF EXISTS public.get_servicos_publicos(uuid);

CREATE OR REPLACE FUNCTION public.get_servicos_publicos(_owner uuid)
RETURNS TABLE(
  id uuid,
  nome text,
  preco_padrao numeric,
  descricao text,
  tempo_estimado_min integer,
  categoria text,
  foto_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, nome, preco_padrao, descricao, tempo_estimado_min, categoria, foto_url
  FROM public.servicos
  WHERE owner_id = _owner
    AND ativo = true
    AND COALESCE(disponivel_online, true) = true
  ORDER BY nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_servicos_publicos(uuid) TO anon, authenticated;
