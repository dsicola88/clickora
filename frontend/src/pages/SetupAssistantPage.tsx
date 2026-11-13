import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, type MessageKey } from "@/i18n";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  LayoutList,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { shouldPollCustomDomainSsl } from "@/lib/customDomainSslDisplay";
import { isCustomDomainAdReady, isHostingCapableDomain } from "@/lib/publicPresellOrigin";
import { presellService } from "@/services/presellService";
import { analyticsService } from "@/services/analyticsService";
import { integrationsService } from "@/services/integrationsService";
import { customDomainService } from "@/services/customDomainService";
import { cn } from "@/lib/utils";
import {
  SETUP_ASSISTANT_HEALTH_MAP,
  accountHealthCheckOk,
} from "@/lib/accountHealthSteps";
import type { CustomDomainDto, Presell } from "@/types/api";

type StepStatus = "done" | "pending" | "warn";

type SetupStep = {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  actions: { to: string; label: string }[];
  hint?: string;
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (status === "warn") {
    return <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />;
  }
  return <CircleDashed className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />;
}

/**
 * Assistente guiado: domínio → presell → links → teste → postback → OAuth Google → Meta/TikTok CAPI.
 * Estados vindos dos mesmos endpoints que Settings / Integrações.
 */
const SETUP_ASSISTANT_QUERY_PREFIXES = [
  "setup-assistant-presells",
  "setup-assistant-dashboard",
  "setup-assistant-google-ads",
  "setup-assistant-webhook",
  "setup-assistant-meta-capi",
  "setup-assistant-tiktok-events",
  "custom-domain",
  "setup-assistant-domain-live",
] as const;

/** Mesmo critério que Final URL / ads (`isCustomDomainAdReady`) + probe go-live. */
function domainGoLiveStatus(domains: CustomDomainDto[], t: (key: MessageKey) => string): {
  status: StepStatus;
  hint: string;
} {
  if (!domains.length) {
    return {
      status: "pending",
      hint: t("pages.setup.domainNone"),
    };
  }
  const ready = domains.find(isCustomDomainAdReady);
  if (ready) {
    return {
      status: "done",
      hint: fill(t("pages.setup.domainReady"), { host: ready.hostname }),
    };
  }
  const hosting = domains.filter(isHostingCapableDomain);
  const dnsPending = hosting.find((d) => d.status === "pending" || d.ssl_state === "pending_dns");
  if (dnsPending) {
    return {
      status: "warn",
      hint: fill(t("pages.setup.domainDns"), { host: dnsPending.hostname }),
    };
  }
  const sslWait = hosting.find(
    (d) => shouldPollCustomDomainSsl(d) || d.ssl_state === "ssl_provisioning" || d.ssl_state === "misconfigured",
  );
  if (sslWait) {
    return {
      status: "warn",
      hint:
        sslWait.ssl_state === "misconfigured"
          ? fill(t("pages.setup.domainBad"), { host: sslWait.hostname })
          : fill(t("pages.setup.domainSsl"), { host: sslWait.hostname }),
    };
  }
  return {
    status: "warn",
    hint: t("pages.setup.domainConfirm"),
  };
}

function googleAdsStepStatus(opts: {
  canUpload: boolean;
  hasOAuth: boolean;
}): StepStatus {
  if (opts.canUpload) return "done";
  if (opts.hasOAuth) return "warn";
  return "pending";
}

