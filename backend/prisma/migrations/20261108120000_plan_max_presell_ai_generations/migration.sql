-- Quota IA de review/presell configurável por plano (admin).
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_presell_ai_generations" INTEGER;

-- Defaults comerciais alinhados ao fallback por tipo (admin pode alterar depois).
UPDATE "plans" SET "max_presell_ai_generations" = 8 WHERE type = 'free_trial' AND "max_presell_ai_generations" IS NULL;
UPDATE "plans" SET "max_presell_ai_generations" = 40 WHERE type IN ('monthly', 'quarterly') AND "max_presell_ai_generations" IS NULL;
UPDATE "plans" SET "max_presell_ai_generations" = 120 WHERE type = 'annual' AND "max_presell_ai_generations" IS NULL;
