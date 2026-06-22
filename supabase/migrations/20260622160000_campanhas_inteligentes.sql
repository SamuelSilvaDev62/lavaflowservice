-- Campanhas Inteligentes: recomendações, alvos e rastreio de origem comercial.

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  nome text not null,
  tipo text not null check (tipo in ('inativos', 'aniversario', 'baixa_ocupacao', 'fidelidade', 'assinatura')),
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'sms', 'email', 'notificacao')),
  status text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'pausada', 'concluida')),
  mensagem text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campanha_alvos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  nome text,
  telefone text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'convertido', 'ignorado')),
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.campanhas enable row level security;
alter table public.campanha_alvos enable row level security;

create index if not exists idx_campanhas_owner_created
  on public.campanhas(owner_id, created_at desc);

create index if not exists idx_campanhas_owner_tipo
  on public.campanhas(owner_id, tipo, status);

create index if not exists idx_campanha_alvos_campanha
  on public.campanha_alvos(owner_id, campanha_id, status);

create index if not exists idx_campanha_alvos_cliente
  on public.campanha_alvos(owner_id, cliente_id);
