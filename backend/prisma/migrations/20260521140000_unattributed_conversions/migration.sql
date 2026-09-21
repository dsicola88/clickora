-- Conversões podem existir sem clique/presell (não atribuídas) e com order_id para idempotência.

ALTER TABLE "conversions" ALTER COLUMN "click_id" DROP NOT NULL;
ALTER TABLE "conversions" ALTER COLUMN "presell_id" DROP NOT NULL;

ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "attribution" TEXT NOT NULL DEFAULT 'attributed';
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "external_order_id" TEXT;

CREATE INDEX IF NOT EXISTS "conversions_attribution_idx" ON "conversions"("attribution");

-- Único (user, order_id): em PostgreSQL vários NULL em external_order_id são permitidos.
CREATE UNIQUE INDEX IF NOT EXISTS "conversions_user_id_external_order_id_key"
  ON "conversions"("user_id", "external_order_id");
