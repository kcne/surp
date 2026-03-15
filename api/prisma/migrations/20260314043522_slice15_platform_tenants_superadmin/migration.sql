-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedById" TEXT;

-- CreateIndex
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");

-- RenameIndex
ALTER INDEX "Reservation_tenantId_rideId_travelDate_rideDepartureTime_seatN_" RENAME TO "Reservation_tenantId_rideId_travelDate_rideDepartureTime_se_idx";
