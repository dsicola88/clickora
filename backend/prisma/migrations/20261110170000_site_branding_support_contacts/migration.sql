-- Contactos oficiais de suporte (editáveis pelo superadmin).
ALTER TABLE "site_branding" ADD COLUMN IF NOT EXISTS "support_email" VARCHAR(255);
ALTER TABLE "site_branding" ADD COLUMN IF NOT EXISTS "support_phone" VARCHAR(32);

-- Garante a linha singleton e grava os contactos oficiais actuais (substituíveis no Admin).
INSERT INTO "site_branding" ("id", "updated_at", "support_email", "support_phone")
VALUES ('default', CURRENT_TIMESTAMP, 'dclickoraoficial@gmail.com', '+244926510294')
ON CONFLICT ("id") DO UPDATE SET
  "support_email" = COALESCE(NULLIF(BTRIM("site_branding"."support_email"), ''), EXCLUDED."support_email"),
  "support_phone" = COALESCE(NULLIF(BTRIM("site_branding"."support_phone"), ''), EXCLUDED."support_phone"),
  "updated_at" = CURRENT_TIMESTAMP;
