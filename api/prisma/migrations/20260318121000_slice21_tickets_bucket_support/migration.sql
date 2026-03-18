-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BUG', 'IDEA', 'FEATURE', 'QUESTION', 'OTHER');

-- CreateTable
CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "category" "TicketCategory" NOT NULL DEFAULT 'QUESTION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "commentId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_tenantId_idx" ON "Ticket"("tenantId");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_status_updatedAt_idx" ON "Ticket"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_category_updatedAt_idx" ON "Ticket"("tenantId", "category", "updatedAt");

-- CreateIndex
CREATE INDEX "Ticket_tenantId_createdAt_idx" ON "Ticket"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_updatedById_idx" ON "Ticket"("updatedById");

-- CreateIndex
CREATE INDEX "TicketComment_tenantId_idx" ON "TicketComment"("tenantId");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketComment_tenantId_ticketId_createdAt_idx" ON "TicketComment"("tenantId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketComment_authorUserId_idx" ON "TicketComment"("authorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAttachment_storageKey_key" ON "TicketAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "TicketAttachment_tenantId_idx" ON "TicketAttachment"("tenantId");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAttachment_commentId_idx" ON "TicketAttachment"("commentId");

-- CreateIndex
CREATE INDEX "TicketAttachment_tenantId_ticketId_createdAt_idx" ON "TicketAttachment"("tenantId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_updatedById_idx" ON "TicketAttachment"("updatedById");

-- AddForeignKey
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment"
ADD CONSTRAINT "TicketComment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment"
ADD CONSTRAINT "TicketComment_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment"
ADD CONSTRAINT "TicketAttachment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment"
ADD CONSTRAINT "TicketAttachment_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment"
ADD CONSTRAINT "TicketAttachment_commentId_fkey"
FOREIGN KEY ("commentId") REFERENCES "TicketComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
