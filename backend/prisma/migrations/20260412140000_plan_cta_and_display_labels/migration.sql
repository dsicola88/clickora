-- Texto opcional do botão por plano + etiquetas configuráveis da página /planos
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_label" VARCHAR(160);

ALTER TABLE "plans_landing_config" ADD COLUMN IF NOT EXISTS "plan_display_labels" JSONB;
