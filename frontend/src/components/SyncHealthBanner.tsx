import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type SyncHealthPayload = {
  period_days: number;
  google_ads_failed: number;
  meta_capi_failed: number;
  tiktok_events_failed?: number;
};

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
  if (!syncHealth) return null;
  const tt = syncHealth.tiktok_events_failed ?? 0;
  const total = syncHealth.google_ads_failed + syncHealth.meta_capi_failed + tt;
  if (total <= 0) return null;
  const parts: string[] = [];
  if (syncHealth.google_ads_failed > 0) {
    parts.push(`${syncHealth.google_ads_failed} conversão(ões) com falha no Google Ads`);
  }
  if (syncHealth.meta_capi_failed > 0) {
    parts.push(`${syncHealth.meta_capi_failed} conversão(ões) com falha na Meta CAPI`);
  }
  if (tt > 0) {
    parts.push(`${tt} conversão(ões) com falha no TikTok Events API`);
  }
  return (
    <Alert className={`border-amber-500/35 bg-amber-500/[0.07] text-foreground ${className ?? ""}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-950 dark:text-amber-100">Atenção: envios para plataformas de anúncios</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        Últimos {syncHealth.period_days}d (UTC): {parts.join(" · ")}. Detalhes em{" "}
        <Link className="font-medium text-primary underline underline-offset-2" to="/resultados/relatorios/conversoes">
          Relatórios → Conversões
        </Link>
        {" — "}revise tokens/IDs em Integrações.
      </AlertDescription>
    </Alert>
  );
}
