-- Múltiplos domínios por utilizador + presell opcional por domínio

ALTER TABLE "custom_domains" DROP CONSTRAINT IF EXISTS "custom_domains_user_id_key";

ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;

UPDATE "custom_domains" SET "is_default" = true WHERE "is_default" = false;

ALTER TABLE "presell_pages" ADD COLUMN IF NOT EXISTS "custom_domain_id" TEXT;

CREATE INDEX IF NOT EXISTS "presell_pages_custom_domain_id_idx" ON "presell_pages"("custom_domain_id");

ALTER TABLE "presell_pages" DROP CONSTRAINT IF EXISTS "presell_pages_custom_domain_id_fkey";

ALTER TABLE "presell_pages" ADD CONSTRAINT "presell_pages_custom_domain_id_fkey" FOREIGN KEY ("custom_domain_id") REFERENCES "custom_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
