-- Isolated PostgreSQL test schema, projected from the audited production schema.
-- No production connection or customer data is used by this fixture.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role;
CREATE TYPE public.app_role AS ENUM ('owner','admin','gerente','atendente','lavador','colaborador');
CREATE TYPE public.agendamento_status AS ENUM ('agendado','confirmado','em_andamento','concluido','cancelado','nao_compareceu');
CREATE TYPE public.os_status AS ENUM ('aguardando','em_lavagem','finalizacao','pronto','entregue');
CREATE TABLE public.user_roles (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, owner_id uuid NOT NULL, role public.app_role NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE public.clientes (id uuid PRIMARY KEY, owner_id uuid NOT NULL, nome text NOT NULL);
CREATE TABLE public.veiculos (id uuid PRIMARY KEY, owner_id uuid NOT NULL, cliente_id uuid REFERENCES public.clientes(id), placa text NOT NULL);
CREATE TABLE public.servicos (id uuid PRIMARY KEY, owner_id uuid NOT NULL, preco_padrao numeric NOT NULL DEFAULT 0);
CREATE TABLE public.funcionarios (id uuid PRIMARY KEY, owner_id uuid NOT NULL, auth_user_id uuid);
CREATE TABLE public.ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id), veiculo_id uuid REFERENCES public.veiculos(id),
  servico_id uuid REFERENCES public.servicos(id), funcionario_id uuid REFERENCES public.funcionarios(id),
  valor numeric NOT NULL DEFAULT 0, observacoes text, status public.os_status NOT NULL DEFAULT 'aguardando',
  posicao integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  checklist_inicial_status text NOT NULL DEFAULT 'pendente'
);
CREATE TABLE public.agenda_config (owner_id uuid PRIMARY KEY, capacidade_simultanea integer NOT NULL);
CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  veiculo_id uuid REFERENCES public.veiculos(id), servico_id uuid REFERENCES public.servicos(id),
  funcionario_id uuid REFERENCES public.funcionarios(id), ordem_id uuid REFERENCES public.ordens_servico(id),
  data_agendada date NOT NULL, hora_agendada time NOT NULL, status public.agendamento_status NOT NULL DEFAULT 'agendado',
  observacoes text, leva_traz boolean NOT NULL DEFAULT false, taxa_leva_traz numeric NOT NULL DEFAULT 0,
  leva_traz_status text NOT NULL DEFAULT 'pendente'
);
GRANT SELECT ON public.user_roles, public.servicos, public.funcionarios, public.clientes, public.veiculos, public.agenda_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agendamentos, public.ordens_servico TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
CREATE FUNCTION public.current_owner_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role::text WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'gerente' THEN 3 WHEN 'atendente' THEN 4 ELSE 5 END, created_at, owner_id LIMIT 1;
$$;
CREATE FUNCTION public.has_any_role(_user uuid, _roles public.app_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND owner_id = public.current_owner_id() AND role = any(_roles));
$$;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY funcionarios_read ON public.funcionarios FOR SELECT TO authenticated USING (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]));
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_read ON public.clientes FOR SELECT TO authenticated USING (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]));
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY servicos_read ON public.servicos FOR SELECT TO authenticated USING (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]));
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY veiculos_read ON public.veiculos FOR SELECT TO authenticated USING (owner_id = current_owner_id());
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY agendamentos_read ON public.agendamentos FOR SELECT TO authenticated USING (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]));
CREATE POLICY agendamentos_update ON public.agendamentos FOR UPDATE TO authenticated USING (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[])) WITH CHECK (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]));
CREATE POLICY ordens_read ON public.ordens_servico FOR SELECT TO authenticated USING (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]));
CREATE POLICY ordens_insert ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]));
INSERT INTO public.user_roles(user_id,owner_id,role) VALUES
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','owner'),
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','owner'),
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','atendente'),
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','lavador');
INSERT INTO public.clientes VALUES
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Fixture A'),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Fixture B'),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Fixture C');
INSERT INTO public.funcionarios VALUES
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',NULL),
  ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',NULL),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',NULL);
INSERT INTO public.servicos VALUES
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',80),
  ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',150);
INSERT INTO public.veiculos VALUES
  ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','AAA1B23'),
  ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','BBB1B23'),
  ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','CCC1B23');