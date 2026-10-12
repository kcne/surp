-- The committed validated check proves non-nullness, so SET NOT NULL skips
-- the table scan. Keep the check until after SET NOT NULL completes.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Reservation" ALTER COLUMN "departureId" SET NOT NULL;
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_departureId_not_null";
COMMIT;
