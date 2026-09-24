-- Domain changes are recorded by the database, not by the Prisma client.
--
-- A trigger sees every write (nested, bulk and raw SQL included), always sees
-- the whole row, and runs inside the writing transaction, so a write that is
-- rolled back leaves no record behind.
--
-- The record keeps the shape the Prisma extension wrote: entityType is the
-- table, the actor is the row's updatedById (else createdById), and
-- metadata is {action, changes} with only the columns that changed.
CREATE FUNCTION "record_domain_audit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  current_row jsonb := COALESCE(new_row, old_row);
  actor text := COALESCE(
    new_row ->> 'updatedById',
    new_row ->> 'createdById',
    old_row ->> 'updatedById',
    old_row ->> 'createdById'
  );
  action text := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  changes jsonb;
BEGIN
  IF current_row ->> 'tenantId' IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'Cannot audit %: tenantId and an audit actor are required', TG_TABLE_NAME;
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(
      field,
      CASE
        WHEN old_row IS NULL THEN jsonb_build_object('after', new_row -> field)
        WHEN new_row IS NULL THEN jsonb_build_object('before', old_row -> field)
        ELSE jsonb_build_object('before', old_row -> field, 'after', new_row -> field)
      END
    ),
    '{}'::jsonb
  )
  INTO changes
  FROM jsonb_object_keys(current_row) AS field
  WHERE field NOT IN ('id', 'tenantId', 'createdAt', 'updatedAt', 'createdById', 'updatedById')
    AND (old_row IS NULL OR new_row IS NULL OR old_row -> field IS DISTINCT FROM new_row -> field);

  INSERT INTO "AuditEvent" ("id", "tenantId", "actorUserId", "entityType", "entityId", "type", "metadata", "createdAt")
  VALUES (
    gen_random_uuid()::text,
    current_row ->> 'tenantId',
    actor,
    TG_TABLE_NAME,
    current_row ->> 'id',
    ('DOMAIN_' || upper(action))::"AuditEventType",
    jsonb_build_object('action', action, 'changes', changes),
    clock_timestamp()
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER "Line_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "Line"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();

CREATE TRIGGER "LineStop_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "LineStop"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();

CREATE TRIGGER "Ride_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "Ride"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();

CREATE TRIGGER "RideDaySchedule_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "RideDaySchedule"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();

CREATE TRIGGER "RideDayScheduleStationTime_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "RideDayScheduleStationTime"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();

CREATE TRIGGER "RideException_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "RideException"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();

CREATE TRIGGER "Reservation_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "Reservation"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();
