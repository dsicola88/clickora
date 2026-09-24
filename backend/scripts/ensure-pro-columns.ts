/**
 * Aplica colunas/tabelas pro com ADD IF NOT EXISTS — antes do seed / se migrate estiver bloqueado.
 * Uso: npx tsx scripts/ensure-pro-columns.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SQLS = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block_proxy_clicks" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_dry_run" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_min_spend_usd" DECIMAL(14,4) NOT NULL DEFAULT 15`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_min_clicks" INTEGER NOT NULL DEFAULT 20`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keyword_automizer_lookback_days" INTEGER NOT NULL DEFAULT 3`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_ads_account_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_advertiser_id" TEXT`,
  `CREATE TABLE IF NOT EXISTS "ad_platform_cost_daily" (
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
  )`,
  `CREATE TABLE IF NOT EXISTS "affiliate_automizer_logs" (
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
  )`,
];

async function main() {
  for (const sql of SQLS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("[ensure-pro-columns] OK:", sql.slice(0, 72).replace(/\s+/g, " "), "…");
    } catch (e) {
      console.warn("[ensure-pro-columns] skip:", e instanceof Error ? e.message : e);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(0); // nunca bloqueia o arranque
  });
