-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('admin', 'moderator', 'user');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('free_trial', 'monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "PresellStatus" AS ENUM ('draft', 'published', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('click', 'impression', 'conversion', 'lead', 'sale', 'pageview');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'expired', 'suspended');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'user',

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanType" NOT NULL,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "max_presell_pages" INTEGER,
    "max_clicks_per_month" INTEGER,
    "has_branding" BOOLEAN NOT NULL DEFAULT true,
    "features" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presell_pages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'cookies',
    "category" TEXT,
    "language" TEXT DEFAULT 'pt',
    "content" JSONB,
    "video_url" TEXT,
    "settings" JSONB,
    "tracking" JSONB,
    "status" "PresellStatus" NOT NULL DEFAULT 'draft',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presell_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postback_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "presell_page_id" TEXT,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postback_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "presell_page_id" TEXT,
    "event_type" "EventType" NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "referrer" TEXT,
    "country" TEXT,
    "device" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklisted_ips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklisted_ips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "presell_pages_user_id_idx" ON "presell_pages"("user_id");

-- CreateIndex
CREATE INDEX "presell_pages_status_idx" ON "presell_pages"("status");

-- CreateIndex
CREATE INDEX "presell_pages_user_id_status_idx" ON "presell_pages"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "presell_pages_user_id_slug_key" ON "presell_pages"("user_id", "slug");

-- CreateIndex
CREATE INDEX "postback_logs_user_id_created_at_idx" ON "postback_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "postback_logs_platform_created_at_idx" ON "postback_logs"("platform", "created_at");

-- CreateIndex
CREATE INDEX "tracking_events_user_id_idx" ON "tracking_events"("user_id");

-- CreateIndex
CREATE INDEX "tracking_events_presell_page_id_idx" ON "tracking_events"("presell_page_id");

-- CreateIndex
CREATE INDEX "tracking_events_event_type_idx" ON "tracking_events"("event_type");

-- CreateIndex
CREATE INDEX "tracking_events_created_at_idx" ON "tracking_events"("created_at");

-- CreateIndex
CREATE INDEX "tracking_events_user_id_event_type_created_at_idx" ON "tracking_events"("user_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "blacklisted_ips_user_id_idx" ON "blacklisted_ips"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "blacklisted_ips_user_id_ip_address_key" ON "blacklisted_ips"("user_id", "ip_address");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presell_pages" ADD CONSTRAINT "presell_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postback_logs" ADD CONSTRAINT "postback_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postback_logs" ADD CONSTRAINT "postback_logs_presell_page_id_fkey" FOREIGN KEY ("presell_page_id") REFERENCES "presell_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_presell_page_id_fkey" FOREIGN KEY ("presell_page_id") REFERENCES "presell_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
