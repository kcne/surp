/*
  Warnings:

  - You are about to drop the `RideDayTime` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RideDayTime" DROP CONSTRAINT "RideDayTime_rideId_fkey";

-- DropForeignKey
ALTER TABLE "RideDayTime" DROP CONSTRAINT "RideDayTime_tenantId_fkey";

-- DropTable
DROP TABLE "RideDayTime";

-- CreateTable
CREATE TABLE "RideDaySchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideDaySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideDayScheduleStationTime" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rideDayScheduleId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "time" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideDayScheduleStationTime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RideDaySchedule_tenantId_idx" ON "RideDaySchedule"("tenantId");

-- CreateIndex
CREATE INDEX "RideDaySchedule_rideId_idx" ON "RideDaySchedule"("rideId");

-- CreateIndex
CREATE INDEX "RideDaySchedule_updatedById_idx" ON "RideDaySchedule"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "RideDaySchedule_rideId_dayOfWeek_key" ON "RideDaySchedule"("rideId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "RideDayScheduleStationTime_tenantId_idx" ON "RideDayScheduleStationTime"("tenantId");

-- CreateIndex
CREATE INDEX "RideDayScheduleStationTime_rideDayScheduleId_idx" ON "RideDayScheduleStationTime"("rideDayScheduleId");

-- CreateIndex
CREATE INDEX "RideDayScheduleStationTime_stationId_idx" ON "RideDayScheduleStationTime"("stationId");

-- CreateIndex
CREATE INDEX "RideDayScheduleStationTime_updatedById_idx" ON "RideDayScheduleStationTime"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "RideDayScheduleStationTime_rideDayScheduleId_stationId_key" ON "RideDayScheduleStationTime"("rideDayScheduleId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "RideDayScheduleStationTime_rideDayScheduleId_orderIndex_key" ON "RideDayScheduleStationTime"("rideDayScheduleId", "orderIndex");

-- AddForeignKey
ALTER TABLE "RideDaySchedule" ADD CONSTRAINT "RideDaySchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideDaySchedule" ADD CONSTRAINT "RideDaySchedule_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideDayScheduleStationTime" ADD CONSTRAINT "RideDayScheduleStationTime_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideDayScheduleStationTime" ADD CONSTRAINT "RideDayScheduleStationTime_rideDayScheduleId_fkey" FOREIGN KEY ("rideDayScheduleId") REFERENCES "RideDaySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideDayScheduleStationTime" ADD CONSTRAINT "RideDayScheduleStationTime_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
