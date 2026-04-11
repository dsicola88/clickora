-- Colunas de integração em users (existiam no schema.prisma mas sem migração — seed falhava com P2022).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sale_notify_email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_refresh_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_customer_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_conversion_action_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_login_customer_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_bot_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_notify_sale" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_notify_postback_error" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_notify_click" BOOLEAN NOT NULL DEFAULT false;
