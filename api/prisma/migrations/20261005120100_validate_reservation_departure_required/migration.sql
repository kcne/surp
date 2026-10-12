-- Scan existing rows under SHARE UPDATE EXCLUSIVE, allowing reads and writes.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Reservation" VALIDATE CONSTRAINT "Reservation_departureId_not_null";
COMMIT;
