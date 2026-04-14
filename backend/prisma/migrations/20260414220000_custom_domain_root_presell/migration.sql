-- Presell escolhida para abrir na raiz do domínio (https://hostname/)

ALTER TABLE "custom_domains" ADD COLUMN "root_presell_id" TEXT;

CREATE UNIQUE INDEX "custom_domains_root_presell_id_key" ON "custom_domains"("root_presell_id");

ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_root_presell_id_fkey" FOREIGN KEY ("root_presell_id") REFERENCES "presell_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
