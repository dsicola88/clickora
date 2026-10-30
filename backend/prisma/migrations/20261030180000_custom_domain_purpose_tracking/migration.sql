-- CreateEnum (idempotente se a migration for reaplicada / parcial)
DO $$ BEGIN
  CREATE TYPE "CustomDomainPurpose" AS ENUM ('hosting', 'tracking', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "custom_domains"
  ADD COLUMN IF NOT EXISTS "purpose" "CustomDomainPurpose" NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS "is_default_tracking" BOOLEAN NOT NULL DEFAULT false;

-- Tracking-only nunca é lander padrão
UPDATE "custom_domains"
SET "is_default" = false
WHERE "purpose" = 'tracking' AND "is_default" = true;
