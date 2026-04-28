/**
 * Logging operacional do Paid Optimizer — JSON por linha (Datadog / CloudWatch / Railway).
 */
import type { PaidLogLevel } from "../../lib/paidLog";

export function optimizerLog(
  level: PaidLogLevel,
  event: string,
  context: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ns: "paid.optimizer",
    level,
    event,
    ...context,
  });
  const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logFn.call(console, line);
}
