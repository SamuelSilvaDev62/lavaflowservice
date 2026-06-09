
-- 1. Enum & user_roles
CREATE TYPE public.app_role AS ENUM ('owner', 'colaborador');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, owner_id)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR owner_id = auth.uid());

-- 2. has_role + current_owner_id
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_owner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'colaborador' LIMIT 1),
    auth.uid()
  )
$$;

-- 3. Bootstrap atualizado: novo usuário vira owner da própria empresa
CREATE OR REPLACE FUNCTION public.tg_bootstrap_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.empresa(owner_id, nome_fantasia)
  VALUES (NEW.id, 'Meu Lava-Rápido')
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.fidelidade_config(owner_id) VALUES (NEW.id)
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, owner_id, role)
  VALUES (NEW.id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill: todo dono existente vira role owner
INSERT INTO public.user_roles(user_id, owner_id, role)
SELECT owner_id, owner_id, 'owner' FROM public.empresa
ON CONFLICT DO NOTHING;

-- 4. Funcionarios: email + comissão + auth_user_id
ALTER TABLE public.funcionarios
  ADD COLUMN email text,
  ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN comissao_tipo text NOT NULL DEFAULT 'fixo' CHECK (comissao_tipo IN ('fixo','percentual')),
  ADD COLUMN comissao_valor numeric(10,2) NOT NULL DEFAULT 0;

-- 5. Tabela comissoes
CREATE TABLE public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  ordem_id uuid NOT NULL UNIQUE REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  tipo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes TO authenticated;
GRANT ALL ON public.comissoes TO service_role;

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own comissoes" ON public.comissoes
  FOR ALL TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);

CREATE INDEX idx_comissoes_owner_func ON public.comissoes(owner_id, funcionario_id, created_at);

-- 6. Trigger comissão ao entregar
CREATE OR REPLACE FUNCTION public.tg_os_entregue_comissao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  f public.funcionarios%ROWTYPE;
  v_valor numeric(10,2);
BEGIN
  IF NEW.status = 'entregue' AND (OLD.status IS DISTINCT FROM 'entregue') AND NEW.funcionario_id IS NOT NULL THEN
    SELECT * INTO f FROM public.funcionarios WHERE id = NEW.funcionario_id;
    IF f.id IS NOT NULL THEN
      IF f.comissao_tipo = 'percentual' THEN
        v_valor := ROUND(COALESCE(NEW.valor,0) * COALESCE(f.comissao_valor,0) / 100, 2);
      ELSE
        v_valor := COALESCE(f.comissao_valor, 0);
      END IF;
      IF v_valor > 0 THEN
        INSERT INTO public.comissoes(owner_id, funcionario_id, ordem_id, valor, tipo)
        VALUES (NEW.owner_id, NEW.funcionario_id, NEW.id, v_valor, f.comissao_tipo)
        ON CONFLICT (ordem_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_os_comissao
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.tg_os_entregue_comissao();

-- 7. Vincular colaborador (chamada do dono)
CREATE OR REPLACE FUNCTION public.vincular_colaborador(_funcionario_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_owner uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_owner, 'owner') THEN
    RAISE EXCEPTION 'Apenas o proprietário pode vincular colaboradores';
  END IF;

  -- Garante que o funcionário pertence ao dono
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE id = _funcionario_id AND owner_id = v_owner) THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário cadastrado com este e-mail. Peça ao colaborador para criar a conta primeiro em /auth.';
  END IF;

  UPDATE public.funcionarios
    SET email = _email, auth_user_id = v_user_id
    WHERE id = _funcionario_id;

  INSERT INTO public.user_roles(user_id, owner_id, role)
  VALUES (v_user_id, v_owner, 'colaborador')
  ON CONFLICT DO NOTHING;
END;
$$;

-- 8. Atualizar policies das tabelas operacionais para usar current_owner_id()
DROP POLICY IF EXISTS "own ordens" ON public.ordens_servico;
CREATE POLICY "ordens leitura" ON public.ordens_servico FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id);
CREATE POLICY "ordens update" ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.current_owner_id() = owner_id)
  WITH CHECK (public.current_owner_id() = owner_id);
CREATE POLICY "ordens owner write" ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "ordens owner delete" ON public.ordens_servico FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own funcionarios" ON public.funcionarios;
CREATE POLICY "func leitura" ON public.funcionarios FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id OR auth_user_id = auth.uid());
CREATE POLICY "func owner write" ON public.funcionarios FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own clientes" ON public.clientes;
CREATE POLICY "clientes leitura" ON public.clientes FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id);
CREATE POLICY "clientes owner write" ON public.clientes FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own veiculos" ON public.veiculos;
CREATE POLICY "veiculos leitura" ON public.veiculos FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id);
CREATE POLICY "veiculos owner write" ON public.veiculos FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "own servicos" ON public.servicos;
CREATE POLICY "servicos leitura" ON public.servicos FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id);
CREATE POLICY "servicos owner write" ON public.servicos FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