export default function SetupAssistantPage() {
  const { t } = useAppLocale();
  const { user } = useAuth();
  const tenantKey = tenantQueryKey(user);
  const queryClient = useQueryClient();
  const refreshingChecks =
    useIsFetching({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (SETUP_ASSISTANT_QUERY_PREFIXES as readonly string[]).includes(q.queryKey[0]),
    }) > 0;

  const { data: presells, isLoading: loadingPresells } = useQuery({
    queryKey: ["setup-assistant-presells"],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) return [] as Presell[];
      return (data ?? []) as Presell[];
    },
  });

  const { data: dashboard, isLoading: loadingDash, isError: dashboardError } = useQuery({
    queryKey: ["setup-assistant-dashboard"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard();
      if (error) throw new Error(error);
      return data;
    },
    retry: 1,
  });

  const { data: googleAds, isLoading: loadingGa } = useQuery({
    queryKey: ["setup-assistant-google-ads"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getGoogleAdsSettings();
      if (error || !data) return null;
      return data;
    },
  });

  const {
    data: webhookResult,
    isLoading: loadingWh,
  } = useQuery({
    queryKey: ["setup-assistant-webhook"],
    queryFn: async () => {
      const { data, error, errorCode } = await integrationsService.getAffiliateWebhookInfo();
      if (error || !data) {
        return { info: null as null, errorCode: errorCode ?? null, error: error ?? "erro" };
      }
      return { info: data, errorCode: null as string | null, error: null as string | null };
    },
  });
  const webhook = webhookResult?.info ?? null;
  const webhookPlanBlocked = webhookResult?.errorCode === "AFFILIATE_WEBHOOK_PLAN";

  const { data: metaCapi, isLoading: loadingMeta } = useQuery({
    queryKey: ["setup-assistant-meta-capi"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getMetaCapiSettings();
      if (error || !data) return null;
      return data;
    },
  });

  const { data: tiktokEvents, isLoading: loadingTiktok } = useQuery({
    queryKey: ["setup-assistant-tiktok-events"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getTiktokEventsSettings();
      if (error || !data) return null;
      return data;
    },
  });

  /** Mesma cache key que Settings — SSL badge partilha estado. */
  const { data: listedDomains = [], isLoading: loadingDomains } = useQuery({
    queryKey: ["custom-domain", tenantKey],
    queryFn: async () => {
      const { data, error } = await customDomainService.list();
      if (error || !data) return [] as CustomDomainDto[];
      return data;
    },
  });

  const domainsNeedingProbe = useMemo(
    () => listedDomains.filter(shouldPollCustomDomainSsl).slice(0, 3),
    [listedDomains],
  );
  const probeIdsKey = domainsNeedingProbe.map((d) => d.id).join(",");

  const { data: liveDomainRows } = useQuery({
    queryKey: ["setup-assistant-domain-live", tenantKey, probeIdsKey],
    enabled: domainsNeedingProbe.length > 0,
    queryFn: async () => {
      const rows = await Promise.all(
        domainsNeedingProbe.map(async (d) => {
          const { data } = await customDomainService.goLive(d.id);
          return data ?? null;
        }),
      );
      return rows.filter((x): x is CustomDomainDto => Boolean(x));
    },
    refetchInterval: (q) => {
      const live = q.state.data ?? [];
      const still = domainsNeedingProbe.some((d) => {
        const merged = live.find((x) => x.id === d.id) ?? d;
        return shouldPollCustomDomainSsl(merged);
      });
      return still ? 12_000 : false;
    },
    staleTime: 8_000,
  });

  useEffect(() => {
    if (!liveDomainRows?.length) return;
    queryClient.setQueryData<CustomDomainDto[]>(["custom-domain", tenantKey], (old) =>
      (old ?? listedDomains).map((x) => {
        const live = liveDomainRows.find((r) => r.id === x.id);
        return live ? { ...x, ...live } : x;
      }),
    );
  }, [liveDomainRows, queryClient, tenantKey, listedDomains]);

  const domains = useMemo(() => {
    if (!liveDomainRows?.length) return listedDomains;
    return listedDomains.map((x) => {
      const live = liveDomainRows.find((r) => r.id === x.id);
      return live ? { ...x, ...live } : x;
    });
  }, [listedDomains, liveDomainRows]);

  const loading =
    loadingPresells || loadingDash || loadingGa || loadingWh || loadingMeta || loadingTiktok || loadingDomains;

  const domainLive = useMemo(() => domainGoLiveStatus(domains, t), [domains, t]);
  const healthChecks = dashboard?.account_health?.checks;

  const published = useMemo(
    () => (presells ?? []).filter((p) => p.status === "published"),
    [presells],
  );
  const hasPublished = published.length > 0;
  const clicks = dashboard?.entry_clicks ?? dashboard?.total_clicks ?? 0;
  const conversions = dashboard?.total_conversions ?? 0;
  const approvedSales = dashboard?.approved_sales_count ?? conversions;
  const pipeline = dashboard?.tracking_pipeline;
  const gaEnv = pipeline?.google_ads_api_env_configured ?? googleAds?.api_env_configured ?? false;
  const gaMetricsReady = pipeline?.google_ads_metrics_available ?? false;
  const gaCanUpload = googleAds?.can_upload ?? false;
  const gaHasOAuth = googleAds?.has_refresh_token ?? false;
  const gaCustomer = Boolean(googleAds?.google_ads_customer_id?.trim());

  const metaEnabled = Boolean(metaCapi?.meta_capi_enabled);
  const metaReady = Boolean(metaCapi?.can_send);
  const ttEnabled = Boolean(tiktokEvents?.tiktok_events_enabled);
  const ttReady = Boolean(tiktokEvents?.can_send);
  const metaTikTokOptionalOk =
    (!metaEnabled || metaReady) && (!ttEnabled || ttReady);
  const metaTikTokWarn = (metaEnabled && !metaReady) || (ttEnabled && !ttReady);
  const metaTikTokDataReady = metaCapi != null && tiktokEvents != null;

  /** Preferir account_health (mesma fonte do hub) quando o check existe. */
  const healthStepStatus = (setupId: keyof typeof SETUP_ASSISTANT_HEALTH_MAP, fallback: StepStatus): StepStatus => {
    const hid = SETUP_ASSISTANT_HEALTH_MAP[setupId];
    const h = accountHealthCheckOk(healthChecks, hid);
    if (!h.found) return fallback;
    return h.ok ? "done" : fallback === "done" ? "warn" : fallback;
  };

  const steps: SetupStep[] = useMemo(() => {
    const domainStatus = healthStepStatus("domain", domainLive.status);
    const domainHint =
      accountHealthCheckOk(healthChecks, SETUP_ASSISTANT_HEALTH_MAP.domain).detail || domainLive.hint;
    const presellHealth = accountHealthCheckOk(healthChecks, SETUP_ASSISTANT_HEALTH_MAP.presell);
    const presellStatus = healthStepStatus("presell", hasPublished ? "done" : "pending");
    const postbackHealth = accountHealthCheckOk(healthChecks, SETUP_ASSISTANT_HEALTH_MAP.postback);
    const postbackPlan = accountHealthCheckOk(healthChecks, "postback_plan");
    const googleHealthStatus = healthStepStatus(
      "google",
      googleAdsStepStatus({ canUpload: gaCanUpload, hasOAuth: gaHasOAuth }),
    );
    const metaH = accountHealthCheckOk(healthChecks, SETUP_ASSISTANT_HEALTH_MAP.capi_meta);
    const ttH = accountHealthCheckOk(healthChecks, SETUP_ASSISTANT_HEALTH_MAP.capi_tiktok);
    const capiFromHealth = metaH.found && ttH.found;
    const capiStatus: StepStatus = !capiFromHealth
      ? !metaTikTokDataReady
        ? "pending"
        : metaTikTokOptionalOk && !metaTikTokWarn
          ? "done"
          : metaTikTokWarn
            ? "warn"
            : "pending"
      : metaH.ok && ttH.ok
        ? "done"
        : metaEnabled || ttEnabled
          ? "warn"
          : "pending";

    const s: SetupStep[] = [
      {
        id: "domain",
        title: t("pages.setup.stepDomainTitle"),
        description: t("pages.setup.stepDomainDesc"),
        status: domainStatus,
        actions: [{ to: "/configuracoes/dominio", label: t("pages.setup.configureDomain") }],
        hint: domainHint,
      },
      {
        id: "presell",
        title: t("pages.setup.stepPresellTitle"),
        description: t("pages.setup.stepPresellDesc"),
        status: presellStatus,
        actions: [{ to: "/presells", label: t("pages.setup.myPresells") }],
        hint: presellHealth.detail
          || (hasPublished
            ? fill(t("pages.setup.publishedCount"), { n: published.length })
            : t("pages.setup.noPublished")),
      },
      {
        id: "urls",
        title: t("pages.setup.stepUrlsTitle"),
        description: t("pages.setup.stepUrlsDesc"),
        status: hasPublished ? "done" : "warn",
        actions: [{ to: "/tracking/url-builder", label: t("pages.setup.buildLink") }],
        hint: !hasPublished ? t("pages.setup.publishFirst") : undefined,
      },
      {
        id: "clicks",
        title: t("pages.setup.stepClicksTitle"),
        description: t("pages.setup.stepClicksDesc"),
        status: clicks > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [
          { to: "/tracking/relatorios/cliques", label: t("pages.setup.viewClicks") },
          { to: "/resultados", label: t("pages.setup.results") },
        ],
        hint:
          clicks > 0
            ? fill(t("pages.setup.clicksInPeriod"), { n: clicks })
            : t("pages.setup.noClicksPeriod"),
      },
      {
        id: "postback",
        title: t("pages.setup.stepPostbackTitle"),
        description: t("pages.setup.stepPostbackDesc"),
        status: healthStepStatus(
          "postback",
          approvedSales > 0
            ? "done"
            : webhook?.hook_url
              ? "warn"
              : webhookPlanBlocked || (postbackPlan.found && !postbackPlan.ok)
                ? "warn"
                : hasPublished
                  ? "warn"
                  : "pending",
        ),
        actions: [
          { to: "/integracoes/postback", label: t("pages.setup.configurePostback") },
          ...(webhookPlanBlocked || (postbackPlan.found && !postbackPlan.ok)
            ? [{ to: "/planos", label: t("pages.setup.viewPlans") }]
            : []),
        ],
        hint:
          postbackHealth.detail ||
          (webhookPlanBlocked || (postbackPlan.found && !postbackPlan.ok)
            ? t("pages.setup.postbackPlan")
            : webhook?.hook_url
              ? approvedSales > 0
                ? t("pages.setup.salesInPeriod")
                : t("pages.setup.postbackReady")
              : t("pages.setup.openPostback")),
      },
      {
        id: "reports",
        title: t("pages.setup.stepReportsTitle"),
        description: t("pages.setup.stepReportsDesc"),
        status: approvedSales > 0 || clicks > 0 ? "done" : "pending",
        actions: [{ to: "/resultados/relatorios", label: t("pages.setup.openReports") }],
      },
      {
        id: "google",
        title: t("pages.setup.stepGoogleTitle"),
        description: t("pages.setup.stepGoogleDesc"),
        status: googleHealthStatus,
        actions: [{ to: "/integracoes/google-ads", label: t("pages.setup.connectGoogle") }],
        hint:
          accountHealthCheckOk(healthChecks, SETUP_ASSISTANT_HEALTH_MAP.google).detail ||
          (!gaEnv
            ? t("pages.setup.googleUnavailable")
            : gaCanUpload
              ? t("pages.setup.googleReady")
              : gaHasOAuth
                ? gaCustomer
                  ? t("pages.setup.googleConfirm")
                  : t("pages.setup.googlePickAccount")
                : t("pages.setup.googleClickConnect")),
      },
      {
        id: "capi",
        title: t("pages.setup.stepCapiTitle"),
        description: t("pages.setup.stepCapiDesc"),
        status: capiStatus,
        actions: [{ to: "/integracoes", label: t("pages.setup.integrations") }],
        hint: capiFromHealth
          ? [metaH.detail, ttH.detail].filter(Boolean).join(" ")
          : !metaTikTokDataReady
            ? t("pages.setup.capiLoading")
            : [
                fill(t("pages.setup.capiMetaLine"), {
                  state: !metaEnabled
                    ? t("pages.setup.capiOptional")
                    : metaReady
                      ? t("pages.setup.capiReady")
                      : t("pages.setup.capiMissing"),
                }),
                fill(t("pages.setup.capiTtLine"), {
                  state: !ttEnabled
                    ? t("pages.setup.capiOptional")
                    : ttReady
                      ? t("pages.setup.capiReady")
                      : t("pages.setup.capiMissing"),
                }),
              ].join(" "),
      },
    ];
    return s;
  }, [
    domainLive,
    healthChecks,
    hasPublished,
    published.length,
    clicks,
    conversions,
    approvedSales,
    webhook?.hook_url,
    webhookPlanBlocked,
    gaEnv,
    gaCanUpload,
    gaHasOAuth,
    gaCustomer,
    metaCapi,
    tiktokEvents,
    metaEnabled,
    metaReady,
    ttEnabled,
    ttReady,
    metaTikTokOptionalOk,
    metaTikTokWarn,
    metaTikTokDataReady,
    t,
  ]);

  const coreSteps = steps.filter((x) => x.id !== "google" && x.id !== "capi" && x.id !== "domain");
  const doneCount = coreSteps.filter((x) => x.status === "done").length;
  const warnCount = coreSteps.filter((x) => x.status === "warn").length;
  const googleStatus = googleAdsStepStatus({ canUpload: gaCanUpload, hasOAuth: gaHasOAuth });
  const postbackStatus: StepStatus = approvedSales > 0
    ? "done"
    : webhook?.hook_url
      ? "warn"
      : webhookPlanBlocked
        ? "warn"
        : "pending";

  const goLivePillars: { id: string; label: string; status: StepStatus; to: string }[] = [
    { id: "domain", label: t("pages.setup.pillarDomain"), status: domainLive.status, to: "/configuracoes/dominio" },
    {
      id: "google",
      label: t("pages.setup.pillarGoogle"),
      status: googleStatus,
      to: "/integracoes/google-ads",
    },
    {
      id: "postback",
      label: t("pages.setup.pillarPostback"),
      status: postbackStatus,
      to: "/integracoes/postback",
    },
  ];

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title={t("pages.setup.title")}
        description={t("pages.setup.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={refreshingChecks}
              onClick={() => {
                void Promise.all(
                  SETUP_ASSISTANT_QUERY_PREFIXES.map((key) =>
                    queryClient.invalidateQueries({ queryKey: [key] }),
                  ),
                );
              }}
            >
              <RefreshCw className={`h-4 w-4 ${refreshingChecks ? "animate-spin" : ""}`} />
              {t("pages.setup.refresh")}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/ajuda">
                <LayoutList className="h-4 w-4" />
                {t("pages.setup.help")}
              </Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <LoadingState message={t("pages.setup.loading")} />
      ) : (
        <>
          {dashboardError ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90">
              {t("pages.setup.metricsError")}{" "}
              <Link to="/resultados" className="font-medium underline underline-offset-2">
                {t("pages.setup.results")}
              </Link>{" "}
              {t("pages.setup.metricsErrorTail")}
            </p>
          ) : null}

          <div className="rounded-xl border border-border/70 bg-card px-4 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("pages.setup.readyTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t("pages.setup.readyDesc")}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {goLivePillars.map((p) => (
                <Link
                  key={p.id}
                  to={p.to}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/40",
                    p.status === "done" && "border-emerald-500/30 bg-emerald-500/[0.04]",
                    p.status === "warn" && "border-amber-500/35 bg-amber-500/[0.05]",
                    p.status === "pending" && "border-border/70",
                  )}
                >
                  <StatusIcon status={p.status} />
                  <span className="font-medium text-foreground">{p.label}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-auto text-[10px] font-normal",
                      p.status === "done" && "text-emerald-700 dark:text-emerald-400",
                      p.status === "warn" && "text-amber-800 dark:text-amber-300",
                    )}
                  >
                    {p.status === "done" ? t("pages.setup.statusOk") : p.status === "warn" ? t("pages.setup.statusAlmost") : t("pages.setup.statusMissing")}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 rounded-xl border border-border/70 bg-card px-3 py-3 text-sm">
            <div className="flex items-center gap-2 px-2 py-1">
              {hasPublished ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span>{hasPublished ? t("pages.setup.presellPublished") : t("pages.setup.presellMissing")}</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1">
              {clicks > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span>{clicks > 0 ? fill(t("pages.setup.clicksReceived"), { n: clicks }) : t("pages.setup.clicksNone")}</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1">
              {conversions > 0 || approvedSales > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span>
                {conversions > 0 || approvedSales > 0
                  ? fill(t("pages.setup.conversionsReceived"), { n: conversions || approvedSales })
                  : t("pages.setup.conversionsNone")}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="text-muted-foreground">
              {t("pages.setup.essential")}{" "}
              <strong className="text-foreground">
                {fill(t("pages.setup.essentialDone"), { done: doneCount, total: coreSteps.length })}
              </strong>
              {warnCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-amber-700 dark:text-amber-400">
                    {fill(t("pages.setup.warnCount"), { n: warnCount })}
                  </span>
                </>
              ) : null}
            </span>
            {gaCanUpload ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {t("pages.setup.googleLinked")}
              </Badge>
            ) : gaMetricsReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {t("pages.setup.googleMetrics")}
              </Badge>
            ) : null}
            {metaEnabled && metaReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {t("pages.setup.badgeMeta")}
              </Badge>
            ) : null}
            {ttEnabled && ttReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {t("pages.setup.badgeTiktok")}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-4">
            {steps.map((step) => (
              <Card
                key={step.id}
                className={cn(
                  "border-border/80 overflow-hidden transition-shadow",
                  step.status === "done" && "border-emerald-500/25 bg-emerald-500/[0.03]",
                  step.status === "warn" && "border-amber-500/30 bg-amber-500/[0.04]",
                )}
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="flex gap-4">
                    <StatusIcon status={step.status} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <h2 className="text-base font-semibold text-foreground leading-snug">{step.title}</h2>
                        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                        {step.hint ? (
                          <p className="mt-2 text-xs text-foreground/80 bg-muted/40 rounded-lg px-3 py-2 border border-border/50">
                            {step.hint}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {step.actions.map((a) => (
                          <Button key={a.to + a.label} variant="secondary" size="sm" className="gap-1.5" asChild>
                            <Link to={a.to}>
                              {a.label}
                              <ArrowRight className="h-3.5 w-3.5 opacity-70" />
                            </Link>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
