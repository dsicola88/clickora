-- Limiares configuráveis por projecto para pausa automática (optimizer) sem conversões.
ALTER TABLE "paid_ads_guardrails"
  ADD COLUMN IF NOT EXISTS "optimizer_pause_spend_usd" DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS "optimizer_pause_min_clicks" INTEGER;
