
-- 1) Remove auth.uid() fallback in current_owner_id() to prevent self-tenant bootstrapping
CREATE OR REPLACE FUNCTION public.current_owner_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    )
  )
$function$;

-- 2) Tighten ai_usage_logs INSERT to require a management role on the tenant
DROP POLICY IF EXISTS "ai_usage_logs insert" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs insert" ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    current_owner_id() = owner_id
    AND auth.uid() = user_id
    AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::app_role[])
  );
