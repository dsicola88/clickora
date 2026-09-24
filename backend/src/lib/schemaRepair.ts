import { systemPrisma } from "./prisma";

/** Alinha a BD com o schema quando migrações não foram aplicadas (ex.: Railway, drift). Idempotente. */
const PLAN_COLUMNS_SQL = [
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_label" VARCHAR(160)`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_custom_domains" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "affiliate_webhook_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "dpilot_ads_enabled" BOOLEAN NOT NULL DEFAULT false`,
] as const;

const PLANS_LANDING_COLUMNS_SQL = [
  `ALTER TABLE "plans_landing_config" ADD COLUMN IF NOT EXISTS "plan_display_labels" JSONB`,
  `ALTER TABLE "plans_landing_config" ADD COLUMN IF NOT EXISTS "hero_visual" JSONB`,
  `ALTER TABLE "plans_landing_config" ADD COLUMN IF NOT EXISTS "landing_extras" JSONB`,
] as const;

/** Migração Meta CAPI em `conversions` — idempotente se migrate deploy ainda não passou. */
const CONVERSIONS_META_CAPI_SQL = [
  `ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "meta_capi_sync" TEXT`,
  `ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "meta_capi_synced_at" TIMESTAMP(3)`,
  `ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "meta_capi_sync_detail" JSONB`,
] as const;

const USERS_TIKTOK_EVENTS_SQL = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_pixel_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_access_token" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_test_event_code" TEXT`,
] as const;

const CONVERSIONS_TIKTOK_EVENTS_SQL = [
  `ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "tiktok_events_sync" TEXT`,
  `ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "tiktok_events_synced_at" TIMESTAMP(3)`,
  `ALTER TABLE "conversions" ADD COLUMN IF NOT EXISTS "tiktok_events_sync_detail" JSONB`,
] as const;

/** Colunas/tabelas pro (20260924*) — idempotente se migrate deploy ainda não passou. */
const USERS_PRO_AFFILIATE_SQL = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block_proxy_clicks" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_dry_run" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_min_spend_usd" DECIMAL(14,4) NOT NULL DEFAULT 15`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_min_clicks" INTEGER NOT NULL DEFAULT 20`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_lookback_days" INTEGER NOT NULL DEFAULT 3`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_ads_account_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_advertiser_id" TEXT`,
] as const;

const AD_PLATFORM_COST_DAILY_SQL = `
CREATE TABLE IF NOT EXISTS "ad_platform_cost_daily" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "platform" VARCHAR(32) NOT NULL,
  "date" DATE NOT NULL,
  "level" VARCHAR(32) NOT NULL,
  "entity_key" VARCHAR(512) NOT NULL,
  "label" VARCHAR(512),
  "cost_micros" BIGINT NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "currency" VARCHAR(8) DEFAULT 'USD',
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_platform_cost_daily_pkey" PRIMARY KEY ("id")
)`;

const AFFILIATE_AUTOMIZER_LOGS_SQL = `
CREATE TABLE IF NOT EXISTS "affiliate_automizer_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "keyword" VARCHAR(512) NOT NULL,
  "reason" TEXT,
  "dry_run" BOOLEAN NOT NULL DEFAULT true,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "detail" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_automizer_logs_pkey" PRIMARY KEY ("id")
)`;

export async function repairPlanSchemaColumns(): Promise<void> {
  try {
    await systemPrisma.$connect();
  } catch {
    console.warn("[schemaRepair] omitido — base de dados indisponível.");
    return;
  }

  for (const sql of PLAN_COLUMNS_SQL) {
    try {
      await systemPrisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[schemaRepair] plans (ignorado, usa fallback P2022 se necessário):", e);
    }
  }
  for (const sql of PLANS_LANDING_COLUMNS_SQL) {
    try {
      await systemPrisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[schemaRepair] plans_landing_config (ignorado):", e);
    }
  }
  for (const sql of CONVERSIONS_META_CAPI_SQL) {
    try {
      await systemPrisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[schemaRepair] conversions meta_capi (ignorado):", e);
    }
  }
  for (const sql of USERS_TIKTOK_EVENTS_SQL) {
    try {
      await systemPrisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[schemaRepair] users tiktok_events (ignorado):", e);
    }
  }
  for (const sql of CONVERSIONS_TIKTOK_EVENTS_SQL) {
    try {
      await systemPrisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[schemaRepair] conversions tiktok_events (ignorado):", e);
    }
  }
  for (const sql of USERS_PRO_AFFILIATE_SQL) {
    try {
      await systemPrisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[schemaRepair] users pro affiliate (ignorado):", e);
    }
  }
  try {
    await systemPrisma.$executeRawUnsafe(AD_PLATFORM_COST_DAILY_SQL);
    await systemPrisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ad_platform_cost_daily_user_id_platform_date_level_entity_key_key" ON "ad_platform_cost_daily"("user_id", "platform", "date", "level", "entity_key")`,
    );
    await systemPrisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ad_platform_cost_daily_user_id_platform_date_idx" ON "ad_platform_cost_daily"("user_id", "platform", "date")`,
    );
  } catch (e) {
    console.warn("[schemaRepair] ad_platform_cost_daily (ignorado):", e);
  }
  try {
    await systemPrisma.$executeRawUnsafe(AFFILIATE_AUTOMIZER_LOGS_SQL);
    await systemPrisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "affiliate_automizer_logs_user_id_created_at_idx" ON "affiliate_automizer_logs"("user_id", "created_at")`,
    );
  } catch (e) {
    console.warn("[schemaRepair] affiliate_automizer_logs (ignorado):", e);
  }
  try {
    await systemPrisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "conversions_user_id_status_idx" ON "conversions"("user_id", "status")`,
    );
  } catch (e) {
    console.warn("[schemaRepair] conversions status index (ignorado):", e);
  }
}
