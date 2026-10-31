import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { syncHealthReportHref, syncHealthReportLabel } from "@/lib/syncHealthReportHref";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

export type SyncHealthPayload = {
  period_days: number;
  google_ads_failed: number;
  google_ads_skipped_no_gclid?: number;
  meta_capi_failed: number;
  meta_capi_skipped_no_fbclid?: number;
  tiktok_events_failed?: number;
  tiktok_events_skipped_no_ttclid?: number;
};

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

/**
 * Falhas de upload Google/Meta/TikTok — partilhado entre Tracking, Resultados e Integrações.
 */
export function SyncHealthBanner({
  syncHealth,
  className,
}: {
  syncHealth?: SyncHealthPayload | null;
  className?: string;
}) {
  const { t } = useAppLocale();
  if (!syncHealth) return null;
  const tt = syncHealth.tiktok_events_failed ?? 0;
  const noGclid = syncHealth.google_ads_skipped_no_gclid ?? 0;
  const noFbclid = syncHealth.meta_capi_skipped_no_fbclid ?? 0;
  const noTtclid = syncHealth.tiktok_events_skipped_no_ttclid ?? 0;
  const total =
    syncHealth.google_ads_failed +
    syncHealth.meta_capi_failed +
    tt +
    noGclid +
    noFbclid +
    noTtclid;
  if (total <= 0) return null;
  const parts: string[] = [];
  if (syncHealth.google_ads_failed > 0) {
    parts.push(fill(t("pages.syncHealth.googleFail"), { n: syncHealth.google_ads_failed }));
  }
  if (noGclid > 0) {
    parts.push(fill(t("pages.syncHealth.googleNoId"), { n: noGclid }));
  }
  if (syncHealth.meta_capi_failed > 0) {
    parts.push(fill(t("pages.syncHealth.metaFail"), { n: syncHealth.meta_capi_failed }));
  }
  if (noFbclid > 0) {
    parts.push(fill(t("pages.syncHealth.metaNoId"), { n: noFbclid }));
  }
  if (tt > 0) {
    parts.push(fill(t("pages.syncHealth.tiktokFail"), { n: tt }));
  }
  if (noTtclid > 0) {
    parts.push(fill(t("pages.syncHealth.tiktokNoId"), { n: noTtclid }));
  }
  const reportHref = syncHealthReportHref(syncHealth);
  return (
    <Alert className={`border-amber-500/35 bg-amber-500/[0.07] text-foreground ${className ?? ""}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-950 dark:text-amber-100">
        {t("pages.syncHealth.title")}
      </AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        {fill(t("pages.syncHealth.intro"), {
          days: syncHealth.period_days,
          parts: parts.join(" · "),
        })}
        <Link className="font-medium text-primary underline underline-offset-2" to={reportHref}>
          {syncHealthReportLabel(reportHref)}
        </Link>
        {t("pages.syncHealth.outro")}
      </AlertDescription>
    </Alert>
  );
}
