-- Keep the nullable runDate escape hatch exclusive to manual runs. Without
-- this constraint, a scheduled row with NULL runDate bypasses the nightly
-- unique (tenantId, runDate) claim.
ALTER TABLE "InvariantRun"
ADD CONSTRAINT "InvariantRun_trigger_runDate_check"
CHECK (
  ("trigger" = 'SCHEDULED' AND "runDate" IS NOT NULL)
  OR ("trigger" = 'MANUAL' AND "runDate" IS NULL)
);
