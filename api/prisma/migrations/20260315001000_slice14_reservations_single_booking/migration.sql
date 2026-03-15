-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Reservation"
ADD COLUMN "rideId" TEXT,
ADD COLUMN "passengerId" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT,
ADD COLUMN "travelDate" DATE,
ADD COLUMN "rideDepartureTime" TEXT,
ADD COLUMN "rideArrivalTime" TEXT,
ADD COLUMN "seatNumber" INTEGER,
ADD COLUMN "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Backfill nullability-safe defaults for existing rows if any.
UPDATE "Reservation"
SET
  "travelDate" = COALESCE("travelDate", CURRENT_DATE),
  "rideDepartureTime" = COALESCE("rideDepartureTime", '00:00'),
  "rideArrivalTime" = COALESCE("rideArrivalTime", '00:00'),
  "seatNumber" = COALESCE("seatNumber", 0)
WHERE
  "travelDate" IS NULL
  OR "rideDepartureTime" IS NULL
  OR "rideArrivalTime" IS NULL
  OR "seatNumber" IS NULL;

-- Remove legacy pre-slice rows that cannot be mapped to ride/passenger links.
DELETE FROM "Reservation"
WHERE "rideId" IS NULL OR "passengerId" IS NULL;

-- Enforce required reservation instance fields.
ALTER TABLE "Reservation"
ALTER COLUMN "travelDate" SET NOT NULL,
ALTER COLUMN "rideDepartureTime" SET NOT NULL,
ALTER COLUMN "rideArrivalTime" SET NOT NULL,
ALTER COLUMN "rideId" SET NOT NULL,
ALTER COLUMN "passengerId" SET NOT NULL,
ALTER COLUMN "seatNumber" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Reservation_rideId_idx" ON "Reservation"("rideId");

-- CreateIndex
CREATE INDEX "Reservation_passengerId_idx" ON "Reservation"("passengerId");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_rideId_travelDate_idx" ON "Reservation"("tenantId", "rideId", "travelDate");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_rideId_travelDate_rideDepartureTime_idx" ON "Reservation"("tenantId", "rideId", "travelDate", "rideDepartureTime");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_rideId_travelDate_rideDepartureTime_seatN_idx"
ON "Reservation"("tenantId", "rideId", "travelDate", "rideDepartureTime", "seatNumber", "status");

-- RenameIndex
ALTER INDEX "Reservation_tenantId_rideId_travelDate_rideDepartureTime_seatN_idx"
RENAME TO "Reservation_tenantId_rideId_travelDate_rideDepartureTime_se_idx";

-- CreateIndex
CREATE INDEX "Reservation_updatedById_idx" ON "Reservation"("updatedById");

-- AddForeignKey
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_rideId_fkey"
FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_passengerId_fkey"
FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
