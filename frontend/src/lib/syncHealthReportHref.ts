import type { SyncHealthPayload } from "@/components/SyncHealthBanner";

/**
 * Destino do deep-link do SyncHealthBanner.
 * Só «Sem ID Google» quando o problema dominante é skipped_no_gclid (sem falhas API).
 */
export function syncHealthReportHref(sh: SyncHealthPayload): string {
  const noGclid = sh.google_ads_skipped_no_gclid ?? 0;
  const apiFails =
    sh.google_ads_failed +
    sh.meta_capi_failed +
    (sh.tiktok_events_failed ?? 0);
  const otherSkips =
    (sh.meta_capi_skipped_no_fbclid ?? 0) + (sh.tiktok_events_skipped_no_ttclid ?? 0);
  if (noGclid > 0 && apiFails === 0 && otherSkips === 0) {
    return "/resultados/relatorios/sem-gclid";
  }
  return "/resultados/relatorios/conversoes";
}

export function syncHealthReportLabel(href: string): string {
  return href.endsWith("/sem-gclid")
    ? "Relatórios → Sem ID Google"
    : "Relatórios → Conversões";
}
