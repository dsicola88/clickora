-- Segmentação no Ads Studio: locais, dispositivos, idades.
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'sync_campaign_geo_targets';
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'sync_campaign_device_bids';
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'sync_campaign_age_exclusions';
