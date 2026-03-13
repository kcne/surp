-- AlterTable
ALTER TABLE "User"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "RefreshSession"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- CreateIndex
CREATE INDEX "User_updatedById_idx" ON "User"("updatedById");

-- CreateIndex
CREATE INDEX "RefreshSession_updatedById_idx" ON "RefreshSession"("updatedById");
