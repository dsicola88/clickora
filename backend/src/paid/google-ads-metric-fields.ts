/**
 * Campos de metrics da Google Ads REST JSON (camelCase) vs GAQL snake.
 * Sem inventar: se o campo não veio, devolve 0 só como ausência de valor numérico.
 */
export function metricNum(met: Record<string, unknown> | null | undefined, ...keys: string[]): number {
  if (!met) return 0;
  for (const k of keys) {
    if (met[k] == null || met[k] === "") continue;
    const n = Number(met[k]);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Lê o objecto metrics de uma linha search (camel ou snake). */
export function rowMetrics(row: Record<string, unknown>): Record<string, unknown> {
  const m = row.metrics ?? row.Metrics;
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

export function parseGoogleAdsMetrics(row: Record<string, unknown>) {
  const met = rowMetrics(row);
  return {
    impressions: metricNum(met, "impressions"),
    clicks: metricNum(met, "clicks"),
    cost_micros: metricNum(met, "costMicros", "cost_micros"),
    conversions: metricNum(met, "conversions"),
    conversions_value: metricNum(met, "conversionsValue", "conversions_value"),
  };
}
