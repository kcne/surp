-- CreateEnum
CREATE TYPE "MarketingLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'FOLLOW_UP', 'CONVERTED', 'NOT_INTERESTED', 'SPAM');

-- CreateEnum
CREATE TYPE "MarketingLeadDeparturesPerDay" AS ENUM ('ONE_TO_FIVE', 'SIX_TO_TWENTY', 'TWENTY_ONE_TO_FIFTY', 'FIFTY_PLUS');

-- CreateTable
CREATE TABLE "MarketingLead" (
  "id" TEXT NOT NULL,
  "status" "MarketingLeadStatus" NOT NULL DEFAULT 'NEW',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "agencyName" TEXT NOT NULL,
  "phone" TEXT,
  "departuresPerDay" "MarketingLeadDeparturesPerDay" NOT NULL,
  "message" TEXT,
  "ipAddress" TEXT,
  "internalEmailSentAt" TIMESTAMP(3),
  "confirmationEmailSentAt" TIMESTAMP(3),
  "lastEmailError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingLead_status_createdAt_idx" ON "MarketingLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingLead_createdAt_idx" ON "MarketingLead"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingLead_email_idx" ON "MarketingLead"("email");
