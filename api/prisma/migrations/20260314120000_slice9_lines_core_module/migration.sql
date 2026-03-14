-- CreateEnum
CREATE TYPE "LineDirectionMode" AS ENUM ('SINGLE', 'BOTH');

-- CreateEnum
CREATE TYPE "LineDirection" AS ENUM ('OUTBOUND', 'RETURN');

-- AlterTable
ALTER TABLE "Line"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "directionMode" "LineDirectionMode" NOT NULL DEFAULT 'BOTH',
ADD COLUMN "direction" "LineDirection" NOT NULL DEFAULT 'OUTBOUND',
ADD COLUMN "pairKey" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing rows with a deterministic display name.
UPDATE "Line" AS l
SET "name" = CONCAT(ds."name", ' - ', asn."name")
FROM "Station" AS ds,
     "Station" AS asn
WHERE l."departureStationId" = ds."id"
  AND l."arrivalStationId" = asn."id"
  AND l."name" IS NULL;

UPDATE "Line"
SET "name" = 'Line'
WHERE "name" IS NULL;

ALTER TABLE "Line"
ALTER COLUMN "name" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Line_tenantId_isActive_idx" ON "Line"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Line_pairKey_idx" ON "Line"("pairKey");

-- CreateIndex
CREATE INDEX "Line_updatedById_idx" ON "Line"("updatedById");
