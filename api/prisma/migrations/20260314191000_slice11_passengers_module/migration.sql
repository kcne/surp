-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('ADULT', 'CHILD', 'STUDENT', 'SENIOR');

-- CreateTable
CREATE TABLE "Passenger" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "passengerType" "PassengerType" NOT NULL DEFAULT 'ADULT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Passenger_tenantId_idx" ON "Passenger"("tenantId");

-- CreateIndex
CREATE INDEX "Passenger_tenantId_isActive_idx" ON "Passenger"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Passenger_tenantId_firstName_idx" ON "Passenger"("tenantId", "firstName");

-- CreateIndex
CREATE INDEX "Passenger_tenantId_lastName_idx" ON "Passenger"("tenantId", "lastName");

-- CreateIndex
CREATE INDEX "Passenger_tenantId_phone_idx" ON "Passenger"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Passenger_tenantId_email_idx" ON "Passenger"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Passenger_updatedById_idx" ON "Passenger"("updatedById");

-- AddForeignKey
ALTER TABLE "Passenger"
ADD CONSTRAINT "Passenger_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
