-- Oportunidades comerciais geradas a partir do checklist inicial.

create table if not exists public.os_upsell_oportunidades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  ordem_id uuid not null references public.ordens_servico(id) on delete cascade,
  checklist_id uuid references public.os_checklists(id) on delete set null,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  servico_id uuid references public.servicos(id) on delete set null,
  origem text not null default 'checklist_inicial',
  origem_item_chave text not null,
  origem_item_label text not null,
  servico_sugerido text not null,
  motivo text not null,
  valor_estimado numeric,
  status text not null default 'sugerida'
    check (status in ('sugerida', 'oferecida', 'aceita', 'recusada', 'ignorada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.os_upsell_oportunidades enable row level security;

create index if not exists idx_os_upsell_owner_created on public.os_upsell_oportunidades(owner_id, created_at desc);
create index if not exists idx_os_upsell_ordem on public.os_upsell_oportunidades(ordem_id, status);
create index if not exists idx_os_upsell_servico on public.os_upsell_oportunidades(servico_id);
