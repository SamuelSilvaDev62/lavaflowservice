-- Hardening multi-tenant: escopo deterministico, RBAC tenant-aware e vinculo seguro.
-- Nao altera autenticação nem schema de negocio.

create or replace function public.current_owner_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (
      select ur.owner_id
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.owner_id = auth.uid()
        and ur.role = 'owner'::public.app_role
      order by ur.created_at asc, ur.owner_id::text asc
      limit 1
    ),
    (
      select ur.owner_id
      from public.user_roles ur
      where ur.user_id = auth.uid()
      order by
        case ur.role::text
          when 'owner' then 1
          when 'admin' then 2
          when 'gerente' then 3
          when 'atendente' then 4
          when 'lavador' then 5
          when 'colaborador' then 5
          else 99
        end,
        ur.created_at asc,
        ur.owner_id::text asc
      limit 1
    ),
    auth.uid()
  )
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.owner_id = public.current_owner_id()
      and ur.role = _role
  )
$$;

create or replace function public.has_any_role(_user uuid, _roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user
      and ur.owner_id = public.current_owner_id()
      and ur.role = any(_roles)
  )
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.owner_id = public.current_owner_id()
  order by
    case ur.role::text
      when 'owner' then 1
      when 'admin' then 2
      when 'gerente' then 3
      when 'atendente' then 4
      when 'lavador' then 5
      when 'colaborador' then 5
      else 99
    end,
    ur.created_at asc
  limit 1
$$;

create or replace function public.vincular_colaborador(
  _funcionario_id uuid,
  _email text,
  _role public.app_role default 'lavador'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_owner uuid := public.current_owner_id();
begin
  if not public.has_any_role(auth.uid(), array['owner','admin']::public.app_role[]) then
    raise exception 'Apenas owner ou admin podem vincular colaboradores';
  end if;

  if _role::text not in ('admin','gerente','atendente','lavador') then
    raise exception 'Papel invalido: %', _role;
  end if;

  if not exists (
    select 1 from public.funcionarios
    where id = _funcionario_id
      and owner_id = v_owner
  ) then
    raise exception 'Funcionario nao encontrado';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(_email)
  limit 1;

  if v_user_id is null then
    raise exception 'Nenhum usuario cadastrado com este e-mail. Peca ao colaborador para criar a conta primeiro em /auth.';
  end if;

  update public.funcionarios
     set email = _email,
         auth_user_id = v_user_id
   where id = _funcionario_id
     and owner_id = v_owner;

  delete from public.user_roles
   where user_id = v_user_id
     and owner_id = v_owner
     and role <> 'owner'::public.app_role;

  insert into public.user_roles(user_id, owner_id, role)
  values (v_user_id, v_owner, _role)
  on conflict do nothing;
end;
$$;

revoke execute on function public.current_owner_id() from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.has_any_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.vincular_colaborador(uuid, text, public.app_role) from public, anon;

grant execute on function public.current_owner_id() to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_any_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.vincular_colaborador(uuid, text, public.app_role) to authenticated;

-- Policies para tabelas recentes que estavam com RLS habilitado e sem policy explicita.

drop policy if exists "tenant read equipe pin attempts" on public.equipe_pin_attempts;
create policy "tenant read equipe pin attempts" on public.equipe_pin_attempts
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "tenant read equipe sessoes" on public.equipe_sessoes;
create policy "tenant read equipe sessoes" on public.equipe_sessoes
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "tenant read equipe auditoria" on public.equipe_auditoria;
create policy "tenant read equipe auditoria" on public.equipe_auditoria
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read os checklists" on public.os_checklists;
create policy "tenant read os checklists" on public.os_checklists
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  );

drop policy if exists "tenant write os checklists" on public.os_checklists;
create policy "tenant write os checklists" on public.os_checklists
  for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  );

drop policy if exists "tenant read os upsell oportunidades" on public.os_upsell_oportunidades;
create policy "tenant read os upsell oportunidades" on public.os_upsell_oportunidades
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  );

drop policy if exists "tenant write os upsell oportunidades" on public.os_upsell_oportunidades;
create policy "tenant write os upsell oportunidades" on public.os_upsell_oportunidades
  for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente','atendente']::public.app_role[])
  );

drop policy if exists "tenant read upsell regras" on public.upsell_regras;
create policy "tenant read upsell regras" on public.upsell_regras
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write upsell regras" on public.upsell_regras;
create policy "tenant write upsell regras" on public.upsell_regras
  for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read public page events" on public.public_page_events;
create policy "tenant read public page events" on public.public_page_events
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read campanhas" on public.campanhas;
create policy "tenant read campanhas" on public.campanhas
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write campanhas" on public.campanhas;
create policy "tenant write campanhas" on public.campanhas
  for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read campanha alvos" on public.campanha_alvos;
create policy "tenant read campanha alvos" on public.campanha_alvos
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write campanha alvos" on public.campanha_alvos;
create policy "tenant write campanha alvos" on public.campanha_alvos
  for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant read receita influenciada" on public.receita_influenciada;
create policy "tenant read receita influenciada" on public.receita_influenciada
  for select to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );

drop policy if exists "tenant write receita influenciada" on public.receita_influenciada;
create policy "tenant write receita influenciada" on public.receita_influenciada
  for all to authenticated
  using (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  )
  with check (
    public.current_owner_id() = owner_id
    and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
  );
