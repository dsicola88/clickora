-- Gasto manual por campanha (ROI sem depender só da API Google).

ALTER TABLE "affiliate_campaigns" ADD COLUMN IF NOT EXISTS "spend_amount" DECIMAL(14,4);
ALTER TABLE "affiliate_campaigns" ADD COLUMN IF NOT EXISTS "spend_currency" VARCHAR(8);
