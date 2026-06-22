-- Checklist inicial obrigatório antes de mover uma OS para em_lavagem.

alter table public.empresa
  add column if not exists exigir_checklist_inicial boolean not null default true;

alter table public.ordens_servico
  add column if not exists checklist_inicial_status text not null default 'pendente'
    check (checklist_inicial_status in ('pendente', 'concluido', 'pulado')),
  add column if not exists checklist_inicial_funcionario_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists checklist_inicial_em timestamptz;

create table if not exists public.os_checklists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  ordem_id uuid not null references public.ordens_servico(id) on delete cascade,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  tipo text not null default 'inicial' check (tipo in ('inicial')),
  status text not null check (status in ('concluido', 'pulado')),
  itens jsonb not null default '{}'::jsonb,
  observacoes text,
  created_at timestamptz not null default now()
);

alter table public.os_checklists enable row level security;

create index if not exists idx_os_checklists_ordem_tipo on public.os_checklists(ordem_id, tipo, created_at desc);
create index if not exists idx_os_checklists_owner_created on public.os_checklists(owner_id, created_at desc);
