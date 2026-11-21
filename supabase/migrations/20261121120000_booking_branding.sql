-- Optional public booking page identity, isolated by establishment.
-- No existing records are changed. Default LavaFlow theme remains fallback.
create table if not exists public.booking_branding (
  owner_id uuid primary key,
  primary_color text not null default '#2563EB',
  secondary_color text not null default '#0F172A',
  cover_url text,
  logo_url text,
  tagline text,
  updated_at timestamptz not null default now(),
  constraint booking_branding_primary_color check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint booking_branding_secondary_color check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint booking_branding_cover_length check (cover_url is null or length(cover_url) <= 1000),
  constraint booking_branding_logo_length check (logo_url is null or length(logo_url) <= 1000),
  constraint booking_branding_tagline_length check (tagline is null or length(tagline) <= 120)
);

alter table public.booking_branding enable row level security;
revoke all on public.booking_branding from anon;
grant select, insert, update on public.booking_branding to authenticated;

create policy "booking_branding_read_own" on public.booking_branding
for select to authenticated using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.owner_id = booking_branding.owner_id
  )
);

create policy "booking_branding_insert_admin" on public.booking_branding
for insert to authenticated with check (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.owner_id = booking_branding.owner_id
      and ur.role in ('owner', 'admin')
  )
);

create policy "booking_branding_update_admin" on public.booking_branding
for update to authenticated using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.owner_id = booking_branding.owner_id
      and ur.role in ('owner', 'admin')
  )
) with check (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.owner_id = booking_branding.owner_id
      and ur.role in ('owner', 'admin')
  )
);

-- Public display is returned by the existing server-side public booking endpoint,
-- never by granting anonymous access to the branding table.
