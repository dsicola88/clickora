-- Paid Ads (ex-Dpiloto) — monólito Clickora; `user_id` = dono da conta (tenant)

CREATE TYPE "PaidAdsProjectMode" AS ENUM ('copilot', 'autopilot');
CREATE TYPE "PaidAdsConnectionStatus" AS ENUM ('disconnected', 'connected', 'error');
CREATE TYPE "PaidAdsPlatform" AS ENUM ('google_ads', 'meta_ads', 'tiktok_ads');
CREATE TYPE "PaidAdsCampaignStatus" AS ENUM ('draft', 'pending_publish', 'live', 'paused', 'archived', 'error');
CREATE TYPE "PaidAdsEntityStatus" AS ENUM ('draft', 'pending_publish', 'live', 'paused', 'archived', 'error');
CREATE TYPE "PaidAdsMatchType" AS ENUM ('exact', 'phrase', 'broad');
CREATE TYPE "PaidAdsChangeRequestType" AS ENUM (
  'create_campaign',
  'update_budget',
  'add_keywords',
  'publish_rsa',
  'pause_entity',
  'meta_create_campaign',
  'meta_update_budget',
  'meta_publish_creative',
  'meta_pause_entity',
  'tiktok_create_campaign',
  'tiktok_update_budget',
  'tiktok_pause_entity'
);
CREATE TYPE "PaidAdsChangeRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'applied', 'failed');
CREATE TYPE "PaidAdsAiFeature" AS ENUM ('keyword_plan', 'rsa_generation', 'campaign_plan');
CREATE TYPE "PaidAdsAiRunStatus" AS ENUM ('pending', 'success', 'error');
CREATE TYPE "PaidAdsMetaCta" AS ENUM (
  'learn_more',
  'shop_now',
  'sign_up',
  'contact_us',
  'book_now',
  'download',
  'get_quote',
  'subscribe'
);

CREATE TABLE "paid_ads_projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website_url" TEXT,
    "paid_mode" "PaidAdsProjectMode" NOT NULL DEFAULT 'copilot',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_google_ads_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "google_customer_id" TEXT,
    "account_name" TEXT,
    "status" "PaidAdsConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "token_ref" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_google_ads_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paid_ads_google_ads_connections_project_id_key" ON "paid_ads_google_ads_connections"("project_id");

CREATE TABLE "paid_ads_meta_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "ad_account_id" TEXT,
    "business_id" TEXT,
    "account_name" TEXT,
    "status" "PaidAdsConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "token_ref" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_meta_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paid_ads_meta_connections_project_id_key" ON "paid_ads_meta_connections"("project_id");

CREATE TABLE "paid_ads_tiktok_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "advertiser_id" TEXT,
    "account_name" TEXT,
    "status" "PaidAdsConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "token_ref" TEXT,
    "refresh_token_ref" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_tiktok_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paid_ads_tiktok_connections_project_id_key" ON "paid_ads_tiktok_connections"("project_id");

