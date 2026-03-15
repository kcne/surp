-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('PASSWORD_RESET_ADMIN');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "requirePasswordChange" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "type" "AuditEventType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_type_idx" ON "AuditEvent"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditEvent_targetUserId_idx" ON "AuditEvent"("targetUserId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
