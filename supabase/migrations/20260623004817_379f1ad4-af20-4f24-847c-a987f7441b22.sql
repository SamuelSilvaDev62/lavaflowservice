
DROP FUNCTION IF EXISTS public.get_empresa_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(_slug text)
RETURNS TABLE(
  id uuid,
  owner_id uuid,
  nome_fantasia text,
  telefone text,
  whatsapp text,
  endereco text,
  slug text,
  logo_url text,
  instagram text,
  facebook text,
  website text,
  horario_funcionamento text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, owner_id, nome_fantasia, telefone, whatsapp, endereco, slug,
         logo_url, instagram, facebook, website, horario_funcionamento
  FROM public.empresa WHERE slug = _slug LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;
