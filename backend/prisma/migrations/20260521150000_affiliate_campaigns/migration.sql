-- Campanhas de afiliado (metadados UX). Sem impacto em tracking/postback.

CREATE TABLE IF NOT EXISTS "affiliate_campaigns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "traffic_source" VARCHAR(64) NOT NULL,
    "country" VARCHAR(8),
    "language" VARCHAR(16),
    "offer_url" TEXT,
    "platform" VARCHAR(64),
    "presell_id" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "affiliate_campaigns_user_id_created_at_idx" ON "affiliate_campaigns"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_campaigns_presell_id_idx" ON "affiliate_campaigns"("presell_id");

DO $$ BEGIN
  ALTER TABLE "affiliate_campaigns" ADD CONSTRAINT "affiliate_campaigns_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "affiliate_campaigns" ADD CONSTRAINT "affiliate_campaigns_presell_id_fkey"
    FOREIGN KEY ("presell_id") REFERENCES "presell_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
