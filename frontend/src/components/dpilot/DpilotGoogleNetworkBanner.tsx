/**
 * Faixa única quando a conta está ligada no Studio mas a API Google falha (token / MCC).
 * Não bloqueia a UI local — só orienta o media buyer.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { syncGoogleAdsFromIntegrations } from "@/lib/googleAdsSync";
import {
  friendlyGoogleAdsNetworkError,
  googleAdsNeedsReauth,
} from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";

export function DpilotGoogleNetworkBanner({ projectId }: { projectId: string }) {
  const { t, tx } = useAppLocale();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setChecking(true);
    const { data } = await paidAdsService.getGoogleAdsManagerOverview(projectId, { preset: "today" });
    setError(data?.connection_error ?? null);
    setChecking(false);
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  if (checking || !error) return null;

  const needsReauth = googleAdsNeedsReauth(error);
  const detail = needsReauth
    ? t("pages.dpilot.google.cm.bannerReauthDetail")
    : tx(friendlyGoogleAdsNetworkError(error) ?? error);

  const sync = async () => {
    setSyncing(true);
    const result = await syncGoogleAdsFromIntegrations(projectId);
    setSyncing(false);
    if (!result.ok) return;
    void load();
    window.location.reload();
  };

  return (
    <Alert className="mb-4 border-amber-300/80 bg-amber-50/90 text-amber-950 shadow-none" data-no-i18n>
      <AlertTriangle className="h-4 w-4 text-amber-700" />
      <AlertTitle className="text-amber-950">
        {needsReauth
          ? t("pages.dpilot.google.cm.bannerReauthTitle")
          : t("pages.dpilot.google.cm.bannerMismatchTitle")}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-amber-950/90">
        <p className="text-sm leading-relaxed">{detail}</p>
        <p className="text-xs text-amber-900/70">{t("pages.dpilot.google.cm.bannerHint")}</p>
        <div className="flex flex-wrap gap-2">
          {needsReauth ? (
            <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" asChild>
              <Link to="/integracoes/google-ads">{t("pages.dpilot.google.cm.bannerSwitchAccount")}</Link>
            </Button>
          ) : (
            <Button size="sm" disabled={syncing} onClick={() => void sync()}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("pages.dpilot.google.cm.bannerResync")}
            </Button>
          )}
          <Button size="sm" variant="outline" className="border-amber-300 bg-white/70" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
              {t("pages.dpilot.google.cm.bannerOpenCampaigns")}
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="border-amber-300 bg-white/70" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google`}>{t("pages.dpilot.google.cm.navSettings")}</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
