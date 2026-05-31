-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Reservation_tenantId_rideId_travelDate_rideDepartureTime_groupId_idx"
  ON "Reservation"("tenantId", "rideId", "travelDate", "rideDepartureTime", "groupId");
