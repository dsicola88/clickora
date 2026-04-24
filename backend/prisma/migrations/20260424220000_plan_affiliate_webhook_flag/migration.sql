-- Webhook de afiliados: por plano, configurável no admin (ex.: só Premium).
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "affiliate_webhook_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "plans" SET "affiliate_webhook_enabled" = true WHERE "id" = 'plan_annual';
UPDATE "plans" SET "affiliate_webhook_enabled" = false WHERE "id" IN ('plan_free', 'plan_monthly');
