import cron from "node-cron";

import {
  optimizerCronExpression,
  optimizerEnabled,
  optimizerIntervalMs,
  optimizerSkipOverlappingTicks,
} from "./config";
import { optimizerLog } from "./logger";
import { runPaidOptimizerTick } from "./optimizer.service";

let tickInFlight = false;

/**
 * Agenda o optimizer com node-cron.
 * Timezone: `PAID_OPTIMIZER_TZ` ou UTC.
 * Evita ticks sobrepostos quando `PAID_OPTIMIZER_SKIP_OVERLAP` não for `false`.
 */
export function registerPaidOptimizerScheduler(): cron.ScheduledTask | null {
  if (!optimizerEnabled()) return null;

  let expr = optimizerCronExpression();
  if (!cron.validate(expr)) {
    optimizerLog("warn", "cron_expression_invalid_fallback", { expr, fallback: "*/15 * * * *" });
    expr = "*/15 * * * *";
  }
  const tz = process.env.PAID_OPTIMIZER_TZ?.trim() || "UTC";

  const task = cron.schedule(
    expr,
    async () => {
      if (optimizerSkipOverlappingTicks() && tickInFlight) {
        optimizerLog("warn", "tick_skipped_overlap", { cron: expr, tz });
        return;
      }
      tickInFlight = true;
      try {
        const r = await runPaidOptimizerTick();
        console.log("[paid-optimizer]", JSON.stringify({ ...r, at: new Date().toISOString() }));
      } catch (e: unknown) {
        optimizerLog("error", "tick_unhandled", {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack?.slice(0, 1500) : undefined,
        });
        /* Alerta crítico já enviado em `optimizer.service` antes do throw (`tick_fatal`). */
      } finally {
        tickInFlight = false;
      }
    },
    { timezone: tz, name: "paid-optimizer" },
  );

  optimizerLog("info", "scheduler_registered", {
    cron: expr,
    tz,
    dryRunDefault: process.env.PAID_OPTIMIZER_DRY_RUN ?? "true",
    rulesEnv: process.env.PAID_OPTIMIZER_RULES ?? "(omit=pause_only)",
    skipOverlap: optimizerSkipOverlappingTicks(),
  });
  return task;
}

/** Alternativa ao cron — intervalo em ms (`PAID_OPTIMIZER_INTERVAL_MS`). */
export function schedulePaidOptimizerInterval(onTick: () => Promise<void>): ReturnType<typeof setInterval> {
  const ms = optimizerIntervalMs();
  return setInterval(() => {
    void onTick();
  }, ms);
}
