-- Anúncio + identidade TikTok (ad/create) e Página Facebook escolhida por projecto (publicação Meta).
ALTER TABLE "paid_ads_campaigns" ADD COLUMN IF NOT EXISTS "tiktok_ad_id" TEXT;
ALTER TABLE "paid_ads_campaigns" ADD COLUMN IF NOT EXISTS "tiktok_identity_id" TEXT;

ALTER TABLE "paid_ads_meta_connections" ADD COLUMN IF NOT EXISTS "page_id" TEXT;
ALTER TABLE "paid_ads_meta_connections" ADD COLUMN IF NOT EXISTS "page_name" TEXT;
