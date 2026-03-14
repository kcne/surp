-- CreateTable
CREATE TABLE "LineStop" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "lineId" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LineStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineStop_lineId_orderIndex_key" ON "LineStop"("lineId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "LineStop_lineId_stationId_key" ON "LineStop"("lineId", "stationId");

-- CreateIndex
CREATE INDEX "LineStop_tenantId_idx" ON "LineStop"("tenantId");

-- CreateIndex
CREATE INDEX "LineStop_lineId_idx" ON "LineStop"("lineId");

-- CreateIndex
CREATE INDEX "LineStop_stationId_idx" ON "LineStop"("stationId");

-- CreateIndex
CREATE INDEX "LineStop_updatedById_idx" ON "LineStop"("updatedById");

-- AddForeignKey
ALTER TABLE "LineStop"
ADD CONSTRAINT "LineStop_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineStop"
ADD CONSTRAINT "LineStop_lineId_fkey"
FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineStop"
ADD CONSTRAINT "LineStop_stationId_fkey"
FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
