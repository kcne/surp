-- Credits a delete to the person whose edit removed the row (#27, PR 1a).
--
-- The trigger from #109 credits every event to the row's updatedById, which
-- for a delete is whoever last wrote the row, not whoever removed it. Since
-- stored departures, deletes are machine-driven at scale: a weekday removed
-- from a ride deletes a year of departures and their stops, all of which were
-- last written by the first fill's system actor. scheduleEditTransaction now
-- sets `surp.audit_actor` for its transaction, and a delete prefers it.
--
-- Only the function body changes. Inserts and updates are credited exactly as
-- before, and a delete outside a schedule edit still falls back to the row.

CREATE OR REPLACE FUNCTION "record_domain_audit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  current_row jsonb := COALESCE(new_row, old_row);
  -- A deleted row cannot name who deleted it. A schedule edit sets the
  -- transaction's actor, which is preferred for deletes; any other delete still
  -- falls back to the row's last writer.
  actor text := CASE
    WHEN TG_OP = 'DELETE' THEN COALESCE(
      NULLIF(current_setting('surp.audit_actor', true), ''),
      old_row ->> 'updatedById',
      old_row ->> 'createdById'
    )
    ELSE COALESCE(
      new_row ->> 'updatedById',
      new_row ->> 'createdById',
      old_row ->> 'updatedById',
      old_row ->> 'createdById'
    )
  END;
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
