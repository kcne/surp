-- CreateEnum
CREATE TYPE "StorefrontStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "timezone" TEXT;

-- CreateTable
CREATE TABLE "AgencyStorefront" (
  "tenantId" TEXT NOT NULL,
  "status" "StorefrontStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "heroTitle" TEXT,
  "heroSubtitle" TEXT,
  "heroImageUrl" TEXT,
  "heroImageAlt" TEXT,
  "aboutMarkdown" TEXT,
  "footerText" TEXT,
  "logoUrl" TEXT,
  "logoAlt" TEXT,
  "primaryColor" TEXT,
  "sectionsEnabled" JSONB NOT NULL DEFAULT '{"hero":true,"rides":true,"about":true}',
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "ogImageUrl" TEXT,
  "facebookUrl" TEXT,
  "instagramUrl" TEXT,
  "twitterUrl" TEXT,
  "linkedinUrl" TEXT,
  "websiteUrl" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgencyStorefront_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "AgencyStorefront"
ADD CONSTRAINT "AgencyStorefront_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
