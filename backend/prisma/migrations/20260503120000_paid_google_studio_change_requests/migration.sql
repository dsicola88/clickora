-- Tipos extra de pedido (Google Ads, pós-publicação).
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'resume_entity';
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'remove_keyword';
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'update_rsa_copy';
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'update_ad_group_cpc';

-- CPC por ad group gravado quando `manual_cpc` + valor à publicação; editável pelo estúdio.
ALTER TABLE "paid_ads_ad_groups" ADD COLUMN IF NOT EXISTS "cpc_bid_micros" BIGINT;
