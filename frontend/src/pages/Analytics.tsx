import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bot, Building2, Link2, RefreshCw, Settings2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { analyticsService, GoogleAdsInsightsRequestError } from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { countryDisplayLabel, countryFlagEmoji } from "@/lib/countryDisplay";

function deviceDisplayLabel(device: string | null | undefined): string {
  if (!device) return "—";
  switch (device.toLowerCase().trim()) {
    case "desktop":
      return "Computador";
    case "mobile":
      return "Telemóvel";
    case "tablet":
      return "Tablet";
    case "bot":
      return "Bot";
    default:
      return device;
  }
}

const GOOGLE_ADS_INSIGHT_UNAVAILABLE_CODES = [
  "google_ads_platform_not_configured",
  "google_ads_oauth_required",
  "google_ads_customer_id_required",
] as const;

function isGoogleAdsInsightsUnavailableCode(code: string | null | undefined): boolean {
  return GOOGLE_ADS_INSIGHT_UNAVAILABLE_CODES.includes(
    code as (typeof GOOGLE_ADS_INSIGHT_UNAVAILABLE_CODES)[number],
  );
}

/** Compatibilidade com respostas antigas sem `code` no JSON. */
function isGoogleAdsReportingSetupMessage(message: string): boolean {
  const t = message.trim();
  return (
    t.startsWith("Os relatórios Google Ads ainda não estão ativos neste ambiente") ||
    t.startsWith("Para ver estes relatórios, ligue primeiro") ||
    t.startsWith("Para ver estes relatórios, indique o Customer ID") ||
    t.startsWith("Não é possível obter estes relatórios:")
  );
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatCostFromMicros(micros: number): string {
  if (!micros) return "—";
  return (micros / 1_000_000).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PresellsAnalyticsBody() {
  const { data: summaryData, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getSummary();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: recentClicks } = useQuery({
    queryKey: ["analytics-events-clicks"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getEvents({ event_type: "click", limit: 40 });
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  if (isLoading) return <LoadingState message="Carregando analytics..." />;
  if (isError) return <ErrorState message="Erro ao carregar analytics." onRetry={() => refetch()} />;

  if (!summaryData || summaryData.length === 0) {
    return (
      <EmptyState
        title="Sem dados de analytics"
        description="Os dados aparecerão aqui quando suas presells começarem a receber tráfego."
        icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  const totalClicks = summaryData.reduce((acc, s) => acc + s.clicks, 0);
  const totalImpressions = summaryData.reduce((acc, s) => acc + s.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const chartData = summaryData.map((s) => ({
    name: s.presell_id.slice(0, 8),
    cliques: s.clicks,
    impressoes: s.impressions,
  }));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-card-foreground">Resumo</h2>
          </div>
          <div className="space-y-5">
            {[
              { label: "Total de Cliques", value: totalClicks.toLocaleString() },
              { label: "Total de Impressões", value: totalImpressions.toLocaleString() },
              { label: "CTR Médio", value: `${avgCtr.toFixed(2)}%` },
              { label: "Páginas Ativas", value: String(summaryData.length) },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
              >
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-card-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-card-foreground">Performance por Página</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 88%)" />
                <XAxis dataKey="name" stroke="hsl(215 16% 47%)" fontSize={12} />
                <YAxis stroke="hsl(215 16% 47%)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 100%)",
                    border: "1px solid hsl(38 20% 88%)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="cliques" fill="hsl(172 66% 38%)" radius={[4, 4, 0, 0]} name="Cliques" />
                <Bar
                  dataKey="impressoes"
                  fill="hsl(28 92% 48% / 0.4)"
                  radius={[4, 4, 0, 0]}
                  name="Impressões"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-card border border-border/50 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-card-foreground">Últimos cliques</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Inclui IP, país e tipo de dispositivo. Tráfego automático (crawlers, pré-visualizações) aparece como{" "}
          <Badge variant="secondary" className="mx-0.5">
            bot
          </Badge>{" "}
          com etiqueta.
        </p>
        {!recentClicks?.length ? (
          <p className="text-sm text-muted-foreground">Sem cliques registados ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium">Data</th>
                  <th className="py-2.5 px-3 font-medium">IP</th>
                  <th className="py-2.5 px-3 font-medium">País</th>
                  <th className="py-2.5 px-3 font-medium">Dispositivo</th>
                  <th className="py-2.5 px-3 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {recentClicks.map((ev) => (
                  <tr key={ev.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 px-3 text-xs whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("pt-PT")}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px]">{ev.ip_address || "—"}</td>
                    <td className="py-2 px-3 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-base leading-none" aria-hidden>
                          {countryFlagEmoji(ev.country)}
                        </span>
                        <span>{countryDisplayLabel(ev.country)}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs">{deviceDisplayLabel(ev.device)}</td>
                    <td className="py-2 px-3">
                      {ev.is_bot ? (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          <Badge variant="default" className="text-[10px] font-normal">
                            Bot
                          </Badge>
                          {ev.bot_label ? (
                            <span className="text-[11px] text-muted-foreground">{ev.bot_label}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Humano</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function GoogleAdsInsightsPanel() {
  const initial = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["analytics-google-ads-insights", from, to],
    queryFn: async () => {
      const { data: d, error: err, errorCode } = await analyticsService.getGoogleAdsInsights({ from, to });
      if (err) throw new GoogleAdsInsightsRequestError(err, errorCode ?? null);
      if (!d) throw new GoogleAdsInsightsRequestError("Resposta vazia", null);
      return d;
    },
    retry: 1,
  });

  const insightErr = error instanceof GoogleAdsInsightsRequestError ? error : null;
  const errCode = insightErr?.errorCode ?? null;
  const errMsg = error instanceof Error ? error.message : "Erro ao carregar.";
  const softUnavailable =
    isError &&
    (isGoogleAdsInsightsUnavailableCode(errCode) || (errCode == null && isGoogleAdsReportingSetupMessage(errMsg)));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5 min-w-0 sm:w-44">
              <Label className="text-xs font-medium text-muted-foreground">Data inicial</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-background" />
            </div>
            <div className="space-y-1.5 min-w-0 sm:w-44">
              <Label className="text-xs font-medium text-muted-foreground">Data final</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-background" />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="gap-2 w-full sm:w-auto shrink-0"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar relatórios
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed max-w-3xl">
          Com a integração Google Ads ativa na sua conta, estes relatórios mostram dados em tempo real via{" "}
          <span className="text-foreground/90 font-medium">Google Ads API</span> (palavras-chave, termos de pesquisa e
          demografia) para o intervalo selecionado. A configuração faz-se em{" "}
          <Link to="/tracking/dashboard" className="text-primary font-medium underline underline-offset-2">
            Resumo e guia
          </Link>
          . Até <span className="text-foreground/90 font-medium">2000</span> linhas por relatório após agregação no período.
        </p>
      </div>

      {isLoading ? <LoadingState message="A carregar Google Ads…" /> : null}
      {isError && softUnavailable ? (
        <div
          className="rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 p-5 sm:p-6 max-w-2xl"
          role="status"
        >
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
              {errCode === "google_ads_platform_not_configured" ? (
                <Building2 className="h-5 w-5" aria-hidden />
              ) : errCode === "google_ads_oauth_required" ? (
                <Link2 className="h-5 w-5" aria-hidden />
              ) : (
                <Settings2 className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {errCode === "google_ads_platform_not_configured"
                    ? "Relatórios Google Ads indisponíveis neste ambiente"
                    : errCode === "google_ads_oauth_required"
                      ? "Ligue a sua conta Google"
                      : errCode === "google_ads_customer_id_required"
                        ? "Indique o Customer ID da conta"
                        : "Configuração Google Ads necessária"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{errMsg}</p>
                {errCode === "google_ads_platform_not_configured" ? (
                  <details className="mt-3 rounded-lg border border-amber-500/20 bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer select-none font-medium text-foreground/85">
                      Se gere o servidor da API (Railway, etc.)
                    </summary>
                    <p className="mt-2 leading-relaxed">
                      Os relatórios só funcionam depois de definir no <strong className="text-foreground/90">mesmo serviço</strong> que
                      corre o backend:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GOOGLE_ADS_DEVELOPER_TOKEN</code>,{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GOOGLE_ADS_CLIENT_ID</code> e{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GOOGLE_ADS_CLIENT_SECRET</code>
                      (ver <code className="rounded bg-muted px-1 py-0.5 text-[10px]">backend/.env.example</code>). Faça{" "}
                      <strong className="text-foreground/90">redeploy</strong>. Em seguida, cada conta liga OAuth e Customer ID em
                      Resumo e guia.
                    </p>
                  </details>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  variant={errCode === "google_ads_platform_not_configured" ? "outline" : "default"}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Link to="/tracking/dashboard">
                    {errCode === "google_ads_platform_not_configured" ? "Abrir Resumo e guia" : "Ir para Resumo e guia"}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isError && !softUnavailable ? (
        <Alert variant="destructive" className="max-w-2xl">
          <AlertTitle>Não foi possível obter os dados</AlertTitle>
          <AlertDescription className="text-sm">{errMsg}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <p className="text-[11px] text-muted-foreground">
            Sincronizado: {new Date(data.synced_at).toLocaleString("pt-PT")} · Período pedido: {data.period.from} →{" "}
            {data.period.to}
          </p>
          <Tabs defaultValue="keywords" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 w-full sm:w-auto justify-start">
              <TabsTrigger value="keywords">Palavras-chave</TabsTrigger>
              <TabsTrigger value="search_terms">Termos de pesquisa</TabsTrigger>
              <TabsTrigger value="demographics">Demografia</TabsTrigger>
            </TabsList>

            <TabsContent value="keywords" className="mt-4">
              {data.keywords.ok ? (
                <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="py-2.5 px-3 font-medium">Campanha</th>
                        <th className="py-2.5 px-3 font-medium">Grupo</th>
                        <th className="py-2.5 px-3 font-medium">Palavra-chave</th>
                        <th className="py-2.5 px-3 font-medium text-right">Impressões</th>
                        <th className="py-2.5 px-3 font-medium text-right">Cliques</th>
                        <th className="py-2.5 px-3 font-medium text-right">Custo*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.keywords.rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                            Sem linhas neste período (ou sem palavras com impressões).
                          </td>
                        </tr>
                      ) : (
                        data.keywords.rows.map((r, i) => (
                          <tr key={`${r.campaign}-${r.ad_group}-${r.keyword}-${i}`} className="border-b border-border/40">
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.campaign}>
                              {r.campaign}
                            </td>
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.ad_group}>
                              {r.ad_group}
                            </td>
                            <td className="py-2 px-3 font-medium">{r.keyword}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString("pt-PT")}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString("pt-PT")}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatCostFromMicros(r.cost_micros)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Palavras-chave</AlertTitle>
                  <AlertDescription className="text-sm">{data.keywords.error}</AlertDescription>
                </Alert>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                *Custo em unidades da conta (micros → valor; moeda da conta Google Ads).
              </p>
            </TabsContent>

            <TabsContent value="search_terms" className="mt-4">
              {data.search_terms.ok ? (
                <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="py-2.5 px-3 font-medium">Campanha</th>
                        <th className="py-2.5 px-3 font-medium">Grupo</th>
                        <th className="py-2.5 px-3 font-medium">Termo de pesquisa</th>
                        <th className="py-2.5 px-3 font-medium text-right">Impressões</th>
                        <th className="py-2.5 px-3 font-medium text-right">Cliques</th>
                        <th className="py-2.5 px-3 font-medium text-right">Custo*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.search_terms.rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                            Sem termos de pesquisa neste período.
                          </td>
                        </tr>
                      ) : (
                        data.search_terms.rows.map((r, i) => (
                          <tr key={`${r.campaign}-${r.ad_group}-${r.search_term}-${i}`} className="border-b border-border/40">
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.campaign}>
                              {r.campaign}
                            </td>
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.ad_group}>
                              {r.ad_group}
                            </td>
                            <td className="py-2 px-3">{r.search_term}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString("pt-PT")}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString("pt-PT")}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatCostFromMicros(r.cost_micros)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Termos de pesquisa</AlertTitle>
                  <AlertDescription className="text-sm">{data.search_terms.error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="demographics" className="mt-4">
              {data.demographics.ok ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Género</h3>
                    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                            <th className="py-2 px-3 font-medium">Campanha</th>
                            <th className="py-2 px-3 font-medium">Grupo</th>
                            <th className="py-2 px-3 font-medium">Segmento</th>
                            <th className="py-2 px-3 font-medium text-right">Impr.</th>
                            <th className="py-2 px-3 font-medium text-right">Cliques</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.demographics.gender.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-muted-foreground text-xs">
                                Sem dados de género (ou conta sem segmentação).
                              </td>
                            </tr>
                          ) : (
                            data.demographics.gender.map((r, i) => (
                              <tr key={`g-${i}`} className="border-b border-border/40">
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.campaign}>
                                  {r.campaign}
                                </td>
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.ad_group}>
                                  {r.ad_group}
                                </td>
                                <td className="py-2 px-3">{r.segment_label}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString("pt-PT")}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString("pt-PT")}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Idade</h3>
                    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                            <th className="py-2 px-3 font-medium">Campanha</th>
                            <th className="py-2 px-3 font-medium">Grupo</th>
                            <th className="py-2 px-3 font-medium">Faixa</th>
                            <th className="py-2 px-3 font-medium text-right">Impr.</th>
                            <th className="py-2 px-3 font-medium text-right">Cliques</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.demographics.age.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-muted-foreground text-xs">
                                Sem dados de idade.
                              </td>
                            </tr>
                          ) : (
                            data.demographics.age.map((r, i) => (
                              <tr key={`a-${i}`} className="border-b border-border/40">
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.campaign}>
                                  {r.campaign}
                                </td>
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.ad_group}>
                                  {r.ad_group}
                                </td>
                                <td className="py-2 px-3">{r.segment_label}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString("pt-PT")}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString("pt-PT")}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Demografia</AlertTitle>
                  <AlertDescription className="text-sm">{data.demographics.error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

export default function Analytics() {
  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Analytics"
        description="Presells no dclickora e, em separado, relatórios da conta Google Ads (mesmo intervalo de datas nos três separadores)."
      />

      <Tabs defaultValue="presells" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="presells">Presells (dclickora)</TabsTrigger>
          <TabsTrigger value="google_ads">Google Ads</TabsTrigger>
        </TabsList>
        <TabsContent value="presells" className="mt-0 space-y-0">
          <PresellsAnalyticsBody />
        </TabsContent>
        <TabsContent value="google_ads" className="mt-0">
          <GoogleAdsInsightsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
