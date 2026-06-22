-- Metricas da pagina publica inteligente.
-- Registra visualizacoes e solicitacoes para acompanhar conversao sem expor dados sensiveis.

create table if not exists public.public_page_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  slug text,
  evento text not null check (evento in ('visualizacao', 'solicitacao_agendamento')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.public_page_events enable row level security;

create index if not exists idx_public_page_events_owner_created
  on public.public_page_events(owner_id, created_at desc);

create index if not exists idx_public_page_events_owner_evento
  on public.public_page_events(owner_id, evento, created_at desc);
