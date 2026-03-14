-- CreateEnum
CREATE TYPE "RideType" AS ENUM ('RECURRING', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RideExceptionType" AS ENUM ('SKIP', 'ADDITIONAL');

-- CreateTable
CREATE TABLE "Ride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "lineId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "type" "RideType" NOT NULL,
  "status" "RideStatus" NOT NULL DEFAULT 'DRAFT',
  "recurringStartDate" DATE,
  "recurringEndDate" DATE,
  "oneTimeDate" DATE,
  "oneTimeDepartureTime" TEXT,
  "oneTimeArrivalTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideDayTime" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "rideId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "departureTime" TEXT NOT NULL,
  "arrivalTime" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RideDayTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideException" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "rideId" TEXT NOT NULL,
  "exceptionDate" DATE NOT NULL,
  "type" "RideExceptionType" NOT NULL,
  "departureTime" TEXT,
  "arrivalTime" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RideException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ride_tenantId_idx" ON "Ride"("tenantId");

-- CreateIndex
CREATE INDEX "Ride_tenantId_status_idx" ON "Ride"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Ride_lineId_idx" ON "Ride"("lineId");

-- CreateIndex
CREATE INDEX "Ride_updatedById_idx" ON "Ride"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "RideDayTime_rideId_dayOfWeek_key" ON "RideDayTime"("rideId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "RideDayTime_tenantId_idx" ON "RideDayTime"("tenantId");

-- CreateIndex
CREATE INDEX "RideDayTime_rideId_idx" ON "RideDayTime"("rideId");

-- CreateIndex
CREATE INDEX "RideDayTime_updatedById_idx" ON "RideDayTime"("updatedById");

-- CreateIndex
CREATE INDEX "RideException_tenantId_idx" ON "RideException"("tenantId");

-- CreateIndex
CREATE INDEX "RideException_rideId_idx" ON "RideException"("rideId");

-- CreateIndex
CREATE INDEX "RideException_rideId_exceptionDate_idx" ON "RideException"("rideId", "exceptionDate");

-- CreateIndex
CREATE INDEX "RideException_updatedById_idx" ON "RideException"("updatedById");

-- AddForeignKey
ALTER TABLE "Ride"
ADD CONSTRAINT "Ride_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride"
ADD CONSTRAINT "Ride_lineId_fkey"
FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideDayTime"
ADD CONSTRAINT "RideDayTime_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideDayTime"
ADD CONSTRAINT "RideDayTime_rideId_fkey"
FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideException"
ADD CONSTRAINT "RideException_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideException"
ADD CONSTRAINT "RideException_rideId_fkey"
FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
