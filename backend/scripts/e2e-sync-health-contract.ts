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

  const syncLib = readFileSync(join(root, "lib/syncHealth.ts"), "utf8");
  record(
    "syncHealth lib conta failed + skipped click-ids",
    syncLib.includes("google_ads_failed") &&
      syncLib.includes("google_ads_skipped_no_gclid") &&
      syncLib.includes("skipped_no_gclid") &&
      syncLib.includes("meta_capi_failed") &&
      syncLib.includes("meta_capi_skipped_no_fbclid") &&
      syncLib.includes("skipped_no_fbclid") &&
      syncLib.includes("tiktok_events_failed") &&
      syncLib.includes("tiktok_events_skipped_no_ttclid") &&
      syncLib.includes("skipped_no_ttclid"),
    "ok",
  );

  const banner = readFileSync(
    join(process.cwd(), "../frontend/src/components/SyncHealthBanner.tsx"),
    "utf8",
  );
  const ptMessages = readFileSync(
    join(process.cwd(), "../frontend/src/i18n/messages/pt.ts"),
    "utf8",
  );
  record(
    "SyncHealthBanner cobre fbclid/ttclid",
    banner.includes("meta_capi_skipped_no_fbclid") &&
      banner.includes("tiktok_events_skipped_no_ttclid") &&
      banner.includes("pages.syncHealth.metaNoId") &&
      banner.includes("pages.syncHealth.tiktokNoId") &&
      ptMessages.includes("metaNoId") &&
      ptMessages.includes("tiktokNoId") &&
      /sem ID da Meta|sem ID do TikTok/i.test(ptMessages),
    "ok",
  );

  const relatorios = readFileSync(
    join(process.cwd(), "../frontend/src/pages/Relatorios.tsx"),
    "utf8",
  );
  record(
    "Relatórios monta SyncHealthBanner + badge sem-gclid",
    relatorios.includes("SyncHealthBanner") &&
      relatorios.includes("sync_health") &&
      relatorios.includes("google_ads_skipped_no_gclid") &&
      relatorios.includes('value="sem-gclid"'),
    "ok",
  );

  const integrationsHub = readFileSync(
    join(process.cwd(), "../frontend/src/pages/IntegrationsHubPage.tsx"),
    "utf8",
  );
  record(
    "Integrações go-live cobre ads_upload + cost_sync + Meta/TikTok",
    integrationsHub.includes('id: "ads_upload"') &&
      integrationsHub.includes('id: "cost_sync"') &&
      integrationsHub.includes('id: "domain_https"') &&
      integrationsHub.includes('id: "meta_capi_configured"') &&
      integrationsHub.includes('id: "tiktok_events_configured"') &&
      integrationsHub.includes("conversion-sync/retry"),
    "ok",
  );
  record(
    "account_health inclui domain_https + ads_upload + Meta/TikTok + fila",
    health.includes('id: "domain_https"') &&
      health.includes("summarizeUserDomainGoLive") &&
      health.includes('id: "ads_upload"') &&
      health.includes('id: "meta_capi_configured"') &&
      health.includes('id: "tiktok_events_configured"') &&
      health.includes("loadSyncHealth") &&
      health.includes("loadSyncQueueHealth") &&
      health.includes("formatSyncHealthDetail") &&
      health.includes("evaluateCostSyncFreshness") &&
      health.includes("COST_SYNC_STALE_MS") &&
      health.includes("desactualizados"),
    "ok",
  );

  const reportHref = readFileSync(
    join(process.cwd(), "../frontend/src/lib/syncHealthReportHref.ts"),
    "utf8",
  );
  record(
    "SyncHealthBanner deep-link sem-gclid",
    reportHref.includes("/resultados/relatorios/sem-gclid") &&
      banner.includes("syncHealthReportHref"),
    "ok",
  );

  record(
    "dashboard + funil usam loadSyncHealth + sync_queue",
    analytics.includes("loadSyncHealth") &&
      analytics.includes("loadSyncQueueHealth") &&
      analytics.includes("sync_health") &&
      analytics.includes("sync_queue") &&
      analytics.includes("...funnel, sync_health"),
    "ok",
  );
  record(
    "fila sync tem loadSyncQueueHealth + retry dead",
    syncLib.includes("loadSyncQueueHealth") &&
      syncLib.includes("emptySyncQueueHealth") &&
      readFileSync(join(root, "lib/conversionSyncQueue.ts"), "utf8").includes(
        "retryDeadConversionSyncJobs",
      ),
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
