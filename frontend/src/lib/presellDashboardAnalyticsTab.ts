/** Query na lista de presells: métricas em separado por aba. */
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

/** Primeira aba quando não há `aba` na URL (só a lista, sem métricas). */
export const PRESELL_DASH_DEFAULT_ANALYTICS_TAB: PresellDashAnalyticsTab = "rastreamento";
