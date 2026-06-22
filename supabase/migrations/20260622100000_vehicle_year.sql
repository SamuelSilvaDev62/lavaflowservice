-- Ano opcional do veiculo para melhorar identificacao visual e operacional.
alter table public.veiculos
  add column if not exists vehicle_year integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'veiculos_vehicle_year_valid'
      and conrelid = 'public.veiculos'::regclass
  ) then
    alter table public.veiculos
      add constraint veiculos_vehicle_year_valid
      check (
        vehicle_year is null
        or (
          vehicle_year >= 1990
          and vehicle_year <= extract(year from now())::integer + 1
        )
      )
      not valid;
  end if;
end $$;

alter table public.veiculos validate constraint veiculos_vehicle_year_valid;
