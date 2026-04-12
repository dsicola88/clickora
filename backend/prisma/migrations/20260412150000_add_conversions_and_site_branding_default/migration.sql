-- Alinha histórico de migrações com schema.prisma (tabela conversions + default site_branding).
-- Idempotente: seguro em bases já sincronizadas com db push.

-- AlterTable
ALTER TABLE "site_branding" ALTER COLUMN "id" SET DEFAULT 'default';

-- CreateTable
CREATE TABLE IF NOT EXISTS "conversions" (
    "id" TEXT NOT NULL,
    "click_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "presell_id" TEXT NOT NULL,
    "campaign" TEXT,
    "amount" DECIMAL(14,4),
    "currency" TEXT DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "metadata" JSONB,
    "google_ads_sync" TEXT,
    "google_ads_synced_at" TIMESTAMP(3),
    "google_ads_sync_detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversions_click_id_key" ON "conversions"("click_id");

CREATE INDEX IF NOT EXISTS "conversions_user_id_idx" ON "conversions"("user_id");

CREATE INDEX IF NOT EXISTS "conversions_presell_id_idx" ON "conversions"("presell_id");

CREATE INDEX IF NOT EXISTS "conversions_created_at_idx" ON "conversions"("created_at");

CREATE INDEX IF NOT EXISTS "conversions_user_id_created_at_idx" ON "conversions"("user_id", "created_at");

-- AddForeignKey (idempotente)
DO $$ BEGIN
  ALTER TABLE "conversions" ADD CONSTRAINT "conversions_click_id_fkey" FOREIGN KEY ("click_id") REFERENCES "tracking_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "conversions" ADD CONSTRAINT "conversions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "conversions" ADD CONSTRAINT "conversions_presell_id_fkey" FOREIGN KEY ("presell_id") REFERENCES "presell_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
