-- AlterTable
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_custom_domains" INTEGER NOT NULL DEFAULT 0;

-- Valores por plano conhecido (Pro Anual: 2 slots; resto: sem domínio próprio comercialmente)
UPDATE "plans" SET "max_custom_domains" = 2 WHERE id = 'plan_annual';
UPDATE "plans" SET "max_custom_domains" = 0 WHERE id IN ('plan_monthly', 'plan_free');
