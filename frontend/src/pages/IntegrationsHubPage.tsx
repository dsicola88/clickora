import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plug, ShieldCheck, LineChart, Zap, Megaphone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { playSaleChime, saleChimeEnabled, setSaleChimeEnabled } from "@/lib/saleChime";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { Badge } from "@/components/ui/badge";
import { analyticsService } from "@/services/analyticsService";
import { rangeLast14Days } from "@/lib/dateRangePresets";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProPanel,
  ProStatusDot,
  ProInlineLink,
} from "@/components/enterprise/ProShell";
import { AttributionHealthBanner } from "@/components/AttributionHealthBanner";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { SyncHealthBanner } from "@/components/SyncHealthBanner";
import { PostbackMacroChecklist } from "@/components/PostbackMacroChecklist";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { MessageKey } from "@/i18n";

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

const STEP_DEFS = [
  {
    id: "presell_published",
    href: "/presells/nova",
    titleKey: "pages.integrations.stepPresell" as MessageKey,
    descKey: "pages.integrations.stepPresellDesc" as MessageKey,
  },
  {
    id: "postback_configured",
    href: "/integracoes/postback",
    titleKey: "pages.integrations.stepPostback" as MessageKey,
    descKey: "pages.integrations.stepPostbackDesc" as MessageKey,
  },
  {
    id: "campaign_linked",
    href: "/campanhas",
    titleKey: "pages.integrations.stepCampaign" as MessageKey,
    descKey: "pages.integrations.stepCampaignDesc" as MessageKey,
  },
  {
    id: "google_ads",
    href: "/integracoes/google-ads",
    titleKey: "pages.integrations.stepGoogle" as MessageKey,
    descKey: "pages.integrations.stepGoogleDesc" as MessageKey,
  },
  {
    id: "cost_sync",
    href: "/integracoes/automizer",
    titleKey: "pages.integrations.stepCosts" as MessageKey,
    descKey: "pages.integrations.stepCostsDesc" as MessageKey,
  },
  {
    id: "ads_upload",
    href: "/resultados/relatorios/conversoes",
    titleKey: "pages.integrations.stepAdsUpload" as MessageKey,
    descKey: "pages.integrations.stepAdsUploadDesc" as MessageKey,
  },
  {
    id: "domain_https",
    href: "/configuracoes",
    titleKey: "pages.integrations.stepDomain" as MessageKey,
    descKey: "pages.integrations.stepDomainDesc" as MessageKey,
  },
] as const;

/**
 * Hub Integrações — go-live operativo para media buyers.
 */
export default function IntegrationsHubPage() {
  const { user, isSuperAdmin } = useAuth();
  const { t } = useAppLocale();
  const dpilot = userCanAccessDpilotAds(user, isSuperAdmin);
  const [saleChimeOn, setSaleChimeOn] = useState(() => saleChimeEnabled());
  const range = useMemo(() => rangeLast14Days(), []);

  const { data: dash, isError: dashError, refetch: refetchDash } = useQuery({
    queryKey: ["dashboard", "integrations-health", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from: range.from, to: range.to });
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 60_000,
  });

  const postbackUrl =
    typeof dash?.tracking_install?.affiliate_webhook_path === "string"
      ? dash.tracking_install.affiliate_webhook_path
      : "";

  const health = dash?.account_health;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.integrations.title")}
        subtitle={t("pages.integrations.subtitle")}
        meta={
          health ? (
            <>
              <ProStatusDot
                ok={health.score >= 85}
                label={fill(t("pages.integrations.healthScore"), { n: health.score })}
              />
              <ProInlineLink to="/resultados">{t("pages.results.title")}</ProInlineLink>
            </>
          ) : null
        }
      />

      {health ? (
        <AttributionHealthBanner attribution={health.attribution} checks={health.checks} />
      ) : null}
      <SyncHealthBanner syncHealth={dash?.sync_health} />
      <TrackPathStatus />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <ProPanel title={t("pages.integrations.goLive")} description={t("pages.integrations.goLiveDesc")}>
          <ol className="divide-y divide-border/50">
            {STEP_DEFS.map((s, i) => {
              const check = health?.checks.find((c) => c.id === s.id);
              const title = t(s.titleKey);
              return (
                <li key={s.id} className="flex gap-3 px-4 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {check == null ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                          {title}
                        </span>
                      ) : (
                        <ProStatusDot ok={check.ok} label={title} />
                      )}
                      {check?.ok === false ? (
                        <Link to={s.href} className="text-[11px] font-medium text-primary hover:underline">
                          {t("common.resolve")}
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      {check?.detail || t(s.descKey)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </ProPanel>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{t("pages.integrations.saleChime")}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  {t("pages.integrations.saleChimeDesc")}
                </p>
              </div>
              <Switch
                checked={saleChimeOn}
                onCheckedChange={(on) => {
                  setSaleChimeEnabled(on);
                  setSaleChimeOn(on);
                }}
                aria-label={t("pages.integrations.saleChime")}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!saleChimeOn}
              onClick={() => {
                void playSaleChime().then((ok) => {
                  if (!ok) toast.error(t("pages.integrations.saleChimeBlocked"));
                });
              }}
            >
              {t("pages.integrations.saleChimeListen")}
            </Button>
          </div>
          <div className="space-y-3">
            <Link
              to="/integracoes/postback"
              className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="rounded-md bg-primary/10 p-2">
                <Plug className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t("pages.integrations.postbackCard")}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  {t("pages.integrations.postbackCardDesc")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
            <PostbackMacroChecklist compact postbackUrl={postbackUrl || undefined} />
            {dashError ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                {t("pages.integrations.healthLoadError")}{" "}
                <button type="button" className="underline" onClick={() => void refetchDash()}>
                  {t("common.retry")}
                </button>
              </p>
            ) : null}
          </div>

          <Link
            to="/integracoes/google-ads"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <LineChart className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                {t("pages.integrations.googleCard")}
                <Badge variant="secondary" className="text-[10px]">
                  {t("pages.integrations.googleBadge")}
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                {t("pages.integrations.googleCardDesc")}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          <Link
            to="/integracoes/pixels"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                {t("pages.integrations.pixelsCard")}
                <Badge variant="secondary" className="text-[10px]">
                  {t("pages.integrations.pixelsBadge")}
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                {t("pages.integrations.pixelsCardDesc")}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          <Link
            to="/integracoes/automizer"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                {t("pages.integrations.automizerCard")}
                <Badge variant="secondary" className="text-[10px]">
                  {t("pages.integrations.automizerBadge")}
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                {t("pages.integrations.automizerCardDesc")}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          <Link
            to="/tracking/integrations-legacy"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t("pages.integrations.legacyCard")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                {t("pages.integrations.legacyCardDesc")}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          {dpilot ? (
            <Link
              to="/tracking/dpilot"
              className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="rounded-md bg-primary/10 p-2">
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t("pages.integrations.dpilotCard")}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  {t("pages.integrations.dpilotCardDesc")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
