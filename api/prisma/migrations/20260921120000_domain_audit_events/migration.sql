-- Changelog rows share AuditEvent with the existing security audit trail.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DOMAIN_CREATE';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DOMAIN_UPDATE';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DOMAIN_DELETE';

ALTER TABLE "AuditEvent"
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "entityId" TEXT;

CREATE INDEX "AuditEvent_tenantId_entityType_entityId_createdAt_idx"
  ON "AuditEvent"("tenantId", "entityType", "entityId", "createdAt");
