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
import { integrationsService } from "@/services/integrationsService";
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
import { ACCOUNT_HEALTH_HUB_STEPS } from "@/lib/accountHealthSteps";
import { NextAccountActionBanner } from "@/components/NextAccountActionBanner";

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

/** IDs alinhados a `account_health.checks` (backend). */
const STEP_DEFS = ACCOUNT_HEALTH_HUB_STEPS;

/**
 * Hub Integrações — go-live operativo para media buyers.
 */
export default function IntegrationsHubPage() {
  const { user, isSuperAdmin } = useAuth();
  const { t } = useAppLocale();
  const dpilot = userCanAccessDpilotAds(user, isSuperAdmin);
  const [saleChimeOn, setSaleChimeOn] = useState(() => saleChimeEnabled());
  const [retryingQueue, setRetryingQueue] = useState(false);
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

  const { data: webhookInfo } = useQuery({
    queryKey: ["integrations-hub-webhook"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getAffiliateWebhookInfo();
      if (error || !data) return null;
      return data;
    },
    staleTime: 60_000,
  });

  /** URL completo com token — não o path relativo do dashboard. */
  const postbackUrl = webhookInfo?.hook_url?.trim() || "";

  const health = dash?.account_health;
  const deadJobs = dash?.sync_queue?.dead ?? 0;

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

      <NextAccountActionBanner checks={health?.checks} />

      {health ? (
        <AttributionHealthBanner attribution={health.attribution} checks={health.checks} />
      ) : null}
      <SyncHealthBanner syncHealth={dash?.sync_health} />
      {deadJobs > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-sm text-foreground">
            {fill(t("pages.integrations.syncQueueDead"), { n: deadJobs })}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={retryingQueue}
            onClick={() => {
              setRetryingQueue(true);
              void integrationsService
                .retryConversionSync({ limit: 50 })
                .then(({ data, error }) => {
                  if (error) {
                    toast.error(t("pages.integrations.syncQueueRetryFail"));
                    return;
                  }
                  toast.success(fill(t("pages.integrations.syncQueueRetryOk"), { n: data?.reset ?? 0 }));
                  void refetchDash();
                })
                .finally(() => setRetryingQueue(false));
            }}
          >
            {t("pages.integrations.syncQueueRetry")}
          </Button>
        </div>
      ) : null}
      <TrackPathStatus />

      <div className="rounded-lg border border-border/70 bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("pages.integrations.assistantTitle")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            {t("pages.integrations.assistantDesc")}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5 shrink-0" asChild>
          <Link to="/ajuda/assistente">
            {t("pages.integrations.assistantOpen")}
            <ArrowRight className="h-3.5 w-3.5 opacity-70" />
          </Link>
        </Button>
      </div>

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
            to="/integracoes/avancado"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t("pages.integrations.advancedCard")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                {t("pages.integrations.advancedCardDesc")}
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
