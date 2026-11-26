CREATE TABLE public.digital_presence (
 owner_id uuid PRIMARY KEY,
 profile_url text NOT NULL DEFAULT '' CHECK (length(profile_url) <= 500),
 review_url text NOT NULL DEFAULT '' CHECK (length(review_url) <= 500),
 confirmations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(confirmations) = 'object'),
 updated_by uuid NOT NULL DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.digital_presence TO authenticated;
GRANT ALL ON public.digital_presence TO service_role;
ALTER TABLE public.digital_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY digital_presence_read ON public.digital_presence FOR SELECT TO authenticated USING (owner_id = public.current_owner_id() AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]));
CREATE POLICY digital_presence_insert ON public.digital_presence FOR INSERT TO authenticated WITH CHECK (owner_id = public.current_owner_id() AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]) AND updated_by = auth.uid());
CREATE POLICY digital_presence_update ON public.digital_presence FOR UPDATE TO authenticated USING (owner_id = public.current_owner_id() AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[])) WITH CHECK (owner_id = public.current_owner_id() AND public.has_any_role(auth.uid(), ARRAY['owner','admin','gerente']::public.app_role[]) AND updated_by = auth.uid());
COMMENT ON TABLE public.digital_presence IS 'Manual business confirmations and references; no external Google verification. Future provider observations must be stored separately with provenance.';