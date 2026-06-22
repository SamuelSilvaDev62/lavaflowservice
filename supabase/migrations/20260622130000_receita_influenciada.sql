-- Receita Influenciada pelo LavaFlow: rastreamento de origens comerciais por OS.
-- Permite multiplas origens por venda sem alterar autenticacao ou fluxos existentes.

create table if not exists public.receita_influenciada (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  ordem_id uuid references public.ordens_servico(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  origem text not null check (origem in (
    'CLIENTE_RECUPERADO',
    'FIDELIDADE',
    'UPSELL_CHECKLIST',
    'CONSULTOR_IA',
    'CAMPANHA',
    'ANIVERSARIO',
    'LEVA_ETRAZ',
    'ASSINATURAS'
  )),
  valor numeric not null default 0,
  descricao text,
  referencia_tipo text,
  referencia_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.receita_influenciada enable row level security;

create index if not exists idx_receita_influenciada_owner_created
  on public.receita_influenciada(owner_id, created_at desc);

create index if not exists idx_receita_influenciada_origem
  on public.receita_influenciada(owner_id, origem, created_at desc);

create index if not exists idx_receita_influenciada_ordem
  on public.receita_influenciada(owner_id, ordem_id);

create unique index if not exists idx_receita_influenciada_unique_ref
  on public.receita_influenciada(owner_id, origem, referencia_tipo, referencia_id)
  where referencia_tipo is not null and referencia_id is not null;
