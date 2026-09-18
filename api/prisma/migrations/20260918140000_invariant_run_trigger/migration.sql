-- Manual runs from Settings are stored alongside the nightly ones, so the page
-- can say when the last check ran and date the start of a problem. Additive:
-- existing rows are all scheduled, and dropping NOT NULL off runDate widens
-- what the column accepts without rewriting anything already in it.

-- CreateEnum
CREATE TYPE "InvariantRunTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- AlterTable
ALTER TABLE "InvariantRun"
ADD COLUMN "trigger" "InvariantRunTrigger" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "triggeredById" TEXT;

-- A manual run claims no day. The unique (tenantId, runDate) index is what
-- stops two replicas from running the same night twice, and Postgres treats
-- NULLs as distinct, so leaving runDate empty keeps manual runs out of that
-- race entirely instead of competing with the scheduled one for the day.
ALTER TABLE "InvariantRun" ALTER COLUMN "runDate" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "InvariantRun_tenantId_startedAt_idx" ON "InvariantRun"("tenantId", "startedAt");
