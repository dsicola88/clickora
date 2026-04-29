-- Novos projectos passam a nascer com BR, PT e US como mercados permitidos (alinhado aos assistentes da app).
-- Linhas já existentes não são alteradas — apenas o DEFAULT para INSERTs futuros.
ALTER TABLE "paid_ads_guardrails"
ALTER COLUMN "allowed_countries"
SET DEFAULT ARRAY['BR', 'PT', 'US']::TEXT[];
