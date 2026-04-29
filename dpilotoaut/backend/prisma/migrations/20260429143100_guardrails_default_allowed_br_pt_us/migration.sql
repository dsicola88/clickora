-- Novos projectos passam a nascer com BR, PT e US permitidos (alinhado ao produto).
-- Linhas existentes não são alteradas — apenas o DEFAULT para INSERTs futuros.
ALTER TABLE "paid_guardrails"
ALTER COLUMN "allowed_countries"
SET DEFAULT ARRAY['BR', 'PT', 'US']::TEXT[];
