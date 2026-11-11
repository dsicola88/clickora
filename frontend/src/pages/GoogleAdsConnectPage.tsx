import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { integrationsService } from "@/services/integrationsService";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProPanel,
  ProStatusDot,
  ProAlert,
  ProInlineLink,
} from "@/components/enterprise/ProShell";

/**
 * Ligação Google Ads one-click: OAuth → conta + ação GCLID + upload + sync custos.
 */
export default function GoogleAdsConnectPage() {
  const { t } = useAppLocale();
  const { user } = useAuth();
  const locked = !userCanWriteIntegrations(user);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [customerDraft, setCustomerDraft] = useState("");
  const [mccDraft, setMccDraft] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["integrations", "google-ads"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getGoogleAdsSettings();
      if (error) throw new Error(error);
      return data!;
    },
  });

  useEffect(() => {
    if (!data) return;
    setCustomerDraft(data.google_ads_customer_id || "");
    setMccDraft(data.google_ads_login_customer_id || "");
  }, [data]);

  useEffect(() => {
    const st = params.get("google_ads_oauth");
    if (!st) return;
    if (st === "success") {
      const boot = params.get("boot");
      if (boot === "ok") {
        toast.success(t("pages.googleAds.oauthReady"));
      } else if (boot === "partial") {
        toast.message(params.get("boot_detail") || t("pages.googleAds.oauthPartialFallback"));
      } else if (boot === "error") {
        toast.error(params.get("boot_detail") || t("pages.googleAds.oauthBootFail"));
      } else {
        toast.message(t("pages.googleAds.oauthConfirming"));
      }
      void qc.invalidateQueries({ queryKey: ["integrations", "google-ads"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } else if (st === "error") {
      const reason = params.get("reason") || "";
      toast.error(
        reason === "no_refresh_token"
          ? t("pages.googleAds.oauthNoRefresh")
          : reason || t("pages.googleAds.oauthFail"),
      );
    }
    setParams({}, { replace: true });
  }, [params, setParams, qc, t]);

  const connect = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await integrationsService.beginGoogleAdsOAuth();
      if (error || !d?.authorize_url) throw new Error(error || t("pages.googleAds.oauthOpenFail"));
      return d.authorize_url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bootstrap = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await integrationsService.bootstrapGoogleAds();
      if (error) throw new Error(error);
      if (!d?.ok) throw new Error(d?.detail || d?.error || t("pages.googleAds.bootstrapIncomplete"));
      return d;
    },
    onSuccess: (d) => {
      toast.success(d.detail);
      void qc.invalidateQueries({ queryKey: ["integrations", "google-ads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveIds = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await integrationsService.patchGoogleAdsSettings({
        google_ads_customer_id: customerDraft,
        google_ads_login_customer_id: mccDraft,
        google_ads_enabled: true,
      });
      if (error) throw new Error(error);
      return d;
    },
    onSuccess: async () => {
      toast.success(t("pages.googleAds.saved"));
      await bootstrap.mutateAsync();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message={t("pages.googleAds.loading")} />
      </div>
    );
  }

  const ready = Boolean(data?.can_upload && data.has_refresh_token);
  const linked = Boolean(data?.has_refresh_token && data.google_ads_customer_id);
  const costsReady = linked;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.googleAds.title")}
        subtitle={t("pages.googleAds.subtitle")}
        meta={
          <>
            <ProStatusDot ok={Boolean(data?.api_env_configured)} label={t("pages.googleAds.service")} />
            <ProStatusDot ok={Boolean(data?.has_refresh_token)} label={t("pages.googleAds.googleAccount")} />
            <ProStatusDot ok={costsReady} label={t("pages.googleAds.costs")} />
            <ProStatusDot ok={ready} label={t("pages.googleAds.sales")} />
            {isFetching ? <span>{t("common.updating")}</span> : null}
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/integracoes">{t("pages.googleAds.back")}</Link>
          </Button>
        }
      />

      {!data?.api_env_configured ? (
        <ProAlert
          severity="critical"
          title={t("pages.googleAds.unavailableTitle")}
          detail={t("pages.googleAds.unavailableDetail")}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <ProPanel
          title={t("pages.googleAds.connectTitle")}
          description={t("pages.googleAds.connectDesc")}
        >
          <div className="space-y-4 px-4 py-4">
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-4">
              <li>{t("pages.googleAds.step1")}</li>
              <li>{t("pages.googleAds.step2")}</li>
              <li>
                {t("pages.googleAds.step3")}{" "}
                <ProInlineLink to="/resultados">{t("pages.googleAds.results")}</ProInlineLink>
              </li>
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button disabled={locked || connect.isPending || linked} onClick={() => connect.mutate()} className="gap-2">
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {linked ? t("pages.googleAds.linked") : t("pages.googleAds.connect")}
              </Button>
              {linked ? (
                <Button
                  variant="outline"
                  disabled={locked || connect.isPending}
                  onClick={() => connect.mutate()}
                  className="gap-2"
                >
                  {t("pages.googleAds.switchAccount")}
                </Button>
              ) : null}
              {data?.has_refresh_token ? (
                <Button
                  variant="secondary"
                  disabled={locked || bootstrap.isPending}
                  onClick={() => bootstrap.mutate()}
                  className="gap-2"
                >
                  {bootstrap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("pages.googleAds.refreshLink")}
                </Button>
              ) : null}
            </div>

            {ready ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-foreground">{t("pages.googleAds.salesReady")}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {fill(t("pages.googleAds.salesReadyBody"), {
                      id: data?.google_ads_customer_id ?? "",
                      manager: data?.google_ads_login_customer_id
                        ? fill(t("pages.googleAds.managerSet"), { id: data.google_ads_login_customer_id })
                        : t("pages.googleAds.managerMissing"),
                    })}
                  </p>
                  <p className="text-muted-foreground mt-1.5">{t("pages.googleAds.autoTagging")}</p>
                  <p className="text-muted-foreground mt-1.5">{t("pages.googleAds.apiErrorHint")}</p>
                </div>
              </div>
            ) : null}
          </div>
        </ProPanel>

        <ProPanel title={t("pages.googleAds.statusTitle")} description={t("pages.googleAds.statusDesc")}>
          <ul className="divide-y divide-border/50 text-sm">
            {[
              [t("pages.googleAds.rowAccount"), data?.has_refresh_token ? t("pages.googleAds.stateLinked") : t("pages.googleAds.statePending")],
              [t("pages.googleAds.rowCustomer"), data?.google_ads_customer_id || "—"],
              [t("pages.googleAds.rowManager"), data?.google_ads_login_customer_id || t("pages.googleAds.notSet")],
              [t("pages.googleAds.rowUpload"), data?.google_ads_enabled ? t("pages.googleAds.on") : t("pages.googleAds.off")],
              [t("pages.googleAds.readyLabel"), data?.can_upload ? t("pages.googleAds.readyYes") : t("pages.googleAds.readyNo")],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-xs font-mono font-medium text-right">{v}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border/60 px-4 py-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/integracoes/automizer">{t("pages.googleAds.updateCosts")}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/resultados">
                {t("pages.googleAds.results")} <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </ProPanel>
      </div>

      {data?.has_refresh_token && (!data.google_ads_customer_id || !data.google_ads_login_customer_id) ? (
        <ProPanel
          title={t("pages.googleAds.manualTitle")}
          description={
            data.google_ads_customer_id
              ? t("pages.googleAds.manualDescHas")
              : t("pages.googleAds.manualDescMissing")
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 px-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("pages.googleAds.customerLabel")}</Label>
              <Input
                className="h-9 font-mono text-xs"
                value={customerDraft}
                disabled={locked}
                onChange={(e) => setCustomerDraft(e.target.value)}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("pages.googleAds.managerLabel")}</Label>
              <Input
                className="h-9 font-mono text-xs"
                value={mccDraft}
                disabled={locked}
                onChange={(e) => setMccDraft(e.target.value)}
                placeholder={t("pages.googleAds.managerPlaceholder")}
              />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" disabled={locked || saveIds.isPending} onClick={() => saveIds.mutate()}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </ProPanel>
      ) : null}
    </div>
  );
}
