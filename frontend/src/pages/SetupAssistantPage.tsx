import { useMemo } from "react";
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
import { presellService } from "@/services/presellService";
import { analyticsService } from "@/services/analyticsService";
import { integrationsService } from "@/services/integrationsService";
import { cn } from "@/lib/utils";
import type { Presell } from "@/types/api";

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
 * Assistente guiado em linguagem simples: presell → links → teste → vendas na rede → opcionais Google/Meta/TikTok.
 * A lógica de estado continua baseada nos dados da conta (métricas e integrações).
 */
const SETUP_ASSISTANT_QUERY_PREFIXES = [
  "setup-assistant-presells",
  "setup-assistant-dashboard",
  "setup-assistant-google-ads",
  "setup-assistant-webhook",
  "setup-assistant-meta-capi",
  "setup-assistant-tiktok-events",
] as const;

export default function SetupAssistantPage() {
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

  const { data: webhook, isLoading: loadingWh } = useQuery({
    queryKey: ["setup-assistant-webhook"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getAffiliateWebhookInfo();
      if (error || !data) return null;
      return data;
    },
  });

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

  const loading = loadingPresells || loadingDash || loadingGa || loadingWh || loadingMeta || loadingTiktok;

  const published = useMemo(
    () => (presells ?? []).filter((p) => p.status === "published"),
    [presells],
  );
  const hasPublished = published.length > 0;
  const clicks = dashboard?.total_clicks ?? 0;
  const approvedSales = dashboard?.approved_sales_count ?? dashboard?.total_conversions ?? 0;
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
        title: "1. Domínio (opcional mas recomendado)",
        description:
          "Liga o teu domínio em Domínio (DNS). Sem domínio próprio, as páginas usam o endereço da conta — os cliques funcionam na mesma.",
        status: "pending",
        actions: [{ to: "/tracking/settings", label: "Configurar domínio" }],
        hint: "Podes avançar e voltar depois. SSL fica a cargo da Clickora após o DNS.",
      },
      {
        id: "presell",
        title: "2. Presell publicada",
        description:
          "Cria a página (visual do produto + hoplink da rede) e publica. O anúncio deve abrir só o link /p/… — nunca a página do produto em cru.",
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
          "Em Gerar link, copia o URL da presell (com UTMs se quiseres). Cola esse link no Google/Meta/TikTok.",
        status: hasPublished ? "done" : "warn",
        actions: [{ to: "/tracking/url-builder", label: "Gerar link" }],
        hint: !hasPublished ? "Publica uma presell primeiro." : undefined,
      },
      {
        id: "clicks",
        title: "4. Tracking — teste de clique",
        description:
          "Abre a presell pública, clica no botão da oferta (não no URL do formulário). Em Relatórios deve aparecer o clique.",
        status: clicks > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [
          { to: "/tracking/relatorios/cliques", label: "Ver cliques" },
          { to: "/resultados", label: "P&L" },
        ],
        hint:
          clicks > 0
            ? `${clicks} clique(s) no período do resumo.`
            : "Sem cliques neste período — faz um teste na página /p/…",
      },
      {
        id: "postback",
        title: "5. Postback (vendas)",
        description:
          "Em Postback copia o URL e cola na tua rede (Hotmart, Digistore, etc.). Sem isto só vês cliques, não vendas.",
        status: approvedSales > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [{ to: "/integracoes/postback", label: "Configurar postback" }],
        hint: webhook?.hook_url
          ? approvedSales > 0
            ? "Há vendas aprovadas no período."
            : "URL pronto — confirma na rede que está activo."
          : "Abre Postback para obter o URL (ou verifica o plano).",
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
        title: "7. Google Ads (opcional)",
        description:
          "Se anuncias no Google: em Integrações → Google Ads liga a conta (1 clique) para custos e upload GCLID.",
        status: gaCanUpload ? "done" : gaHasOAuth && gaCustomer && gaEnv ? "warn" : "pending",
        actions: [{ to: "/integracoes/google-ads", label: "Google Ads" }],
        hint: !gaEnv
          ? "API Google ainda não configurada neste ambiente (admin do servidor)."
          : gaCanUpload
            ? "Envio à Google pronto."
            : "Liga a conta e confirma o ID da conversão.",
      },
      {
        id: "capi",
        title: "8. Meta e TikTok (opcional)",
        description: "Envio de compras às redes sociais — só se anunciares lá. Configura em Integrações.",
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
              `Meta: ${!metaEnabled ? "ignorável." : metaReady ? "pronta." : "falta Pixel/token."}`,
              `TikTok: ${!ttEnabled ? "ignorável." : ttReady ? "pronta." : "falta Pixel/token."}`,
            ].join(" "),
      },
    ];
    return s;
  }, [
    hasPublished,
    published.length,
    clicks,
    conversions,
    approvedSales,
    webhook?.hook_url,
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
  const showMetaTiktokBadges = metaCapi != null && tiktokEvents != null;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Começar aqui"
        description="Domínio → Presell → Link → Teste → Postback → Relatórios. Números = período do Resumo (~14 dias)."
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
                P&L
              </Link>{" "}
              ou actualize.
            </p>
          ) : null}

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
            {gaMetricsReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Google Ads ligado
              </Badge>
            ) : null}
            {showMetaTiktokBadges && pipeline?.meta_capi_integration ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Meta OK
              </Badge>
            ) : null}
            {showMetaTiktokBadges && pipeline?.tiktok_events_integration ? (
              <Badge variant="secondary" className="text-xs font-normal">
                TikTok OK
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
