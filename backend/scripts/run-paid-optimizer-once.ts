/**
 * Execução única do Paid Ads Optimizer (útil para logs ou CI).
 * Requer PAID_OPTIMIZER_ENABLED=true e variáveis de BD (.env).
 *
 * Ex.: PAID_OPTIMIZER_ENABLED=true PAID_OPTIMIZER_DRY_RUN=true npx tsx scripts/run-paid-optimizer-once.ts
 */
import "dotenv/config";

import { runPaidOptimizerTick } from "../src/paid/optimizer/optimizer.service";

void runPaidOptimizerTick()
  .then((r) => {
    console.log(JSON.stringify({ ok: true, ...r }, null, 2));
    process.exit(0);
  })
  .catch((e: unknown) => {
    console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    process.exit(1);
  });
