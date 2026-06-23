-- Sprint de estabilizacao: fonte unica para servicos publicos e base de Storage multi-tenant.

create or replace function public.get_servicos_publicos(_owner uuid)
returns table(
  id uuid,
  nome text,
  preco_padrao numeric,
  categoria text,
  descricao text,
  tempo_estimado_min integer,
  pontos_gerados integer,
  foto_url text
)
language sql stable security definer set search_path = public as $$
  select
    id,
    nome,
    preco_padrao,
    categoria,
    descricao,
    tempo_estimado_min,
    pontos_gerados,
    foto_url
  from public.servicos
  where owner_id = _owner
    and ativo = true
    and coalesce(disponivel_online, true) = true
  order by nome;
$$;

grant execute on function public.get_servicos_publicos(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('service-images', 'service-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('company-logos', 'company-logos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('vehicle-assets', 'vehicle-assets', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('employee-photos', 'employee-photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('reward-images', 'reward-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('os-attachments', 'os-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('documents', 'documents', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('reports', 'reports', false, 10485760, array['application/pdf','text/csv'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read public media" on storage.objects;
create policy "public read public media"
on storage.objects for select
to anon, authenticated
using (bucket_id in ('service-images', 'company-logos', 'vehicle-assets', 'employee-photos', 'reward-images'));

drop policy if exists "tenant read private media" on storage.objects;
create policy "tenant read private media"
on storage.objects for select
to authenticated
using (
  bucket_id in ('os-attachments', 'documents', 'payment-proofs', 'reports')
  and (storage.foldername(name))[1] = public.current_owner_id()::text
);

drop policy if exists "tenant insert media" on storage.objects;
create policy "tenant insert media"
on storage.objects for insert
to authenticated
with check (
  bucket_id in (
    'service-images', 'company-logos', 'vehicle-assets', 'employee-photos', 'reward-images',
    'os-attachments', 'documents', 'payment-proofs', 'reports'
  )
  and (storage.foldername(name))[1] = public.current_owner_id()::text
  and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
);

drop policy if exists "tenant update media" on storage.objects;
create policy "tenant update media"
on storage.objects for update
to authenticated
using (
  bucket_id in (
    'service-images', 'company-logos', 'vehicle-assets', 'employee-photos', 'reward-images',
    'os-attachments', 'documents', 'payment-proofs', 'reports'
  )
  and (storage.foldername(name))[1] = public.current_owner_id()::text
  and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
)
with check (
  bucket_id in (
    'service-images', 'company-logos', 'vehicle-assets', 'employee-photos', 'reward-images',
    'os-attachments', 'documents', 'payment-proofs', 'reports'
  )
  and (storage.foldername(name))[1] = public.current_owner_id()::text
  and public.has_any_role(auth.uid(), array['owner','admin','gerente']::public.app_role[])
);

drop policy if exists "tenant delete media" on storage.objects;
create policy "tenant delete media"
on storage.objects for delete
to authenticated
using (
  bucket_id in (
    'service-images', 'company-logos', 'vehicle-assets', 'employee-photos', 'reward-images',
    'os-attachments', 'documents', 'payment-proofs', 'reports'
  )
  and (storage.foldername(name))[1] = public.current_owner_id()::text
  and public.has_any_role(auth.uid(), array['owner','admin']::public.app_role[])
);
