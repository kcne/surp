-- CreateEnum
CREATE TYPE "InvariantRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "InvariantRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "runDate" DATE NOT NULL,
  "status" "InvariantRunStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "windowDays" INTEGER NOT NULL DEFAULT 30,
  "invariantCount" INTEGER NOT NULL DEFAULT 0,
  "violatedCount" INTEGER NOT NULL DEFAULT 0,
  "totalViolationCount" INTEGER NOT NULL DEFAULT 0,
  "results" JSONB NOT NULL,
  "error" TEXT,
  "ticketId" TEXT,
  "emailSentAt" TIMESTAMP(3),
  "alertError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvariantRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One run per tenant per day: the scheduled job claims this row before it starts,
-- so a second API replica loses the insert instead of duplicating the run.
CREATE UNIQUE INDEX "InvariantRun_tenantId_runDate_key" ON "InvariantRun"("tenantId", "runDate");

-- CreateIndex
CREATE INDEX "InvariantRun_tenantId_completedAt_idx" ON "InvariantRun"("tenantId", "completedAt");

-- CreateIndex
CREATE INDEX "InvariantRun_status_completedAt_idx" ON "InvariantRun"("status", "completedAt");

-- AddForeignKey
ALTER TABLE "InvariantRun"
ADD CONSTRAINT "InvariantRun_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
