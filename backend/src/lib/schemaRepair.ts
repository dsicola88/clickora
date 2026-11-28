import { systemPrisma } from "./prisma";

/** Alinha a BD com o schema quando migrações não foram aplicadas (ex.: Railway, drift). Idempotente. */
const PLAN_COLUMNS_SQL = [
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_label" VARCHAR(160)`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_custom_domains" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_presell_ai_generations" INTEGER`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_workspace_members" INTEGER`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_traffic_rotators" INTEGER`,
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
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jvzoo_ipn_secret" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clickbank_ins_secret" TEXT`,
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
  try {
    await systemPrisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "keyword_researches" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "product" VARCHAR(200) NOT NULL,
  "language" VARCHAR(16) NOT NULL,
  "market" VARCHAR(8) NOT NULL,
  "market_name" VARCHAR(80) NOT NULL,
  "product_url" TEXT,
  "url_title" VARCHAR(240),
  "keywords" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "keyword_researches_pkey" PRIMARY KEY ("id")
)`);
    await systemPrisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "keyword_researches_user_id_created_at_idx" ON "keyword_researches"("user_id", "created_at")`,
    );
    await systemPrisma.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TABLE "keyword_researches"
    ADD CONSTRAINT "keyword_researches_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`);
  } catch (e) {
    console.warn("[schemaRepair] keyword_researches (ignorado):", e);
  }
  try {
    await systemPrisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "academy_lessons" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "provider" VARCHAR(16) NOT NULL,
  "source_url" TEXT NOT NULL,
  "video_id" VARCHAR(80) NOT NULL,
  "bunny_library_id" VARCHAR(16),
  "module_name" VARCHAR(80) NOT NULL DEFAULT 'Começar',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academy_lessons_pkey" PRIMARY KEY ("id")
)`);
    await systemPrisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "academy_lessons_published_module_name_sort_order_idx" ON "academy_lessons"("published", "module_name", "sort_order")`,
    );
  } catch (e) {
    console.warn("[schemaRepair] academy_lessons (ignorado):", e);
  }
  try {
    await systemPrisma.$executeRawUnsafe(`ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "bundle" JSONB`);
    await systemPrisma.$executeRawUnsafe(`ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(16)`);
    await systemPrisma.$executeRawUnsafe(`ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "objective" VARCHAR(24)`);
    await systemPrisma.$executeRawUnsafe(`ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "source" VARCHAR(24)`);
    await systemPrisma.$executeRawUnsafe(`ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "affiliate_platform" VARCHAR(24)`);
    await systemPrisma.$executeRawUnsafe(`ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "funnel" VARCHAR(16)`);
    await systemPrisma.$executeRawUnsafe(`ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "final_url" TEXT`);
    await systemPrisma.$executeRawUnsafe(
      `ALTER TABLE "keyword_researches" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
  } catch (e) {
    console.warn("[schemaRepair] keyword_researches bundle (ignorado):", e);
  }
  try {
    await systemPrisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "hotmart_webhook_receipts" (
  "event_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotmart_webhook_receipts_pkey" PRIMARY KEY ("event_key")
)`);
  } catch (e) {
    console.warn("[schemaRepair] hotmart_webhook_receipts (ignorado):", e);
  }
  await repairSmartDomainRoutingSchema();
}

