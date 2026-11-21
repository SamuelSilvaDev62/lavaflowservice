-- Guard the booking capacity inside PostgreSQL, regardless of which app endpoint inserts.
-- BEFORE trigger + transaction-scoped advisory lock serializes reservations per tenant/date/time.
-- Existing bookings are untouched; canceled/no-show bookings do not consume capacity.
CREATE OR REPLACE FUNCTION public.enforce_agendamento_slot_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_capacity integer;
  v_count bigint;
BEGIN
  IF NEW.status IN ('cancelado', 'nao_compareceu') THEN
    RETURN NEW;
  END IF;

  -- An already active reservation staying in the same slot doesn't consume a new place.
  IF TG_OP = 'UPDATE'
     AND OLD.owner_id = NEW.owner_id
     AND OLD.data_agendada = NEW.data_agendada
     AND OLD.hora_agendada = NEW.hora_agendada
     AND OLD.status NOT IN ('cancelado', 'nao_compareceu') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'lavaflow/booking/' || NEW.owner_id::text || '/' ||
      NEW.data_agendada::text || '/' || NEW.hora_agendada::text,
      0
    )
  );

  SELECT GREATEST(1, c.capacidade_simultanea)
    INTO v_capacity
    FROM public.agenda_config c
   WHERE c.owner_id = NEW.owner_id;

  v_capacity := COALESCE(v_capacity, 1);

  SELECT COUNT(*) INTO v_count
    FROM public.agendamentos a
   WHERE a.owner_id = NEW.owner_id
     AND a.data_agendada = NEW.data_agendada
     AND a.hora_agendada = NEW.hora_agendada
     AND a.id IS DISTINCT FROM NEW.id
     AND a.status NOT IN ('cancelado', 'nao_compareceu');

  IF v_count >= v_capacity THEN
    RAISE EXCEPTION 'Horário não está mais disponível (capacidade atingida).'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_slot_capacity ON public.agendamentos;
CREATE TRIGGER trg_agendamento_slot_capacity
BEFORE INSERT OR UPDATE OF owner_id, data_agendada, hora_agendada, status
ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.enforce_agendamento_slot_capacity();

REVOKE ALL ON FUNCTION public.enforce_agendamento_slot_capacity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_agendamento_slot_capacity() TO authenticated, service_role;
