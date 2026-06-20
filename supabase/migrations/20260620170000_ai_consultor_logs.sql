CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route text NOT NULL,
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  estimated_cost numeric(12, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_owner_created
  ON public.ai_usage_logs(owner_id, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_logs select" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs select"
  ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::public.app_role[]));

DROP POLICY IF EXISTS "ai_usage_logs insert" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs insert"
  ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_owner_id() = owner_id AND auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('alta', 'media', 'baixa')),
  title text NOT NULL,
  description text NOT NULL,
  estimated_impact numeric(12, 2) NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'nova' CHECK (status IN ('nova', 'visualizada', 'executada', 'ignorada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  executed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_owner_status_created
  ON public.ai_recommendations(owner_id, status, created_at DESC);

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_recommendations select" ON public.ai_recommendations;
CREATE POLICY "ai_recommendations select"
  ON public.ai_recommendations
  FOR SELECT TO authenticated
  USING (public.current_owner_id() = owner_id AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]));

DROP POLICY IF EXISTS "ai_recommendations insert" ON public.ai_recommendations;
CREATE POLICY "ai_recommendations insert"
  ON public.ai_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_owner_id() = owner_id AND auth.uid() = user_id AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]));

DROP POLICY IF EXISTS "ai_recommendations update" ON public.ai_recommendations;
CREATE POLICY "ai_recommendations update"
  ON public.ai_recommendations
  FOR UPDATE TO authenticated
  USING (public.current_owner_id() = owner_id AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]))
  WITH CHECK (public.current_owner_id() = owner_id AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]));

GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
GRANT ALL ON public.ai_recommendations TO service_role;
