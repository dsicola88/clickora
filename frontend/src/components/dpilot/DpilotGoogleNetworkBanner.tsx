/**
 * Faixa única quando a conta está ligada no Studio mas a API Google falha (token / MCC).
 * Não bloqueia a UI local — só orienta o media buyer.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  friendlyGoogleAdsNetworkError,
  googleAdsNeedsReauth,
  toastGoogleAdsError,
} from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { toast } from "sonner";

export function DpilotGoogleNetworkBanner({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setChecking(true);
    const { data } = await paidAdsService.getGoogleAdsManagerOverview(projectId, { preset: "last_7" });
    setError(data?.connection_error ?? null);
    setChecking(false);
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  if (checking || !error) return null;

  const needsReauth = googleAdsNeedsReauth(error);
  const detail = friendlyGoogleAdsNetworkError(error) ?? error;

  const sync = async () => {
    setSyncing(true);
    const { data, error: err } = await paidAdsService.googleLinkFromIntegrations(projectId, {
      import_campaigns: true,
    });
    setSyncing(false);
    if (err || !data) {
      toast.error(toastGoogleAdsError(err));
      return;
    }
    const imp = data.import;
    toast.success(
      imp
        ? `Conta ${data.customer_id} · ${imp.imported} campanha(s) importada(s) da Google`
        : `Conta ${data.customer_id} sincronizada`,
    );
    void load();
    window.location.reload();
  };

  return (
    <Alert className="mb-4 border-amber-300/80 bg-amber-50/90 text-amber-950 shadow-none">
      <AlertTriangle className="h-4 w-4 text-amber-700" />
      <AlertTitle className="text-amber-950">
        {needsReauth ? "Ligar de novo a conta Google" : "Lista local ≠ conta Google"}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-amber-950/90">
        <p className="text-sm leading-relaxed">{detail}</p>
        <p className="text-xs text-amber-900/70">
          «Na Google» lista só campanhas importadas (com ID da rede). TonicGreens e similares sem ID são «Só neste
          projecto». Confirme em Integrações o mesmo customer ID de ads.google.com (ex. 160-828-0409) e use
          «Re-sincronizar e importar».
        </p>
        <div className="flex flex-wrap gap-2">
          {needsReauth ? (
            <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" asChild>
              <Link to="/integracoes/google-ads">Integrações → Mudar de conta</Link>
            </Button>
          ) : (
            <Button size="sm" disabled={syncing} onClick={() => void sync()}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Re-sincronizar e importar
            </Button>
          )}
          <Button size="sm" variant="outline" className="border-amber-300 bg-white/70" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Abrir Campanhas / importar</Link>
          </Button>
          <Button size="sm" variant="outline" className="border-amber-300 bg-white/70" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google`}>Configurações</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
