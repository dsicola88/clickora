CREATE TABLE IF NOT EXISTS "keyword_researches" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "product" VARCHAR(200) NOT NULL,
  "language" VARCHAR(16) NOT NULL,
  "market" VARCHAR(8) NOT NULL,
  "market_name" VARCHAR(80) NOT NULL,
  "product_url" TEXT,
  "url_title" VARCHAR(240),
  "keywords" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "keyword_researches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "keyword_researches_user_id_created_at_idx" ON "keyword_researches"("user_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "keyword_researches" ADD CONSTRAINT "keyword_researches_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
