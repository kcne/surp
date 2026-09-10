-- Intermediate stops can now be restricted to boarding-only or drop-off-only.
-- Existing stops served both purposes, so they keep both flags enabled.
ALTER TABLE "LineStop" ADD COLUMN "isBoarding" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LineStop" ADD COLUMN "isDropoff" BOOLEAN NOT NULL DEFAULT true;
