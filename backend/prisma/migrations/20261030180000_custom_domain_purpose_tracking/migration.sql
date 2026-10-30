-- CreateEnum
CREATE TYPE "CustomDomainPurpose" AS ENUM ('hosting', 'tracking', 'both');

-- AlterTable
ALTER TABLE "custom_domains"
  ADD COLUMN IF NOT EXISTS "purpose" "CustomDomainPurpose" NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS "is_default_tracking" BOOLEAN NOT NULL DEFAULT false;