CREATE TABLE "paid_ads_campaigns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform" "PaidAdsPlatform" NOT NULL DEFAULT 'google_ads',
    "external_campaign_id" TEXT,
    "tiktok_ad_group_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "PaidAdsCampaignStatus" NOT NULL DEFAULT 'draft',
    "objective_summary" TEXT,
    "daily_budget_micros" BIGINT,
    "geo_targets" JSONB NOT NULL DEFAULT '[]',
    "language_targets" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_ad_groups" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PaidAdsEntityStatus" NOT NULL DEFAULT 'draft',
    "external_ad_group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_ad_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_keywords" (
    "id" TEXT NOT NULL,
    "ad_group_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "match_type" "PaidAdsMatchType" NOT NULL DEFAULT 'phrase',
    "status" "PaidAdsEntityStatus" NOT NULL DEFAULT 'draft',
    "external_criterion_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_ads_keywords_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_rsa" (
    "id" TEXT NOT NULL,
    "ad_group_id" TEXT NOT NULL,
    "headlines" JSONB NOT NULL DEFAULT '[]',
    "descriptions" JSONB NOT NULL DEFAULT '[]',
    "final_urls" JSONB NOT NULL DEFAULT '[]',
    "status" "PaidAdsEntityStatus" NOT NULL DEFAULT 'draft',
    "external_ad_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_rsa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_change_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "PaidAdsChangeRequestType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "PaidAdsChangeRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_guardrails" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "max_daily_budget_micros" BIGINT NOT NULL,
    "max_monthly_spend_micros" BIGINT NOT NULL,
    "max_cpc_micros" BIGINT,
    "allowed_countries" TEXT[] NOT NULL DEFAULT ARRAY['US']::TEXT[],
    "blocked_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "require_approval_above_micros" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_guardrails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paid_ads_guardrails_project_id_key" ON "paid_ads_guardrails"("project_id");

CREATE TABLE "paid_ads_ai_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "feature" "PaidAdsAiFeature" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL DEFAULT 'v1',
    "input_summary" TEXT,
    "output_summary" TEXT,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "estimated_cost_usd" DECIMAL(10,6),
    "status" "PaidAdsAiRunStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_ads_ai_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_meta_adsets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "PaidAdsEntityStatus" NOT NULL DEFAULT 'draft',
    "daily_budget_cents" BIGINT,
    "optimization_goal" TEXT,
    "targeting" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_meta_adsets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_meta_creatives" (
    "id" TEXT NOT NULL,
    "adset_id" TEXT NOT NULL,
    "external_id" TEXT,
    "primary_text" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta" "PaidAdsMetaCta" NOT NULL DEFAULT 'learn_more',
    "destination_url" TEXT NOT NULL,
    "image_asset_ref" TEXT,
    "placements" JSONB NOT NULL DEFAULT '[]',
    "status" "PaidAdsEntityStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_meta_creatives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_meta_ads" (
    "id" TEXT NOT NULL,
    "adset_id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PaidAdsEntityStatus" NOT NULL DEFAULT 'draft',
    "external_ad_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_meta_ads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_ads_meta_insights" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" BIGINT NOT NULL,
    "clicks" BIGINT NOT NULL,
    "spend_cents" BIGINT NOT NULL,
    "conversions" BIGINT NOT NULL,
    "ctr" DECIMAL(8,4) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_ads_meta_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "paid_ads_projects_user_id_idx" ON "paid_ads_projects"("user_id");
CREATE INDEX "paid_ads_campaigns_project_id_idx" ON "paid_ads_campaigns"("project_id");
CREATE INDEX "paid_ads_ad_groups_campaign_id_idx" ON "paid_ads_ad_groups"("campaign_id");
CREATE INDEX "paid_ads_keywords_ad_group_id_idx" ON "paid_ads_keywords"("ad_group_id");
CREATE INDEX "paid_ads_rsa_ad_group_id_idx" ON "paid_ads_rsa"("ad_group_id");
CREATE INDEX "paid_ads_change_requests_project_id_status_idx" ON "paid_ads_change_requests"("project_id", "status");
CREATE INDEX "paid_ads_ai_runs_project_id_created_at_idx" ON "paid_ads_ai_runs"("project_id", "created_at" DESC);
CREATE INDEX "paid_ads_meta_adsets_campaign_id_idx" ON "paid_ads_meta_adsets"("campaign_id");
CREATE INDEX "paid_ads_meta_creatives_adset_id_idx" ON "paid_ads_meta_creatives"("adset_id");
CREATE INDEX "paid_ads_meta_ads_adset_id_idx" ON "paid_ads_meta_ads"("adset_id");
CREATE INDEX "paid_ads_meta_insights_project_id_date_idx" ON "paid_ads_meta_insights"("project_id", "date" DESC);
CREATE UNIQUE INDEX "paid_ads_meta_insights_project_id_level_external_id_date_key" ON "paid_ads_meta_insights"("project_id", "level", "external_id", "date");

ALTER TABLE "paid_ads_projects" ADD CONSTRAINT "paid_ads_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_google_ads_connections" ADD CONSTRAINT "paid_ads_google_ads_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_meta_connections" ADD CONSTRAINT "paid_ads_meta_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_tiktok_connections" ADD CONSTRAINT "paid_ads_tiktok_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_campaigns" ADD CONSTRAINT "paid_ads_campaigns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_ad_groups" ADD CONSTRAINT "paid_ads_ad_groups_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "paid_ads_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_keywords" ADD CONSTRAINT "paid_ads_keywords_ad_group_id_fkey" FOREIGN KEY ("ad_group_id") REFERENCES "paid_ads_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_rsa" ADD CONSTRAINT "paid_ads_rsa_ad_group_id_fkey" FOREIGN KEY ("ad_group_id") REFERENCES "paid_ads_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_change_requests" ADD CONSTRAINT "paid_ads_change_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_change_requests" ADD CONSTRAINT "paid_ads_change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "paid_ads_change_requests" ADD CONSTRAINT "paid_ads_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paid_ads_guardrails" ADD CONSTRAINT "paid_ads_guardrails_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_ai_runs" ADD CONSTRAINT "paid_ads_ai_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_ai_runs" ADD CONSTRAINT "paid_ads_ai_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paid_ads_meta_adsets" ADD CONSTRAINT "paid_ads_meta_adsets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "paid_ads_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_meta_creatives" ADD CONSTRAINT "paid_ads_meta_creatives_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "paid_ads_meta_adsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_meta_ads" ADD CONSTRAINT "paid_ads_meta_ads_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "paid_ads_meta_adsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_meta_ads" ADD CONSTRAINT "paid_ads_meta_ads_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "paid_ads_meta_creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_ads_meta_insights" ADD CONSTRAINT "paid_ads_meta_insights_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
