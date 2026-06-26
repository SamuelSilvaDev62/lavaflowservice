-- Flow Engine / Inteligencia operacional.
-- Mantem OpenSquad e IA como motor interno, sem expor conceitos tecnicos ao usuario final.

create table if not exists public.business_insights (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  module text not null check (module in ('marketing', 'financeiro', 'operacao', 'clientes', 'agenda', 'relatorios', 'assistente')),
  severity text not null check (severity in ('info', 'warning', 'critical', 'opportunity')),
  title text not null,
  description text,
  metric_key text,
  metric_value numeric,
  action_type text,
  action_payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'dismissed', 'executed', 'expired')),
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flow_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  module text not null check (module in ('marketing', 'financeiro', 'operacao', 'clientes', 'agenda', 'relatorios', 'assistente')),
  task_type text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  execution_mode text check (execution_mode in ('sql', 'rule', 'cache', 'opensquad', 'hybrid')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error text,
  tokens_used integer not null default 0,
  estimated_cost numeric not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  flow_task_id uuid references public.flow_tasks(id) on delete set null,
  provider text,
  model text,
  task_type text not null,
  module text,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost numeric not null default 0,
  execution_time_ms integer,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  cache_key text not null,
  task_type text not null,
  input_hash text not null,
  output jsonb not null,
  tokens_saved integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_ai_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique,
  ai_enabled boolean not null default true,
  monthly_token_limit integer not null default 200000,
  monthly_task_limit integer not null default 300,
  auto_insights_enabled boolean not null default true,
  auto_execute_enabled boolean not null default false,
  preferred_tone text not null default 'profissional',
  business_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_insights_tenant_status
  on public.business_insights(tenant_id, status, created_at desc);

create index if not exists idx_business_insights_tenant_module
  on public.business_insights(tenant_id, module, severity, created_at desc);

create index if not exists idx_flow_tasks_tenant_created
  on public.flow_tasks(tenant_id, created_at desc);

create index if not exists idx_flow_tasks_tenant_status
  on public.flow_tasks(tenant_id, status, task_type);

create index if not exists idx_ai_usage_logs_tenant_created
  on public.ai_usage_logs(tenant_id, created_at desc);

create index if not exists idx_ai_usage_logs_tenant_module
  on public.ai_usage_logs(tenant_id, module, task_type, created_at desc);

create unique index if not exists idx_ai_cache_tenant_key_hash
  on public.ai_cache(tenant_id, cache_key, input_hash);

alter table public.business_insights enable row level security;
alter table public.flow_tasks enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_cache enable row level security;
alter table public.tenant_ai_settings enable row level security;

drop policy if exists "tenant read business insights" on public.business_insights;
create policy "tenant read business insights" on public.business_insights
  for select to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  );

drop policy if exists "tenant write business insights" on public.business_insights;
create policy "tenant write business insights" on public.business_insights
  for all to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read flow tasks" on public.flow_tasks;
create policy "tenant read flow tasks" on public.flow_tasks
  for select to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write flow tasks" on public.flow_tasks;
create policy "tenant write flow tasks" on public.flow_tasks
  for all to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read ai usage logs" on public.ai_usage_logs;
create policy "tenant read ai usage logs" on public.ai_usage_logs
  for select to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write ai usage logs" on public.ai_usage_logs;
create policy "tenant write ai usage logs" on public.ai_usage_logs
  for all to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read ai cache" on public.ai_cache;
create policy "tenant read ai cache" on public.ai_cache
  for select to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write ai cache" on public.ai_cache;
create policy "tenant write ai cache" on public.ai_cache
  for all to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read ai settings" on public.tenant_ai_settings;
create policy "tenant read ai settings" on public.tenant_ai_settings
  for select to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write ai settings" on public.tenant_ai_settings;
create policy "tenant write ai settings" on public.tenant_ai_settings
  for all to authenticated
  using (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin']::public.app_role[])
  )
  with check (
    public.current_owner_id() = tenant_id
    and public.has_any_role(auth.uid(), array['owner','admin']::public.app_role[])
  );

grant select, insert, update, delete on public.business_insights to authenticated;
grant select, insert, update, delete on public.flow_tasks to authenticated;
grant select, insert, update, delete on public.ai_usage_logs to authenticated;
grant select, insert, update, delete on public.ai_cache to authenticated;
grant select, insert, update, delete on public.tenant_ai_settings to authenticated;

grant all on public.business_insights to service_role;
grant all on public.flow_tasks to service_role;
grant all on public.ai_usage_logs to service_role;
grant all on public.ai_cache to service_role;
grant all on public.tenant_ai_settings to service_role;
