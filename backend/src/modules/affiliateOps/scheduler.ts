import cron from "node-cron";
import { syncAdCostsForAllUsers } from "./costSync.service";
import { runKeywordAutomizerForAllUsers } from "./keywordAutomizer.service";

/**
 * Jobs afiliado pro: sync de custos (hora) + Automizer keywords (15 min).
 * Independente do paid-optimizer Dpilot.
 */
export function registerAffiliateOpsScheduler(): void {
  const costCron = process.env.AFFILIATE_COST_SYNC_CRON?.trim() || "15 * * * *";
  const autoCron = process.env.AFFILIATE_AUTOMIZER_CRON?.trim() || "*/20 * * * *";
  const tz = process.env.AFFILIATE_OPS_TZ?.trim() || "UTC";

  if (cron.validate(costCron)) {
    cron.schedule(
      costCron,
      async () => {
        try {
          const r = await syncAdCostsForAllUsers(7);
          console.log("[affiliate-ops] cost_sync", JSON.stringify({ ...r, at: new Date().toISOString() }));
        } catch (e) {
          console.error("[affiliate-ops] cost_sync_error", e instanceof Error ? e.message : e);
        }
      },
      { timezone: tz, name: "affiliate-cost-sync" },
    );
    console.info(`[affiliate-ops] cost sync cron «${costCron}» (${tz})`);
  }

  if (cron.validate(autoCron)) {
    cron.schedule(
      autoCron,
      async () => {
        try {
          const r = await runKeywordAutomizerForAllUsers();
          console.log("[affiliate-ops] keyword_automizer", JSON.stringify({ ...r, at: new Date().toISOString() }));
        } catch (e) {
          console.error("[affiliate-ops] automizer_error", e instanceof Error ? e.message : e);
        }
      },
      { timezone: tz, name: "affiliate-keyword-automizer" },
    );
    console.info(`[affiliate-ops] keyword automizer cron «${autoCron}» (${tz})`);
  }
}
