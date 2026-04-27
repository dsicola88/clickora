/**
 * Log estruturado para paid / APIs de anúncios (linha JSON por evento).
 */
export type PaidLogLevel = "info" | "warn" | "error";

export function paidLog(
  level: PaidLogLevel,
  event: string,
  context: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ns: "paid",
    level,
    event,
    ...context,
  });
  const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logFn.call(console, line);
}
