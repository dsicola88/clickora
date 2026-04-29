-- Lista vazia em allowed_countries = sem restrição geográfica nos guardrails (qualquer país ISO nas campanhas).
ALTER TABLE "paid_ads_guardrails"
ALTER COLUMN "allowed_countries"
SET DEFAULT ARRAY[]::TEXT[];

UPDATE "paid_ads_guardrails"
SET "allowed_countries" = ARRAY[]::TEXT[];
