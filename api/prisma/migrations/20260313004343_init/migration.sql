-- CreateTable
CREATE TABLE "HealthCheckLog" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheckLog_pkey" PRIMARY KEY ("id")
);
