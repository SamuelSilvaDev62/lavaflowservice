-- Motor de Upsell configuravel para oportunidades geradas pelo checklist.
-- Mantem fallback no app para contas que ainda nao configuraram regras.

create table if not exists public.upsell_regras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  item_chave text not null,
  item_label text not null,
  servico_sugerido text not null,
  servico_id uuid references public.servicos(id) on delete set null,
  termos text[] not null default '{}',
  motivo text not null,
  ativo boolean not null default true,
  prioridade integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.upsell_regras enable row level security;

create index if not exists idx_upsell_regras_owner_item
  on public.upsell_regras(owner_id, item_chave, ativo);

create index if not exists idx_upsell_regras_owner_prioridade
  on public.upsell_regras(owner_id, prioridade, created_at desc);
