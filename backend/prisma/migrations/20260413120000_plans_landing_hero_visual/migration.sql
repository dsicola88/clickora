-- Efeitos visuais do hero da landing /planos (overlay, zoom, parallax, CTA, etc.)
ALTER TABLE "plans_landing_config" ADD COLUMN IF NOT EXISTS "hero_visual" JSONB;
