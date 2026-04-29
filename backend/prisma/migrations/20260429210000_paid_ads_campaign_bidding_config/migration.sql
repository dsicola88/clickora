-- Preferências de licitação/orientação por campanha (Google Meta TikTok — campo JSON flexível).
ALTER TABLE "paid_ads_campaigns" ADD COLUMN IF NOT EXISTS "bidding_config" JSONB NOT NULL DEFAULT '{}';
