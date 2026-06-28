-- Prevent the multi-tenant ambiguity in current_owner_id() by ensuring a user
-- can belong to at most one tenant as a non-owner. Users always retain their
-- own tenant (owner role on auth.uid()) and may have at most one additional
-- tenant membership. This removes the silent role-priority fallback risk.

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_non_owner_tenant_per_user
  ON public.user_roles (user_id)
  WHERE role <> 'owner'::public.app_role;

-- Defense-in-depth: explicitly deny PostgREST writes to equipe_pin_attempts
-- and equipe_sessoes from anon/authenticated roles. All legitimate writes go
-- through the service role (supabaseAdmin) in server functions, which bypasses
-- RLS. These explicit FALSE policies make the intent auditable.

DROP POLICY IF EXISTS "equipe_pin_attempts deny client writes" ON public.equipe_pin_attempts;
CREATE POLICY "equipe_pin_attempts deny client writes"
  ON public.equipe_pin_attempts
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "equipe_sessoes deny client writes" ON public.equipe_sessoes;
CREATE POLICY "equipe_sessoes deny client writes"
  ON public.equipe_sessoes
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Note: existing permissive SELECT policies (owner/admin) still apply because
-- restrictive policies AND with permissive ones. SELECT continues to work for
-- authorized owners/admins; writes are blocked for all non-service-role callers.