-- Limites opcionais do optimizer por campanha (fallback: guardrails do projecto / env).

ALTER TABLE "paid_ads_campaigns"
  ADD COLUMN IF NOT EXISTS "optimizer_pause_spend_usd" DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS "optimizer_pause_min_clicks" INTEGER;

