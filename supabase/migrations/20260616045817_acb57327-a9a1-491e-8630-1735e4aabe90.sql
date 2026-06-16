
CREATE INDEX IF NOT EXISTS idx_ordens_servico_owner_created
  ON public.ordens_servico (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_owner_status
  ON public.ordens_servico (owner_id, status);

CREATE INDEX IF NOT EXISTS idx_clientes_owner_created
  ON public.clientes (owner_id, created_at DESC);
