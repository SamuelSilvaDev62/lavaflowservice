-- LavaFlow 2.0 - Gestão avançada de serviços

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS tempo_estimado_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pontos_gerados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_tipo text,
  ADD COLUMN IF NOT EXISTS comissao_valor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disponivel_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS foto_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servicos_tempo_estimado_min_check'
  ) THEN
    ALTER TABLE public.servicos
      ADD CONSTRAINT servicos_tempo_estimado_min_check CHECK (tempo_estimado_min >= 1 AND tempo_estimado_min <= 1440);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servicos_pontos_gerados_check'
  ) THEN
    ALTER TABLE public.servicos
      ADD CONSTRAINT servicos_pontos_gerados_check CHECK (pontos_gerados >= 0 AND pontos_gerados <= 100000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servicos_comissao_tipo_check'
  ) THEN
    ALTER TABLE public.servicos
      ADD CONSTRAINT servicos_comissao_tipo_check CHECK (comissao_tipo IS NULL OR comissao_tipo IN ('fixo', 'percentual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servicos_comissao_valor_check'
  ) THEN
    ALTER TABLE public.servicos
      ADD CONSTRAINT servicos_comissao_valor_check CHECK (comissao_valor >= 0 AND comissao_valor <= 100000);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_servicos_publicos(_owner uuid)
RETURNS TABLE(id uuid, nome text, preco_padrao numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nome, preco_padrao FROM public.servicos
  WHERE owner_id = _owner
    AND ativo = true
    AND COALESCE(disponivel_online, true) = true
  ORDER BY nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_servicos_publicos(uuid) TO anon, authenticated;
