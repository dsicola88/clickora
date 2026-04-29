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
  const conversions = dashboard?.total_conversions ?? 0;
  const approvedSales = dashboard?.approved_sales_count ?? 0;
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
        id: "presell",
        title: "1. Presell publicada",
        description:
          "Crie uma página intermédia (importando o link do produto ou no editor), depois passe a «Publicada». Use no anúncio o endereço público /p/… — os cliques já são contados nesta página.",
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
        title: "2. Link do anúncio (parâmetros opcionais)",
        description:
          "No Construtor de URL, copie o link completo ou o sufixo para colar no Google/Meta. O anúncio deve abrir a mesma página /p/… — os textos técnicos aparecem já prontos lá.",
        status: hasPublished ? "done" : "warn",
        actions: [
          { to: "/tracking/url-builder", label: "Construtor de URL" },
          { to: "/tracking/links", label: "Links de tracking" },
        ],
        hint: !hasPublished ? "Publique primeiro uma presell para copiar o URL base." : undefined,
      },
      {
        id: "clicks",
        title: "3. Fazer um teste rápido",
        description:
          "Numa janela anónima ou noutro telemóvel, abra a sua presell, clique no botão da oferta e volte aqui: em Resumo ou Relatórios deve aparecer pelo menos um clique (ajuste as datas se não vir nada).",
        status: clicks > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [
          { to: "/tracking/dashboard", label: "Resumo e guia" },
          { to: "/tracking/relatorios/cliques", label: "Relatório de cliques" },
        ],
        hint:
          clicks > 0
            ? `${clicks} clique(s) no período do resumo (~últimos 14 dias).`
            : "Ainda sem cliques neste período — faça um teste como acima ou alargue as datas no Resumo.",
      },
      {
        id: "postback",
        title: "4. Avisos de venda na rede de afiliados",
        description:
          "Em Plataformas aparece um endereço para colar na Hotmart ou rede semelhante — assim cada venda aprovada entra aqui e liga ao clique. Sem este passo, só vê cliques, não vendas.",
        status: approvedSales > 0 || conversions > 0 ? "done" : hasPublished ? "warn" : "pending",
        actions: [
          { to: "/tracking/plataformas", label: "Plataformas" },
          { to: "/tracking/tools/postbacks", label: "Modelos de postback" },
        ],
        hint: webhook?.hook_url
          ? approvedSales > 0 || conversions > 0
            ? "Há conversões registadas no período."
            : "Endereço pronto — confirme na rede que está guardado."
          : "Abra Plataformas para ver o endereço (ou confirmar permissões da conta).",
      },
      {
        id: "google",
        title: "5. Google Ads — contar vendas (opcional)",
        description:
          "Se investe em Google: no «Resumo e guia», ligue a sua conta Google Ads, confirme o número da conta e a conversão. Assim uma venda aprovada pode aparecer também no Google (quando há identificadores de clique). Importar ficheiros é outro caminho — aqui é o envio automático.",
        status: gaCanUpload ? "done" : gaHasOAuth && gaCustomer && gaEnv ? "warn" : "pending",
        actions: [{ to: "/tracking/dashboard", label: "Definições Google Ads" }],
        hint: !gaEnv
          ? "Neste ambiente a ligação automática com Google ainda não está activa — o administrador tem de concluir a configuração no servidor."
          : gaCanUpload
            ? "Tudo certo: conta ligada e envio pronto."
            : gaHasOAuth && gaCustomer
              ? "Falta um último passo no painel (activar envio ou confirmar o número da conversão)."
              : "Ligue a sua conta Google Ads e indique o número da conta (só dígitos).",
      },
      {
        id: "capi",
        title: "6. Meta e TikTok (opcional)",
        description:
          "Se anuncia no Facebook/Instagram ou TikTok, pode enviar também a compra para lá (no mesmo sítio que o Google). Só vale se o visitante entrou com o link que traz os identificadores da rede — configure no «Resumo e guia».",
        status: !metaTikTokDataReady
          ? "pending"
          : metaTikTokOptionalOk && !metaTikTokWarn
            ? "done"
            : metaTikTokWarn
              ? "warn"
              : "pending",
        actions: [
          { to: "/tracking/dashboard", label: "Resumo e guia" },
          { to: "/tracking/relatorios", label: "Relatórios (sync)" },
        ],
        hint: !metaTikTokDataReady
          ? "A obter o estado de Meta e TikTok… Se persistir, actualize a página ou confirme a sua sessão."
          : [
              `Meta: ${!metaEnabled ? "sem ligação (pode ignorar)." : metaReady ? "pronta." : "ligada — falta preencher Pixel e token no guia."}`,
              `TikTok: ${!ttEnabled ? "sem ligação (pode ignorar)." : ttReady ? "pronta." : "ligada — falta preencher Pixel e token no guia."}`,
            ].join(" "),
      },
      {
        id: "learn",
        title: "7. Ajuda e dúvidas",
        description:
          "No separador «Aprender» há guias por tema e respostas quando algo não bate certo (cliques, vendas, redes).",
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

  const coreSteps = steps.filter((x) => x.id !== "learn");
  const doneCount = coreSteps.filter((x) => x.status === "done").length;
  const warnCount = coreSteps.filter((x) => x.status === "warn").length;
  const showMetaTiktokBadges = metaCapi != null && tiktokEvents != null;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Assistente de configuração"
        description="Passo a passo simples. Os números de cliques e vendas seguem o mesmo período do Resumo (cerca de 14 dias)."
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
              Atualizar estado
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
              Não foi possível carregar o resumo de métricas. Os passos baseados em cliques e vendas podem não reflectar dados recentes — abra{" "}
              <Link to="/tracking/dashboard" className="font-medium underline underline-offset-2">
                Resumo e guia
              </Link>{" "}
              ou tente actualizar esta página.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="text-muted-foreground">
              Passos da checklist:{" "}
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
                Relatórios Google Ads ligados
              </Badge>
            ) : null}
            {showMetaTiktokBadges && pipeline?.meta_capi_integration ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Meta — definições completas
              </Badge>
            ) : null}
            {showMetaTiktokBadges && pipeline?.tiktok_events_integration ? (
              <Badge variant="secondary" className="text-xs font-normal">
                TikTok — definições completas
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
