ALTER TABLE "Reservation" ADD COLUMN "roundTripId" TEXT;

CREATE INDEX "Reservation_tenantId_roundTripId_status_idx"
  ON "Reservation"("tenantId", "roundTripId", "status");