async function repairSmartDomainRoutingSchema(): Promise<void> {
  const statements = [
    `DO $$ BEGIN CREATE TYPE "DomainRoutingRole" AS ENUM ('primary', 'backup', 'standby'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE "DomainHealthStatus" AS ENUM ('healthy', 'degraded', 'down', 'unknown'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE "OfferValidationStatus" AS ENUM ('unchecked', 'valid', 'warning', 'blocked'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE "DomainRoutingEventType" AS ENUM ('health_check_passed','health_check_degraded','health_check_failed','auto_failover','auto_recovery','manual_swap','manual_rollback','role_changed','domain_disabled','domain_enabled','offer_validated','offer_blocked','binding_updated'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "routing_role" "DomainRoutingRole" NOT NULL DEFAULT 'standby'`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "health_status" "DomainHealthStatus" NOT NULL DEFAULT 'unknown'`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "last_health_check_at" TIMESTAMP(3)`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "last_health_error" VARCHAR(500)`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "last_http_status" INTEGER`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "consecutive_failures" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "auto_recover" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "disabled_reason" VARCHAR(240)`,
    `ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "routing_priority" INTEGER NOT NULL DEFAULT 100`,
    `CREATE INDEX IF NOT EXISTS "custom_domains_user_id_is_active_health_status_idx" ON "custom_domains"("user_id", "is_active", "health_status")`,
    `CREATE TABLE IF NOT EXISTS "offers" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "name" VARCHAR(200) NOT NULL, "network" VARCHAR(64), "hoplink_url" TEXT NOT NULL, "backup_hoplink_url" TEXT, "validation_status" "OfferValidationStatus" NOT NULL DEFAULT 'unchecked', "compliance_passed" BOOLEAN NOT NULL DEFAULT false, "last_validated_at" TIMESTAMP(3), "last_validation_error" VARCHAR(500), "resolved_final_host" VARCHAR(255), "is_active" BOOLEAN NOT NULL DEFAULT true, "metadata" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "offers_pkey" PRIMARY KEY ("id"))`,
    `CREATE INDEX IF NOT EXISTS "offers_user_id_is_active_idx" ON "offers"("user_id", "is_active")`,
    `CREATE INDEX IF NOT EXISTS "offers_user_id_created_at_idx" ON "offers"("user_id", "created_at")`,
    `ALTER TABLE "presell_pages" ADD COLUMN IF NOT EXISTS "offer_id" TEXT`,
    `CREATE INDEX IF NOT EXISTS "presell_pages_offer_id_idx" ON "presell_pages"("offer_id")`,
    `ALTER TABLE "affiliate_campaigns" ADD COLUMN IF NOT EXISTS "offer_id" TEXT`,
    `CREATE INDEX IF NOT EXISTS "affiliate_campaigns_offer_id_idx" ON "affiliate_campaigns"("offer_id")`,
    `CREATE TABLE IF NOT EXISTS "presell_domain_bindings" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "presell_id" TEXT NOT NULL, "custom_domain_id" TEXT NOT NULL, "role" "DomainRoutingRole" NOT NULL DEFAULT 'backup', "priority" INTEGER NOT NULL DEFAULT 100, "is_active" BOOLEAN NOT NULL DEFAULT true, "last_used_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "presell_domain_bindings_pkey" PRIMARY KEY ("id"))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "presell_domain_bindings_presell_id_custom_domain_id_key" ON "presell_domain_bindings"("presell_id", "custom_domain_id")`,
    `CREATE INDEX IF NOT EXISTS "presell_domain_bindings_user_id_presell_id_is_active_idx" ON "presell_domain_bindings"("user_id", "presell_id", "is_active")`,
    `CREATE INDEX IF NOT EXISTS "presell_domain_bindings_custom_domain_id_idx" ON "presell_domain_bindings"("custom_domain_id")`,
    `CREATE TABLE IF NOT EXISTS "offer_domain_bindings" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "offer_id" TEXT NOT NULL, "custom_domain_id" TEXT NOT NULL, "role" "DomainRoutingRole" NOT NULL DEFAULT 'backup', "priority" INTEGER NOT NULL DEFAULT 100, "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "offer_domain_bindings_pkey" PRIMARY KEY ("id"))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "offer_domain_bindings_offer_id_custom_domain_id_key" ON "offer_domain_bindings"("offer_id", "custom_domain_id")`,
    `CREATE INDEX IF NOT EXISTS "offer_domain_bindings_user_id_offer_id_is_active_idx" ON "offer_domain_bindings"("user_id", "offer_id", "is_active")`,
    `CREATE INDEX IF NOT EXISTS "offer_domain_bindings_custom_domain_id_idx" ON "offer_domain_bindings"("custom_domain_id")`,
    `CREATE TABLE IF NOT EXISTS "domain_routing_events" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "event_type" "DomainRoutingEventType" NOT NULL, "scope" VARCHAR(32) NOT NULL DEFAULT 'domain', "custom_domain_id" TEXT, "previous_domain_id" TEXT, "target_domain_id" TEXT, "presell_id" TEXT, "offer_id" TEXT, "actor_user_id" TEXT, "reason" VARCHAR(500), "metadata" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "domain_routing_events_pkey" PRIMARY KEY ("id"))`,
    `CREATE INDEX IF NOT EXISTS "domain_routing_events_user_id_created_at_idx" ON "domain_routing_events"("user_id", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "domain_routing_events_custom_domain_id_created_at_idx" ON "domain_routing_events"("custom_domain_id", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "domain_routing_events_presell_id_created_at_idx" ON "domain_routing_events"("presell_id", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "domain_routing_events_offer_id_created_at_idx" ON "domain_routing_events"("offer_id", "created_at")`,
  ];
  for (const sql of statements) {
    try {
      await systemPrisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[schemaRepair] smartDomainRouting (ignorado):", e);
    }
  }
}
