/**
 * Contrato sync_health + domain_https (alinhado FE SyncHealthBanner / Integrações).
 *
 *   cd backend && npx tsx scripts/e2e-sync-health-contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function main() {
  const root = join(process.cwd(), "src");
  const analytics = readFileSync(join(root, "controllers/analytics.controller.ts"), "utf8");
  const health = readFileSync(join(root, "lib/accountHealth.ts"), "utf8");
  const onboarding = readFileSync(join(root, "controllers/onboarding.controller.ts"), "utf8");
  const customCtrl = readFileSync(join(root, "controllers/customDomain.controller.ts"), "utf8");

  record(
    "getDashboard emite sync_health (failed + skipped_no_gclid)",
    analytics.includes("sync_health") &&
      analytics.includes("google_ads_failed") &&
      analytics.includes("google_ads_skipped_no_gclid") &&
      analytics.includes("skipped_no_gclid") &&
      analytics.includes("meta_capi_failed") &&
      analytics.includes("tiktok_events_failed"),
    "ok",
  );
  record(
    "account_health inclui domain_https",
    health.includes('id: "domain_https"') && health.includes("summarizeUserDomainGoLive"),
    "ok",
  );
  record(
    "onboarding step domain_https",
    onboarding.includes('id: "domain_https"') && onboarding.includes("ad_ready_hosting"),
    "ok",
  );
  record(
    "mapRow não usa Array.map(mapRow) cru",
    !customCtrl.includes(".map(mapRow)") && customCtrl.includes("map((r) => mapRow(r))"),
    "ok",
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main();
