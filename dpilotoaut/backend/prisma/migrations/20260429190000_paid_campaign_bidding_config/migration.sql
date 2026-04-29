-- AlterTable
ALTER TABLE "paid_campaigns" ADD COLUMN IF NOT EXISTS "bidding_config" JSONB NOT NULL DEFAULT '{}';
