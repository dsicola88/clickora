-- Catálogo simplificado: só Free, Mensal e Anual (remove trimestral).
UPDATE "subscriptions" SET "plan_id" = 'plan_monthly' WHERE "plan_id" = 'plan_quarterly';
DELETE FROM "plans" WHERE "id" = 'plan_quarterly';
