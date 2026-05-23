-- AlterTable
ALTER TABLE "MarketingLead" ADD COLUMN "notes" TEXT,
ADD COLUMN "assigneeUserId" TEXT,
ADD COLUMN "convertedTenantId" TEXT,
ADD COLUMN "convertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetTenantId" TEXT,
  "targetLeadId" TEXT,
  "targetUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLead_convertedTenantId_key" ON "MarketingLead"("convertedTenantId");

-- CreateIndex
CREATE INDEX "MarketingLead_assigneeUserId_idx" ON "MarketingLead"("assigneeUserId");

-- CreateIndex
CREATE INDEX "MarketingLead_convertedTenantId_idx" ON "MarketingLead"("convertedTenantId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_actorUserId_idx" ON "PlatformAuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_action_createdAt_idx" ON "PlatformAuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_targetType_targetId_idx" ON "PlatformAuditEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_targetTenantId_idx" ON "PlatformAuditEvent"("targetTenantId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_targetLeadId_idx" ON "PlatformAuditEvent"("targetLeadId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_createdAt_idx" ON "PlatformAuditEvent"("createdAt");
