-- Modo Equipe: acesso rapido por PIN, sessoes de dispositivo e auditoria operacional.
-- Nao altera autenticacao do proprietario nem politicas existentes de negocio.

alter table public.funcionarios
  add column if not exists avatar_url text,
  add column if not exists pin_hash text,
  add column if not exists pin_digits integer not null default 4 check (pin_digits in (4, 6)),
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz,
  add column if not exists perm_iniciar_atendimento boolean not null default true,
  add column if not exists perm_finalizar_atendimento boolean not null default true,
  add column if not exists perm_realizar_checklist boolean not null default true,
  add column if not exists perm_ver_apenas_atribuidos boolean not null default true,
  add column if not exists perm_ver_todos_veiculos boolean not null default false;

create table if not exists public.equipe_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  funcionario_id uuid references public.funcionarios(id) on delete cascade,
  success boolean not null default false,
  device_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipe_sessoes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  token_hash text not null unique,
  device_id text,
  user_agent text,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.equipe_auditoria (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  ordem_id uuid references public.ordens_servico(id) on delete set null,
  acao text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.equipe_pin_attempts enable row level security;
alter table public.equipe_sessoes enable row level security;
alter table public.equipe_auditoria enable row level security;

create index if not exists idx_equipe_sessoes_token_hash on public.equipe_sessoes(token_hash);
create index if not exists idx_equipe_sessoes_funcionario on public.equipe_sessoes(owner_id, funcionario_id);
create index if not exists idx_equipe_auditoria_owner_created on public.equipe_auditoria(owner_id, created_at desc);
create index if not exists idx_equipe_pin_attempts_funcionario on public.equipe_pin_attempts(funcionario_id, created_at desc);
