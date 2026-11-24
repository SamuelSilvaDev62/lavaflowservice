CREATE TABLE public.access_limit_buckets (
  bucket_key text PRIMARY KEY,
  used integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);
GRANT ALL ON public.access_limit_buckets TO service_role;
ALTER TABLE public.access_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE INDEX access_limit_buckets_expiry ON public.access_limit_buckets(reset_at);

CREATE OR REPLACE FUNCTION public.consume_access_limits(p_buckets jsonb)
RETURNS TABLE(allowed boolean, retry_after integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  b record;
  v_now timestamptz;
  v_used integer;
  v_reset timestamptz;
  v_allowed boolean := true;
  v_retry integer := 0;
BEGIN
  IF jsonb_typeof(p_buckets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_buckets) NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'Invalid limit buckets' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_buckets) AS x(key text, max integer, seconds integer)
    WHERE x.key IS NULL OR x.key !~ '^[a-f0-9]{64}$' OR x.max IS NULL OR x.max NOT BETWEEN 1 AND 100000
      OR x.seconds IS NULL OR x.seconds NOT BETWEEN 1 AND 86400)
    OR (SELECT count(DISTINCT x.key) FROM jsonb_to_recordset(p_buckets) AS x(key text)) <> jsonb_array_length(p_buckets) THEN
    RAISE EXCEPTION 'Invalid limit policy' USING ERRCODE = '22023';
  END IF;
  -- Deterministic lock order prevents deadlocks across overlapping requests.
  FOR b IN SELECT * FROM jsonb_to_recordset(p_buckets) AS x(key text, max integer, seconds integer) ORDER BY x.key LOOP
    INSERT INTO public.access_limit_buckets(bucket_key,used,reset_at)
      VALUES(b.key,0,clock_timestamp()) ON CONFLICT(bucket_key) DO NOTHING;
    SELECT used, reset_at INTO v_used,v_reset FROM public.access_limit_buckets WHERE bucket_key=b.key FOR UPDATE;
    v_now := clock_timestamp();
    IF v_reset <= v_now THEN
      v_used := 0;
      v_reset := v_now + make_interval(secs => b.seconds);
    END IF;
    v_used := least(v_used + 1, b.max + 1);
    UPDATE public.access_limit_buckets SET used=v_used,reset_at=v_reset WHERE bucket_key=b.key;
    IF v_used > b.max THEN
      v_allowed := false;
      v_retry := greatest(v_retry, greatest(1,ceil(extract(epoch FROM v_reset-v_now))::integer));
    END IF;
  END LOOP;
  -- Bounded opportunistic retention; no polling or unbounded delete.
  DELETE FROM public.access_limit_buckets WHERE bucket_key IN
    (SELECT bucket_key FROM public.access_limit_buckets WHERE reset_at < clock_timestamp()-interval '1 day'
      ORDER BY reset_at LIMIT 100 FOR UPDATE SKIP LOCKED);
  RETURN QUERY SELECT v_allowed,v_retry;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_access_limits(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_access_limits(jsonb) TO service_role;
