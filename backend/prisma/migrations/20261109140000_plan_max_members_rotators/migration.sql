-- Limites comerciais configuráveis: seats de workspace e rotadores de tráfego.
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_workspace_members" INTEGER;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_traffic_rotators" INTEGER;

-- Valores iniciais alinhados aos fallbacks por tipo (admin pode alterar depois).
UPDATE "plans" SET "max_workspace_members" = 1, "max_traffic_rotators" = 3
WHERE "type" = 'free_trial' AND "max_workspace_members" IS NULL;

UPDATE "plans" SET "max_workspace_members" = 5, "max_traffic_rotators" = 25
WHERE "type" IN ('monthly', 'quarterly') AND "max_workspace_members" IS NULL;

-- annual: NULL = ilimitado (fallback)
