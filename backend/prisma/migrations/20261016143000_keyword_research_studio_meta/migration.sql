-- Metadados do estúdio Pesquisa e anúncios + carimbo de actualização.
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "affiliate_platform" VARCHAR(24);
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "funnel" VARCHAR(16);
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "final_url" TEXT;
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "keyword_researches" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
