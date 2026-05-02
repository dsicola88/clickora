/** Query no dashboard de páginas: métricas em abas separadas. */
export const PRESELL_DASH_ANALYTICS_TAB_PARAM = "aba" as const;

export type PresellDashAnalyticsTab = "rastreamento" | "pais";

export function presellDashboardAnalyticsHref(tab: PresellDashAnalyticsTab): string {
  return `/presell/dashboard?${PRESELL_DASH_ANALYTICS_TAB_PARAM}=${tab}`;
}

export function parsePresellDashAnalyticsTab(search: string): PresellDashAnalyticsTab | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const v = new URLSearchParams(q).get(PRESELL_DASH_ANALYTICS_TAB_PARAM);
  if (v === "rastreamento" || v === "pais") return v;
  return null;
}
