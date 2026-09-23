-- Validates the constraints the previous migration added NOT VALID.
--
-- Its own migration so it runs in its own transaction, after that one has
-- committed and released its locks. VALIDATE CONSTRAINT scans the existing
-- rows under SHARE UPDATE EXCLUSIVE (and ROW SHARE on the referenced table for
-- a foreign key), so reads and writes carry on during the scan. Every new
-- column is NULL on existing rows, so the scan cannot find a violation.

ALTER TABLE "Reservation" VALIDATE CONSTRAINT "Reservation_rideDayScheduleId_rideId_tenantId_fkey";

ALTER TABLE "Reservation" VALIDATE CONSTRAINT "Reservation_rideExceptionId_rideId_tenantId_fkey";

ALTER TABLE "Reservation" VALIDATE CONSTRAINT "Reservation_departure_identity_check";

ALTER TABLE "RideException" VALIDATE CONSTRAINT "RideException_retiredAt_additional_check";
