
-- Enum
ALTER TYPE public.assinatura_status ADD VALUE IF NOT EXISTS 'pendente';
ALTER TYPE public.assinatura_status ADD VALUE IF NOT EXISTS 'expirada';

-- Planos
ALTER TABLE public.planos_assinatura
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS chave_pix TEXT;

-- Gera slug para planos existentes
UPDATE public.planos_assinatura
SET slug = lower(regexp_replace(nome, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(id::text, 1, 6)
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS planos_assinatura_slug_key ON public.planos_assinatura(slug);

-- Assinaturas
ALTER TABLE public.assinaturas_clientes
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_ref TEXT;
