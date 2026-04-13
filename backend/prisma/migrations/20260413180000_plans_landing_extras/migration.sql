-- Secções extra da landing (tema escuro, FAQ, estatísticas, destaques) — JSON fundido no servidor
ALTER TABLE "plans_landing_config" ADD COLUMN IF NOT EXISTS "landing_extras" JSONB;
