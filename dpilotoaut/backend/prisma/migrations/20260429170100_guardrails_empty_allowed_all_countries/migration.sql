-- Lista vazia = todos os países permitidos pelos guardrails.
ALTER TABLE "paid_guardrails"
ALTER COLUMN "allowed_countries"
SET DEFAULT ARRAY[]::TEXT[];

UPDATE "paid_guardrails"
SET "allowed_countries" = ARRAY[]::TEXT[];
