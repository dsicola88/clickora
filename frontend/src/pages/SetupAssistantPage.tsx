import { useAppLocale } from "@/i18n/AppLocaleProvider";
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
function domainGoLiveStatus(domains: CustomDomainDto[]): {
  status: StepStatus;
  hint: string;
} {
  if (!domains.length) {
    return {
      status: "pending",
      hint:
        "Sem domínio próprio: as páginas usam o host da conta (trial). Para anunciar a sério, liga o teu domínio (CNAME) — SSL fica a cargo da Clickora.",
    };
  }
  const ready = domains.find(isCustomDomainAdReady);
  if (ready) {
    const https = ready.https_ready === true || ready.ssl_state === "https_ready";
    return {
      status: "done",
      hint: `Pronto para Ads: ${ready.hostname}${https ? " (HTTPS)" : " (DNS OK)"}.`,
    };
  }
  const hosting = domains.filter(isHostingCapableDomain);
  const dnsPending = hosting.find((d) => d.status === "pending" || d.ssl_state === "pending_dns");
  if (dnsPending) {
    return {
      status: "warn",
      hint: `${dnsPending.hostname}: falta concluir DNS (CNAME/TXT) em Configurações → Domínios.`,
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
          ? `${sslWait.hostname}: DNS mal configurado — corrige o CNAME.`
          : `${sslWait.hostname}: DNS OK — a aguardar HTTPS (SSL).`,
    };
  }
  return {
    status: "warn",
    hint: "Há domínio na conta — confirma verificação e HTTPS em Configurações → Domínios.",
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

  const domainLive = useMemo(() => domainGoLiveStatus(domains), [domains]);

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

  const steps: SetupStep[] = useMemo(() => {
    const s: SetupStep[] = [
      {
        id: "domain",
        title: "1. Domínio próprio (recomendado para Ads)",
        description:
          "Liga o teu domínio com um CNAME. OAuth e postbacks funcionam sem isto; o host da conta serve para trial. Para campanhas sérias, usa domínio teu + HTTPS.",
        status: domainLive.status,
        actions: [{ to: "/configuracoes", label: "Configurar domínio" }],
        hint: domainLive.hint,
      },
      {
        id: "presell",
        title: "2. Presell publicada",
        description:
          "Cria a página (visual do produto + link da oferta) e publica. O anúncio deve abrir só o teu link /p/… — nunca a página do produto em cru.",
        status: hasPublished ? "done" : "pending",
        actions: [{ to: "/presell/dashboard", label: "Minhas Presells" }],
        hint: hasPublished
          ? `${published.length} página(s) publicada(s).`
          : "Ainda sem presell publicada.",
      },
      {
        id: "urls",
        title: "3. Link do anúncio",
        description:
          "Em Gerar link, copia o URL da página e cola no Google, Meta ou TikTok.",
        status: hasPublished ? "done" : "warn",
        actions: [{ to: "/tracking/url-builder", label: "Gerar link" }],
        hint: !hasPublished ? "Publica uma presell primeiro." : undefined,
      },
      {
        id: "clicks",
        title: "4. Rastreio — teste de clique",
        description:
          "Abre a presell pública, clica no botão da oferta (não no URL do formulário). Em Relatórios deve aparecer o clique.",
        status: clicks > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [
          { to: "/tracking/relatorios/cliques", label: "Ver cliques" },
          { to: "/resultados", label: "Resultados" },
        ],
        hint:
          clicks > 0
            ? `${clicks} clique(s) no período do resumo.`
            : "Sem cliques neste período — faz um teste na página /p/…",
      },
      {
        id: "postback",
        title: "5. Aviso de venda (postback)",
        description:
          "Em Integrações copia o URL de aviso e cola na tua rede (Hotmart, Digistore, etc.). Sem isto só vês cliques, não vendas.",
        status: approvedSales > 0
          ? "done"
          : webhook?.hook_url
            ? "warn"
            : webhookPlanBlocked
              ? "warn"
              : hasPublished
                ? "warn"
                : "pending",
        actions: [
          { to: "/integracoes/postback", label: "Configurar aviso de venda" },
          ...(webhookPlanBlocked ? [{ to: "/planos", label: "Ver planos" }] : []),
        ],
        hint: webhookPlanBlocked
          ? "Postback não está activo neste plano — faz upgrade ou pede ao admin."
          : webhook?.hook_url
            ? approvedSales > 0
              ? "Há vendas aprovadas no período."
              : "URL pronto — confirma na rede que está activo (macros / subid)."
            : "Abre Postback para obter o URL completo (com token).",
      },
      {
        id: "reports",
        title: "6. Conversões e relatórios",
        description: "Cliques, vendas e receita aparecem em Conversões e relatórios (dados reais da conta).",
        status: approvedSales > 0 || clicks > 0 ? "done" : "pending",
        actions: [{ to: "/resultados/relatorios", label: "Abrir relatórios" }],
      },
      {
        id: "google",
        title: "7. Google Ads — ligar conta (1 clique)",
        description:
          "OAuth oficial: em Integrações → Google Ads liga a conta para custos e upload GCLID. Sem colar tokens à mão.",
        status: googleAdsStepStatus({ canUpload: gaCanUpload, hasOAuth: gaHasOAuth }),
        actions: [{ to: "/integracoes/google-ads", label: "Ligar Google Ads" }],
        hint: !gaEnv
          ? "API Google ainda não configurada neste ambiente (admin do servidor)."
          : gaCanUpload
            ? "Envio à Google pronto."
            : gaHasOAuth
              ? gaCustomer
                ? "Conta ligada — confirma o ID da conversão / cliente."
                : "OAuth feito — falta escolher o cliente Ads / conversão."
              : "Clica em Ligar: autorizas a Google uma vez; o resto é automático.",
      },
      {
        id: "capi",
        title: "8. Meta e TikTok CAPI (opcional)",
        description:
          "Pixel + token de Events API em Integrações (não é OAuth). Sem isto o painel continua a marcar vendas via postback.",
        status: !metaTikTokDataReady
          ? "pending"
          : metaTikTokOptionalOk && !metaTikTokWarn
            ? "done"
            : metaTikTokWarn
              ? "warn"
              : "pending",
        actions: [{ to: "/integracoes", label: "Integrações" }],
        hint: !metaTikTokDataReady
          ? "A obter estado…"
          : [
              `Meta: ${!metaEnabled ? "opcional." : metaReady ? "pronta." : "falta Pixel/token."}`,
              `TikTok: ${!ttEnabled ? "opcional." : ttReady ? "pronta." : "falta Pixel/token."}`,
            ].join(" "),
      },
    ];
    return s;
  }, [
    domainLive,
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
    { id: "domain", label: "Domínio", status: domainLive.status, to: "/configuracoes" },
    {
      id: "google",
      label: "Google Ads",
      status: googleStatus,
      to: "/integracoes/google-ads",
    },
    {
      id: "postback",
      label: "Postback",
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
              Atualizar
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/ajuda">
                <LayoutList className="h-4 w-4" />
                Ajuda
              </Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <LoadingState message="A carregar estado da conta…" />
      ) : (
        <>
          {dashboardError ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90">
              Não foi possível carregar métricas. Abra o{" "}
              <Link to="/resultados" className="font-medium underline underline-offset-2">
                Resultados
              </Link>{" "}
              ou actualize.
            </p>
          ) : null}

          <div className="rounded-xl border border-border/70 bg-card px-4 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Go live (o caminho certo)</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Domínio (CNAME) · OAuth Google · postback · Meta/TikTok CAPI (opcional). Sem colar tokens em ficheiros.
                Host da conta serve para trial; para Ads a sério, completa o verde abaixo.
              </p>
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
                    {p.status === "done" ? "OK" : p.status === "warn" ? "Quase" : "Falta"}
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
              <span>{hasPublished ? "Presell publicada" : "Falta publicar presell"}</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1">
              {clicks > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span>{clicks > 0 ? `Cliques recebidos (${clicks})` : "Ainda sem cliques"}</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1">
              {conversions > 0 || approvedSales > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span>
                {conversions > 0 || approvedSales > 0
                  ? `Conversões (${conversions || approvedSales})`
                  : "Ainda sem conversões"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="text-muted-foreground">
              Essencial:{" "}
              <strong className="text-foreground">
                {doneCount}/{coreSteps.length}
              </strong>{" "}
              concluídos
              {warnCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-amber-700 dark:text-amber-400">
                    {warnCount} com aviso
                  </span>
                </>
              ) : null}
            </span>
            {gaCanUpload ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Google Ads upload OK
              </Badge>
            ) : gaMetricsReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Google métricas
              </Badge>
            ) : null}
            {metaEnabled && metaReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Meta CAPI
              </Badge>
            ) : null}
            {ttEnabled && ttReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                TikTok Events
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
