/**
 * Contrato Automizer ↔ account_health cost freshness.
 *
 *   cd backend && npx tsx scripts/e2e-automizer-cost-freshness.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function main() {
  const ctrl = readFileSync(join(process.cwd(), "src/controllers/integrations.controller.ts"), "utf8");
  const page = readFileSync(
    join(process.cwd(), "../frontend/src/pages/AffiliateAutomizerPage.tsx"),
    "utf8",
  );
  const svc = readFileSync(
    join(process.cwd(), "../frontend/src/services/integrationsService.ts"),
    "utf8",
  );
  const health = readFileSync(join(process.cwd(), "src/lib/accountHealth.ts"), "utf8");

  record(
    "GET affiliate-automizer emite last_cost_sync_at + freshness",
    ctrl.includes("last_cost_sync_at") &&
      ctrl.includes("cost_sync_stale") &&
      ctrl.includes("evaluateCostSyncFreshness") &&
      ctrl.includes("google_ads_ready"),
    "ok",
  );
  record(
    "FE tipos + UI avisam stale / modo real",
    svc.includes("last_cost_sync_at") &&
      svc.includes("cost_sync_stale") &&
      page.includes("cost_sync_stale") &&
      page.includes("Modo real activo") &&
      page.includes("Custos desactualizados"),
    "ok",
  );
  record(
    "accountHealth exporta evaluateCostSyncFreshness",
    health.includes("export function evaluateCostSyncFreshness") &&
      health.includes("COST_SYNC_STALE_MS"),
    "ok",
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main();
