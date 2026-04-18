-- Meta Conversions API (server-side) + estado por conversão
-- IF NOT EXISTS: bases onde parte do SQL já tinha sido aplicada manualmente.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_capi_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_pixel_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_capi_test_event_code" TEXT;

ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "meta_capi_sync" TEXT;
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "meta_capi_synced_at" TIMESTAMP(3);
ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "meta_capi_sync_detail" JSONB;
