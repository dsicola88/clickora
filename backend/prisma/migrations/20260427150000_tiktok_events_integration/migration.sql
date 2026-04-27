-- TikTok Events API (server-side) + estado de sync em conversões

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_pixel_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_test_event_code" TEXT;

ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "tiktok_events_sync" TEXT;
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "tiktok_events_synced_at" TIMESTAMP(3);
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "tiktok_events_sync_detail" JSONB;
