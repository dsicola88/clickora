import { systemPrisma } from "./prisma";

/** Alinha a BD com o schema quando migrações não foram aplicadas (ex.: Railway, drift). Idempotente. */
const PLAN_COLUMNS_SQL = [
  `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_label" VARCHAR(160)`,
] as const;

const PLANS_LANDING_COLUMNS_SQL = [
  `ALTER TABLE "plans_landing_config" ADD COLUMN IF NOT EXISTS "plan_display_labels" JSONB`,
] as const;

export async function repairPlanSchemaColumns(): Promise<void> {
  for (const sql of PLAN_COLUMNS_SQL) {
    await systemPrisma.$executeRawUnsafe(sql);
  }
  for (const sql of PLANS_LANDING_COLUMNS_SQL) {
    await systemPrisma.$executeRawUnsafe(sql);
  }
}
