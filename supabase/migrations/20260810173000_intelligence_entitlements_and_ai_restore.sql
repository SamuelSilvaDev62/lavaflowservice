-- Intelligence hardening + minimal AI infrastructure restoration.
-- Keeps the recommendation engine exclusive to Intelligence/Founders and
-- recreates only the AI tables used by the restored LavaFlow assistant.

create or replace function public.tenant_has_intelligence(_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_subscriptions ts
    where ts.owner_id = _owner
      and (ts.is_founders = true or ts.plan::text = 'intelligence')
      and (
        ts.subscription_status = 'active'
        or (
          ts.subscription_status = 'trialing'
          and ts.trial_ends_at is not null
          and ts.trial_ends_at > now()
        )
        or (
          ts.subscription_status in ('past_due', 'unpaid')
          and ts.current_period_end is not null
          and ts.current_period_end + interval '7 days' > now()
        )
      )
  );
$$;

revoke all on function public.tenant_has_intelligence(uuid) from public, anon;
grant execute on function public.tenant_has_intelligence(uuid) to authenticated, service_role;

-- Configuracao das regras do motor de recomendacoes: somente Intelligence.
drop policy if exists "tenant read upsell regras" on public.upsell_regras;
create policy "tenant read upsell regras"
  on public.upsell_regras for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write upsell regras" on public.upsell_regras;
create policy "tenant write upsell regras"
  on public.upsell_regras for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

-- Oportunidades geradas pelo checklist tambem sao parte de Recomendacoes Inteligentes.
drop policy if exists "tenant read os upsell oportunidades" on public.os_upsell_oportunidades;
create policy "tenant read os upsell oportunidades"
  on public.os_upsell_oportunidades for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  );

drop policy if exists "tenant write os upsell oportunidades" on public.os_upsell_oportunidades;
create policy "tenant write os upsell oportunidades"
  on public.os_upsell_oportunidades for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  );

-- Supabase service_role bypassa RLS. O modo equipe usa service_role ao concluir
-- o checklist; para planos sem Intelligence, ignoramos silenciosamente as linhas
-- de upsell em vez de quebrar a conclusao do checklist.
create or replace function public.skip_non_intelligence_upsell_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tenant_has_intelligence(new.owner_id) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.skip_non_intelligence_upsell_opportunity() from public, anon, authenticated;
grant execute on function public.skip_non_intelligence_upsell_opportunity() to service_role;

drop trigger if exists trg_skip_non_intelligence_upsell on public.os_upsell_oportunidades;
create trigger trg_skip_non_intelligence_upsell
  before insert or update on public.os_upsell_oportunidades
  for each row execute function public.skip_non_intelligence_upsell_opportunity();

-- Configuracoes persistidas do motor nao podem ser alteradas por service_role
-- para um tenant sem Intelligence, evitando bypass acidental em rotinas futuras.
create or replace function public.guard_intelligence_upsell_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tenant_has_intelligence(new.owner_id) then
    raise exception 'Recomendacoes inteligentes exigem o plano Intelligence.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_intelligence_upsell_rule() from public, anon, authenticated;
grant execute on function public.guard_intelligence_upsell_rule() to service_role;

drop trigger if exists trg_guard_intelligence_upsell_rule on public.upsell_regras;
create trigger trg_guard_intelligence_upsell_rule
  before insert or update on public.upsell_regras
  for each row execute function public.guard_intelligence_upsell_rule();

-- Minimal AI persistence used by /api/assistente-chat.
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_logs_owner_created
  on public.ai_usage_logs(owner_id, created_at desc);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_usage_logs select" on public.ai_usage_logs;
create policy "ai_usage_logs select"
  on public.ai_usage_logs for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "ai_usage_logs insert" on public.ai_usage_logs;
create policy "ai_usage_logs insert"
  on public.ai_usage_logs for insert to authenticated
  with check (
    public.current_owner_id() = owner_id
    and auth.uid() = user_id
    and public.tenant_has_intelligence(owner_id)
  );

grant select, insert on public.ai_usage_logs to authenticated;
grant all on public.ai_usage_logs to service_role;

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  priority text not null check (priority in ('alta', 'media', 'baixa')),
  title text not null,
  description text not null,
  estimated_impact numeric(12, 2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'nova' check (status in ('nova', 'visualizada', 'executada', 'ignorada')),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  executed_at timestamptz
);

create index if not exists idx_ai_recommendations_owner_status_created
  on public.ai_recommendations(owner_id, status, created_at desc);

alter table public.ai_recommendations enable row level security;

drop policy if exists "ai_recommendations select" on public.ai_recommendations;
create policy "ai_recommendations select"
  on public.ai_recommendations for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "ai_recommendations insert" on public.ai_recommendations;
create policy "ai_recommendations insert"
  on public.ai_recommendations for insert to authenticated
  with check (
    public.current_owner_id() = owner_id
    and auth.uid() = user_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "ai_recommendations update" on public.ai_recommendations;
create policy "ai_recommendations update"
  on public.ai_recommendations for update to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.tenant_has_intelligence(owner_id)
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

grant select, insert, update on public.ai_recommendations to authenticated;
grant all on public.ai_recommendations to service_role;
