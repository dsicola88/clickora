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
 * Assistente guiado: presell automática, tracking, postback e Google Ads —
 * com verificações baseadas nos dados da conta (últimos ~14 dias no dashboard).
 */
const SETUP_ASSISTANT_QUERY_PREFIXES = [
  "setup-assistant-presells",
  "setup-assistant-dashboard",
  "setup-assistant-google-ads",
  "setup-assistant-webhook",
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

  const loading = loadingPresells || loadingDash || loadingGa || loadingWh;

  const published = useMemo(
    () => (presells ?? []).filter((p) => p.status === "published"),
    [presells],
  );
  const hasPublished = published.length > 0;
  const clicks = dashboard?.total_clicks ?? 0;
  const conversions = dashboard?.total_conversions ?? 0;
  const approvedSales = dashboard?.approved_sales_count ?? 0;
  const pipeline = dashboard?.tracking_pipeline;
  const gaEnv = pipeline?.google_ads_api_env_configured ?? googleAds?.api_env_configured ?? false;
  const gaMetricsReady = pipeline?.google_ads_metrics_available ?? false;
  const gaCanUpload = googleAds?.can_upload ?? false;
  const gaHasOAuth = googleAds?.has_refresh_token ?? false;
  const gaCustomer = Boolean(googleAds?.google_ads_customer_id?.trim());

  const steps: SetupStep[] = useMemo(() => {
    const s: SetupStep[] = [
      {
        id: "presell",
        title: "1. Presell publicada",
        description:
          "Crie uma presell automática (URL do produto) ou manual, depois publique. O tráfego deve usar o link público /p/… — a medição base (pixel + redirect) está incluída nessa página.",
        status: hasPublished ? "done" : "pending",
        actions: [
          { to: "/presell/dashboard", label: "Abrir presells" },
          { to: "/presell/templates/editor", label: "Modelos" },
        ],
        hint: hasPublished
          ? `${published.length} página(s) publicada(s).`
          : "Nenhuma presell publicada nesta conta.",
      },
      {
        id: "urls",
        title: "2. URLs para anúncios (UTMs e Google)",
        description:
          "Monte o URL final da presell com UTMs e macros no Construtor de URL. No Google Ads: URL final só com /p/…; sufixo do URL final com os parâmetros gerados (botão «Copiar sufixo»).",
        status: hasPublished ? "done" : "warn",
        actions: [
          { to: "/tracking/url-builder", label: "Construtor de URL" },
          { to: "/tracking/links", label: "Links de tracking" },
        ],
        hint: !hasPublished ? "Publique primeiro uma presell para copiar o URL base." : undefined,
      },
      {
        id: "clicks",
        title: "3. Teste de cliques",
        description:
          "Abra a presell com ?utm_source=teste no anónimo, clique no CTA e confira em Relatórios ou no Resumo se há cliques no período.",
        status: clicks > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [
          { to: "/tracking/dashboard", label: "Resumo e guia" },
          { to: "/tracking/relatorios/cliques", label: "Relatório de cliques" },
        ],
        hint:
          clicks > 0
            ? `${clicks} clique(s) no período do resumo (~últimos 14 dias).`
            : "Ainda sem cliques no período — faça um teste ou alargue o intervalo no Resumo.",
      },
      {
        id: "postback",
        title: "4. Postback na rede de afiliados",
        description:
          "Em Plataformas, copie o URL do webhook e configure na rede (Hotmart, etc.) com o subid / click_id que o dclickora espera. Sem isto, vendas não ligam aos cliques.",
        status: approvedSales > 0 || conversions > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [
          { to: "/tracking/plataformas", label: "Plataformas" },
          { to: "/tracking/tools/postbacks", label: "Modelos de postback" },
        ],
        hint: webhook?.hook_url
          ? approvedSales > 0 || conversions > 0
            ? "Há conversões registadas no período."
            : "Webhook disponível — confirme na rede que o postback está activo."
          : "Abra Plataformas para ver o URL do webhook (ou verifique permissões da conta).",
      },
      {
        id: "google",
        title: "5. Google Ads — envio de conversões",
        description:
          "Em Resumo e guia: ligue OAuth, indique Customer ID e acção de conversão (upload por clique). O servidor envia conversões aprovadas quando há gclid no clique. Relatórios GAQL são opcionais (Analytics → Google Ads).",
        status: gaCanUpload ? "done" : gaHasOAuth && gaCustomer && gaEnv ? "warn" : "pending",
        actions: [{ to: "/tracking/dashboard", label: "Configurar Google Ads" }],
        hint: !gaEnv
          ? "API Google Ads no servidor ainda não configurada (admin) — upload automático pode estar indisponível."
          : gaCanUpload
            ? "Upload automático pronto (OAuth + ID + acção)."
            : gaHasOAuth && gaCustomer
              ? "Falta acção de conversão ou activar envio — veja Resumo e guia."
              : "Ligue a conta Google e preencha o Customer ID.",
      },
      {
        id: "learn",
        title: "6. Ajuda e resolução de problemas",
        description:
          "Centro «Aprender» com categorias, pesquisa e secção de resolução de problemas (GCLID, blacklist, postback).",
        status: "pending",
        actions: [
          { to: "/ajuda", label: "Aprender" },
          { to: "/ajuda#problemas", label: "Resolução de problemas" },
        ],
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
  ]);

  const coreSteps = steps.filter((x) => x.id !== "learn");
  const doneCount = coreSteps.filter((x) => x.status === "done").length;
  const warnCount = coreSteps.filter((x) => x.status === "warn").length;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Assistente de configuração"
        description="Checklist para presell automática, rastreamento, postback e Google Ads. Os passos 3–5 usam dados do resumo (~últimos 14 dias) e da sua conta — actualize após testar."
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
              Atualizar verificações
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/ajuda">
                <LayoutList className="h-4 w-4" />
                Aprender
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
              Não foi possível carregar o resumo de métricas. Os passos 3–5 podem não reflectar cliques recentes — abra{" "}
              <Link to="/tracking/dashboard" className="font-medium underline underline-offset-2">
                Resumo e guia
              </Link>{" "}
              ou tente actualizar esta página.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="text-muted-foreground">
              Progresso (passos 1–5):{" "}
              <strong className="text-foreground">
                {doneCount}/{coreSteps.length}
              </strong>{" "}
              OK
              {warnCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-amber-700 dark:text-amber-400">
                    {warnCount} precisam de atenção
                  </span>
                </>
              ) : null}
            </span>
            {gaMetricsReady ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Relatórios Google Ads (API) disponíveis
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
