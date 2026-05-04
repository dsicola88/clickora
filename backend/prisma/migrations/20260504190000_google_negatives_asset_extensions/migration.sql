-- AlterEnum
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'sync_campaign_negative_keywords';
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'sync_ad_group_negative_keywords';
ALTER TYPE "PaidAdsChangeRequestType" ADD VALUE 'replace_google_asset_extensions';

-- CreateTable
CREATE TABLE "paid_ads_campaign_negative_keywords" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "text" VARCHAR(80) NOT NULL,
    "match_type" "PaidAdsMatchType" NOT NULL DEFAULT 'phrase',
    "external_criterion_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_ads_campaign_negative_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_ads_ad_group_negative_keywords" (
    "id" TEXT NOT NULL,
    "ad_group_id" TEXT NOT NULL,
    "text" VARCHAR(80) NOT NULL,
    "match_type" "PaidAdsMatchType" NOT NULL DEFAULT 'phrase',
    "external_criterion_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_ads_ad_group_negative_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paid_ads_campaign_negative_keywords_campaign_id_idx" ON "paid_ads_campaign_negative_keywords"("campaign_id");

-- CreateIndex
CREATE INDEX "paid_ads_ad_group_negative_keywords_ad_group_id_idx" ON "paid_ads_ad_group_negative_keywords"("ad_group_id");

-- AddForeignKey
ALTER TABLE "paid_ads_campaign_negative_keywords" ADD CONSTRAINT "paid_ads_campaign_negative_keywords_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "paid_ads_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_ads_ad_group_negative_keywords" ADD CONSTRAINT "paid_ads_ad_group_negative_keywords_ad_group_id_fkey" FOREIGN KEY ("ad_group_id") REFERENCES "paid_ads_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
