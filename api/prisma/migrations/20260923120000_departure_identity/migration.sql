-- Gives a reservation a departure identity that does not change when the
-- departure's time does (#27 §1, §2).
--
-- A reservation is joined to its departure by ride, date and departure time
-- today, so moving a time or a route's first stop renames the departure and
-- strands everyone booked on it. This adds the columns that name it instead:
-- a kind, plus the weekday schedule or additional departure it was sold on.
--
-- Additive only. Every new column is nullable and stays NULL: nothing writes
-- an identity until the cutover, and existing rows are resolved later by a
-- reviewed backfill. No existing row is read or rewritten here.

-- CreateEnum
CREATE TYPE "DepartureKind" AS ENUM ('RECURRING_BASE', 'ONE_TIME_BASE', 'ADDITIONAL');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "departureKind" "DepartureKind",
ADD COLUMN     "rideDayScheduleId" TEXT,
ADD COLUMN     "rideExceptionId" TEXT;

-- A dropped weekday and a removed additional departure are retired rather
-- than deleted, so the rows reservations point at keep existing.
ALTER TABLE "RideDaySchedule" ADD COLUMN     "retiredAt" TIMESTAMP(3);

ALTER TABLE "RideException" ADD COLUMN     "retiredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Reservation_rideDayScheduleId_idx" ON "Reservation"("rideDayScheduleId");

-- CreateIndex
CREATE INDEX "Reservation_rideExceptionId_idx" ON "Reservation"("rideExceptionId");

-- The targets of the composite foreign keys below. `id` is already unique, so
-- these add no rule of their own; they exist so a reservation can reference a
-- departure together with the ride and tenant it belongs to.
CREATE UNIQUE INDEX "RideDaySchedule_id_rideId_tenantId_key" ON "RideDaySchedule"("id", "rideId", "tenantId");

CREATE UNIQUE INDEX "RideException_id_rideId_tenantId_key" ON "RideException"("id", "rideId", "tenantId");

-- A reservation can only name a departure of its own ride in its own tenant,
-- whatever the application does. RESTRICT keeps a departure that someone is
-- booked on from being deleted. With the default MATCH SIMPLE, a NULL
-- departure column leaves the key unchecked, which is what a legacy row needs.
--
-- All four constraints below are added NOT VALID: they apply to every write
-- from now on, but existing rows are not scanned while this migration holds
-- its locks (ACCESS EXCLUSIVE for a CHECK). The next migration validates them
-- under SHARE UPDATE EXCLUSIVE, which lets bookings carry on.
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rideDayScheduleId_rideId_tenantId_fkey" FOREIGN KEY ("rideDayScheduleId", "rideId", "tenantId") REFERENCES "RideDaySchedule"("id", "rideId", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rideExceptionId_rideId_tenantId_fkey" FOREIGN KEY ("rideExceptionId", "rideId", "tenantId") REFERENCES "RideException"("id", "rideId", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;

-- The only valid shapes of an identity. A legacy row has none of it; each
-- kind names exactly the departure row it needs and nothing else.
--
-- Written as a CASE because every branch is built from IS [NOT] NULL tests and
-- so is never NULL itself. The obvious OR of `"departureKind" = '...'` terms
-- evaluates to NULL when the kind is NULL, and a CHECK passes on NULL, which
-- would let a row name a departure without saying what kind it is.
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_departure_identity_check"
CHECK (
  CASE "departureKind"
    WHEN 'RECURRING_BASE' THEN "rideDayScheduleId" IS NOT NULL AND "rideExceptionId" IS NULL
    WHEN 'ONE_TIME_BASE' THEN "rideDayScheduleId" IS NULL AND "rideExceptionId" IS NULL
    WHEN 'ADDITIONAL' THEN "rideDayScheduleId" IS NULL AND "rideExceptionId" IS NOT NULL
    ELSE "rideDayScheduleId" IS NULL AND "rideExceptionId" IS NULL
  END
) NOT VALID;

-- A SKIP is not something a reservation can be sold on, so it is still
-- deleted when removed and never retired.
ALTER TABLE "RideException"
ADD CONSTRAINT "RideException_retiredAt_additional_check"
CHECK ("retiredAt" IS NULL OR "type" = 'ADDITIONAL') NOT VALID;
