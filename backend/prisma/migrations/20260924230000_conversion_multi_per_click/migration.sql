-- Várias vendas por clique (rebill / upsell): remove unicidade de click_id.
-- Idempotência continua em (user_id, external_order_id).
DROP INDEX IF EXISTS "conversions_click_id_key";
CREATE INDEX IF NOT EXISTS "conversions_click_id_idx" ON "conversions"("click_id");
