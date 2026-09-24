-- Custo diário multi-plataforma + Automizer keywords + anti-proxy + contas Meta/TikTok spend
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block_proxy_clicks" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_dry_run" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_min_spend_usd" DECIMAL(14,4) NOT NULL DEFAULT 15;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_min_clicks" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_lookback_days" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_ads_account_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_advertiser_id" TEXT;

CREATE TABLE IF NOT EXISTS "ad_platform_cost_daily" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "platform" VARCHAR(32) NOT NULL,
  "date" DATE NOT NULL,
  "level" VARCHAR(32) NOT NULL,
  "entity_key" VARCHAR(512) NOT NULL,
  "label" VARCHAR(512),
  "cost_micros" BIGINT NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "currency" VARCHAR(8) DEFAULT 'USD',
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_platform_cost_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_platform_cost_daily_user_id_platform_date_level_entity_key_key"
  ON "ad_platform_cost_daily"("user_id", "platform", "date", "level", "entity_key");
CREATE INDEX IF NOT EXISTS "ad_platform_cost_daily_user_id_platform_date_idx"
  ON "ad_platform_cost_daily"("user_id", "platform", "date");
CREATE INDEX IF NOT EXISTS "ad_platform_cost_daily_user_id_level_date_idx"
  ON "ad_platform_cost_daily"("user_id", "level", "date");

DO $$ BEGIN
  ALTER TABLE "ad_platform_cost_daily"
    ADD CONSTRAINT "ad_platform_cost_daily_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "affiliate_automizer_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "keyword" VARCHAR(512) NOT NULL,
  "reason" TEXT,
  "dry_run" BOOLEAN NOT NULL DEFAULT true,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "detail" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_automizer_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "affiliate_automizer_logs_user_id_created_at_idx"
  ON "affiliate_automizer_logs"("user_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "affiliate_automizer_logs"
    ADD CONSTRAINT "affiliate_automizer_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "conversions_user_id_status_idx" ON "conversions"("user_id", "status");
