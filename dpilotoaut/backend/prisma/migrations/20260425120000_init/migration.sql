-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('owner', 'admin', 'member', 'viewer');

-- CreateEnum
CREATE TYPE "ProjectPaidMode" AS ENUM ('copilot', 'autopilot');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('disconnected', 'connected', 'error');

-- CreateEnum
CREATE TYPE "PaidPlatform" AS ENUM ('google_ads', 'meta_ads', 'tiktok_ads');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'pending_publish', 'live', 'paused', 'archived', 'error');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('draft', 'pending_publish', 'live', 'paused', 'archived', 'error');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('exact', 'phrase', 'broad');

-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('create_campaign', 'update_budget', 'add_keywords', 'publish_rsa', 'pause_entity', 'meta_create_campaign', 'meta_update_budget', 'meta_publish_creative', 'meta_pause_entity', 'tiktok_create_campaign', 'tiktok_update_budget', 'tiktok_pause_entity');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'applied', 'failed');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('keyword_plan', 'rsa_generation', 'campaign_plan');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('pending', 'success', 'error');

-- CreateEnum
CREATE TYPE "MetaCta" AS ENUM ('learn_more', 'shop_now', 'sign_up', 'contact_us', 'book_now', 'download', 'get_quote', 'subscribe');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website_url" TEXT,
    "paid_mode" "ProjectPaidMode" NOT NULL DEFAULT 'copilot',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ads_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "google_customer_id" TEXT,
    "account_name" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "token_ref" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "ad_account_id" TEXT,
    "business_id" TEXT,
    "account_name" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "token_ref" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "advertiser_id" TEXT,
    "account_name" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "token_ref" TEXT,
    "refresh_token_ref" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_campaigns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "platform" "PaidPlatform" NOT NULL DEFAULT 'google_ads',
    "external_campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "objective_summary" TEXT,
    "daily_budget_micros" BIGINT,
    "geo_targets" JSONB NOT NULL DEFAULT '[]',
    "language_targets" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_ad_groups" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "external_ad_group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ad_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_keywords" (
    "id" UUID NOT NULL,
    "ad_group_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "match_type" "MatchType" NOT NULL DEFAULT 'phrase',
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "external_criterion_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_ads_rsa" (
    "id" UUID NOT NULL,
    "ad_group_id" UUID NOT NULL,
    "headlines" JSONB NOT NULL DEFAULT '[]',
    "descriptions" JSONB NOT NULL DEFAULT '[]',
    "final_urls" JSONB NOT NULL DEFAULT '[]',
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "external_ad_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_ads_rsa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_change_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "type" "ChangeRequestType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_by" UUID NOT NULL,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_guardrails" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "max_daily_budget_micros" BIGINT NOT NULL DEFAULT 50000000,
    "max_monthly_spend_micros" BIGINT NOT NULL DEFAULT 1500000000,
    "max_cpc_micros" BIGINT,
    "allowed_countries" TEXT[] DEFAULT ARRAY['US']::TEXT[],
    "blocked_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "require_approval_above_micros" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_guardrails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL DEFAULT 'v1',
    "input_summary" TEXT,
    "output_summary" TEXT,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "estimated_cost_usd" DECIMAL(10,6),
    "status" "AiRunStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_adsets" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "daily_budget_cents" BIGINT,
    "optimization_goal" TEXT,
    "targeting" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_adsets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_creatives" (
    "id" UUID NOT NULL,
    "adset_id" UUID NOT NULL,
    "external_id" TEXT,
    "primary_text" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta" "MetaCta" NOT NULL DEFAULT 'learn_more',
    "destination_url" TEXT NOT NULL,
    "image_asset_ref" TEXT,
    "placements" JSONB NOT NULL DEFAULT '[]',
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ads" (
    "id" UUID NOT NULL,
    "adset_id" UUID NOT NULL,
    "creative_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "external_ad_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_insights" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,
    "spend_cents" BIGINT NOT NULL DEFAULT 0,
    "conversions" BIGINT NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "google_ads_connections_project_id_key" ON "google_ads_connections"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_connections_project_id_key" ON "meta_connections"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_connections_project_id_key" ON "tiktok_connections"("project_id");

-- CreateIndex
CREATE INDEX "paid_campaigns_project_id_idx" ON "paid_campaigns"("project_id");

-- CreateIndex
CREATE INDEX "paid_ad_groups_campaign_id_idx" ON "paid_ad_groups"("campaign_id");

-- CreateIndex
CREATE INDEX "paid_keywords_ad_group_id_idx" ON "paid_keywords"("ad_group_id");

-- CreateIndex
CREATE INDEX "paid_ads_rsa_ad_group_id_idx" ON "paid_ads_rsa"("ad_group_id");

-- CreateIndex
CREATE INDEX "paid_change_requests_project_id_status_idx" ON "paid_change_requests"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "paid_guardrails_project_id_key" ON "paid_guardrails"("project_id");

-- CreateIndex
CREATE INDEX "ai_runs_project_id_created_at_idx" ON "ai_runs"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "meta_adsets_campaign_id_idx" ON "meta_adsets"("campaign_id");

-- CreateIndex
CREATE INDEX "meta_creatives_adset_id_idx" ON "meta_creatives"("adset_id");

-- CreateIndex
CREATE INDEX "meta_ads_adset_id_idx" ON "meta_ads"("adset_id");

-- CreateIndex
CREATE INDEX "meta_insights_project_id_date_idx" ON "meta_insights"("project_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "meta_insights_project_id_level_external_id_date_key" ON "meta_insights"("project_id", "level", "external_id", "date");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_connections" ADD CONSTRAINT "google_ads_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_connections" ADD CONSTRAINT "google_ads_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_connections" ADD CONSTRAINT "tiktok_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_connections" ADD CONSTRAINT "tiktok_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_campaigns" ADD CONSTRAINT "paid_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_campaigns" ADD CONSTRAINT "paid_campaigns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_ad_groups" ADD CONSTRAINT "paid_ad_groups_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "paid_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_keywords" ADD CONSTRAINT "paid_keywords_ad_group_id_fkey" FOREIGN KEY ("ad_group_id") REFERENCES "paid_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_ads_rsa" ADD CONSTRAINT "paid_ads_rsa_ad_group_id_fkey" FOREIGN KEY ("ad_group_id") REFERENCES "paid_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_change_requests" ADD CONSTRAINT "paid_change_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_change_requests" ADD CONSTRAINT "paid_change_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_change_requests" ADD CONSTRAINT "paid_change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_change_requests" ADD CONSTRAINT "paid_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paid_guardrails" ADD CONSTRAINT "paid_guardrails_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_adsets" ADD CONSTRAINT "meta_adsets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "paid_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_creatives" ADD CONSTRAINT "meta_creatives_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "meta_adsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "meta_adsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "meta_creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_insights" ADD CONSTRAINT "meta_insights_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
