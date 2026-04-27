-- Módulo Dpiloto (criador de anúncios): incluído no plano Premium por defeito (seed + admin).
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "dpilot_ads_enabled" BOOLEAN NOT NULL DEFAULT false;
