import { systemPrisma } from "./prisma";

/** Alinha a BD com o schema quando migrações não foram aplicadas (ex.: Railway, drift). Idempotente. */
const PLAN_COLUMNS_SQL = [
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_label" VARCHAR(160)`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_custom_domains" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "affiliate_webhook_enabled" BOOLEAN NOT NULL DEFAULT false`,
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

export async function repairPlanSchemaColumns(): Promise<void> {
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
}
