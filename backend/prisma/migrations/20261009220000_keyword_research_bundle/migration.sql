-- Pacote de anúncios junto das pesquisas existentes. Colunas novas, sem apagar dados.
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "bundle" JSONB;
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(16);
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "objective" VARCHAR(24);
ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "source" VARCHAR(24);
