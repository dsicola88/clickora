import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  MousePointerClick,
  Eye,
  TrendingUp,
  ShoppingCart,
  Copy,
  Check,
  Code,
  FileDown,
  LayoutDashboard,
  ArrowRight,
  Target,
  Loader2,
  BarChart3,
  Link2,
  Info,
  Globe,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { analyticsService } from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { integrationsService } from "@/services/integrationsService";
import { Switch } from "@/components/ui/switch";
import { getApiBaseUrl } from "@/lib/apiOrigin";

/** Data local (YYYY-MM-DD) — evita deslocar o dia/ano vs UTC em <input type="date">. */
function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { start: formatDateInput(start), end: formatDateInput(end) };
}

/** Nome do país (ISO 3166-1 alpha-2) para o painel. */
function countryDisplayName(code: string | null): string {
  if (!code) return "Desconhecido";
  try {
    return new Intl.DisplayNames(["pt-PT"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

type DashboardGoogleGeoInput = {
  google_ads_metrics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost_micros: number;
  } | null;
  google_ads_metrics_error?: string | null;
  clicks_by_country?: Array<{ country_code: string | null; clicks: number }>;
  tracking_pipeline?: { google_ads_metrics_available?: boolean };
};

function DashboardGoogleGeoSection({ dashboard }: { dashboard: DashboardGoogleGeoInput | null | undefined }) {
  const g = dashboard?.google_ads_metrics;
  const err = dashboard?.google_ads_metrics_error;
  const countries = dashboard?.clicks_by_country ?? [];
  const canGoogle = dashboard?.tracking_pipeline?.google_ads_metrics_available;
  const showGoogleBlock = g != null || err || canGoogle;
  const showGeo = countries.length > 0;
  if (!showGoogleBlock && !showGeo) return null;

  return (
    <div className="space-y-4">
      {showGoogleBlock ? (
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="font-semibold text-card-foreground">Google Ads (conta)</h3>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Métricas oficiais da conta Google Ads no mesmo período (API de relatórios).
              </p>
            </div>
          </div>
          {err ? (
            <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">{err}</p>
          ) : null}
          {g ? (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Impressões</dt>
                <dd className="font-semibold tabular-nums">{g.impressions.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Cliques</dt>
                <dd className="font-semibold tabular-nums">{g.clicks.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Conversões</dt>
                <dd className="font-semibold tabular-nums">{Number(g.conversions).toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Custo (conta)</dt>
                <dd className="font-semibold tabular-nums">{(g.cost_micros / 1_000_000).toFixed(2)}</dd>
              </div>
            </dl>
          ) : !err && !canGoogle ? (
            <p className="text-xs text-muted-foreground">
              Define Customer ID e OAuth em Tracking → Google Ads para carregar métricas da rede.
            </p>
          ) : !err && canGoogle && !g ? (
            <p className="text-xs text-muted-foreground">Sem dados da API para este período.</p>
          ) : null}
        </div>
      ) : null}

      {showGeo ? (
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="font-semibold text-card-foreground">Cliques por país</h3>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Derivado do IP em cada clique (base GeoLite2 no servidor). IPs locais ou desconhecidos aparecem como Desconhecido.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">País</th>
                  <th className="px-3 py-2 font-medium text-right">Cliques</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((row, i) => (
                  <tr key={`${row.country_code ?? "x"}-${i}`} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">{countryDisplayName(row.country_code)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{row.clicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : showGoogleBlock ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 md:p-6">
          <p className="text-sm text-muted-foreground">
            Ainda não há cliques com país neste período. Os novos eventos passam a guardar o país automaticamente.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CopyFieldRow({
  value,
  disabled,
  copied,
  onCopy,
  id,
}: {
  value: string;
  disabled?: boolean;
  copied: boolean;
  onCopy: () => void;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <Input id={id} value={value} readOnly className="font-mono text-xs sm:text-sm bg-background/80 border-border/80 h-11 sm:h-10" />
      <Button
        type="button"
        variant="default"
        className="shrink-0 gap-2 sm:min-w-[7.5rem] shadow-sm"
        disabled={disabled}
        onClick={onCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export default function TrackingDashboard() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const apiBase = getApiBaseUrl();
  /** Alinhado ao botão «Últimos 30 dias» (intervalo inicial ao abrir a página). */
  const initialRange = useMemo(() => defaultDateRange(), []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [gaEnabled, setGaEnabled] = useState(false);
  const [gaCustomerId, setGaCustomerId] = useState("");
  const [gaActionId, setGaActionId] = useState("");
  const [gaLoginMcc, setGaLoginMcc] = useState("");
  const [gaRefresh, setGaRefresh] = useState("");

  const firstName = user?.name?.trim()?.split(/\s+/)[0];

  const handleStartDateChange = useCallback(
    (value: string) => {
      setStartDate(value);
      if (value > endDate) {
        setEndDate(value);
        toast.info("A data final foi ajustada: não pode ser anterior à inicial.");
      }
    },
    [endDate],
  );

  const handleEndDateChange = useCallback(
    (value: string) => {
      setEndDate(value);
      if (value < startDate) {
        setStartDate(value);
        toast.info("A data inicial foi ajustada: não pode ser posterior à final.");
      }
    },
    [startDate],
  );

  const { data: googleAds } = useQuery({
    queryKey: ["integrations-google-ads"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getGoogleAdsSettings();
      if (err) throw new Error(err);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });

  useEffect(() => {
    if (!isAdmin || !googleAds) return;
    setGaEnabled(googleAds.google_ads_enabled);
    setGaCustomerId(googleAds.google_ads_customer_id);
    setGaActionId(googleAds.google_ads_conversion_action_id);
    setGaLoginMcc(googleAds.google_ads_login_customer_id);
    setGaRefresh("");
  }, [isAdmin, googleAds]);

  const saveGoogleAds = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchGoogleAdsSettings({
        google_ads_enabled: gaEnabled,
        google_ads_customer_id: gaCustomerId,
        google_ads_conversion_action_id: gaActionId,
        google_ads_login_customer_id: gaLoginMcc,
        ...(gaRefresh.trim() ? { google_ads_refresh_token: gaRefresh.trim() } : {}),
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success("Definições Google Ads guardadas.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-google-ads"] });
      setGaRefresh("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tracking-dashboard", startDate, endDate],
    queryFn: async () => {
      const { data, error: err } = await analyticsService.getDashboard({ from: startDate, to: endDate });
      if (err) {
        toast.error(err, { id: "analytics-dashboard-error" });
        throw new Error(err);
      }
      return data;
    },
    retry: (failureCount, err) => {
      const msg = err instanceof Error ? err.message : "";
      if (/intervalo|inválido|inválida|formato yyyy-mm-dd/i.test(msg)) return false;
      return failureCount < 2;
    },
  });

  const resolvedEmbedSrc = useMemo(() => {
    const fromApi = dashboard?.tracking_install?.embed_js_url;
    let src = fromApi || `${apiBase.replace(/\/$/, "")}/track/v2/clickora.min.js`;
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const onLocalDev = host === "localhost" || host === "127.0.0.1";
      const apiIsRemote = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiBase);
      if (!onLocalDev && apiIsRemote && /localhost|127\.0\.0\.1/.test(src)) {
        src = `${apiBase.replace(/\/$/, "")}/track/v2/clickora.min.js`;
      }
    }
    return src;
  }, [dashboard?.tracking_install?.embed_js_url, apiBase]);

  const embedSrcWasPatched = useMemo(() => {
    const fromApi = dashboard?.tracking_install?.embed_js_url;
    return Boolean(fromApi && fromApi !== resolvedEmbedSrc);
  }, [dashboard?.tracking_install?.embed_js_url, resolvedEmbedSrc]);

  const trackingScript = useMemo(() => {
    const uid = dashboard?.tracking_install?.user_id || user?.id;
    if (!uid) return "";
    return `<script src="${resolvedEmbedSrc}" data-id="${uid}"></script>`;
  }, [dashboard?.tracking_install?.user_id, user?.id, resolvedEmbedSrc]);

  const scriptStillLocalhostOnDeploy = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const onLocalDev = host === "localhost" || host === "127.0.0.1";
    return !onLocalDev && /localhost|127\.0\.0\.1/.test(resolvedEmbedSrc);
  }, [resolvedEmbedSrc]);

  const csvUploadUrl = useMemo(() => {
    const raw = dashboard?.tracking_install?.csv_upload_url ?? "";
    if (!raw) return "";
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const onLocalDev = host === "localhost" || host === "127.0.0.1";
      const apiIsRemote = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiBase);
      if (!onLocalDev && apiIsRemote && /localhost|127\.0\.0\.1/.test(raw)) {
        try {
          const u = new URL(raw);
          const token = u.searchParams.get("token");
          if (token) {
            const base = apiBase.replace(/\/$/, "");
            return `${base}/track/conversions/csv?token=${encodeURIComponent(token)}`;
          }
        } catch {
          /* ignore */
        }
      }
    }
    return raw;
  }, [dashboard?.tracking_install?.csv_upload_url, apiBase]);

  const handleCopy = (text: string, type: "script" | "csv") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2000);
    }
    toast.success("Copiado!");
  };

  if (isLoading) return <LoadingState message="Carregando dashboard..." />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Erro ao carregar o dashboard."}
        onRetry={() => refetch()}
      />
    );
  }

  const chartData =
    dashboard?.chart_data?.map((d) => ({
      name: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      cliques: d.clicks,
      impressoes: d.impressions,
    })) ?? [];

  const periodLabel = dashboard?.period
    ? `${new Date(dashboard.period.from + "T12:00:00").toLocaleDateString("pt-BR")} — ${new Date(dashboard.period.to + "T12:00:00").toLocaleDateString("pt-BR")}`
    : null;

  const revenue = dashboard?.revenue ?? 0;
  const csvPlaceholder = dashboard ? "Atualize a API para obter o link com token." : "Carregando…";

  /** Vista simples para assinantes: sem scripts, CSV, Google Ads nem avisos de servidor. */
  if (!isAdmin) {
    return (
      <div className={cn(APP_PAGE_SHELL, "space-y-8")}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {firstName ? `Olá, ${firstName}` : "Bem-vindo"}
          </h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { to: "/tracking/analytics", title: "Ver números", color: "from-primary/15 to-primary/5", icon: BarChart3 },
              { to: "/presell/dashboard", title: "Presells", color: "from-violet-500/15 to-violet-500/5", icon: LayoutDashboard },
              { to: "/tracking/links", title: "Links de tracking", color: "from-emerald-500/15 to-emerald-500/5", icon: Link2 },
              { to: "/tracking/vendas", title: "Vendas", color: "from-amber-500/15 to-amber-500/5", icon: ShoppingCart },
            ] as const
          ).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
              )}
            >
              <div
                className={cn(
                  "mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-primary",
                  item.color,
                )}
              >
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">{item.title}</h3>
              <ArrowRight className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_min(320px,100%)] lg:items-stretch">
          <Card className="border-border/80 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-sm font-semibold text-foreground">Período</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="h-11" />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  const r = defaultDateRange();
                  setStartDate(r.start);
                  setEndDate(r.end);
                }}
              >
                Últimos 30 dias
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-gradient-to-br from-emerald-500/[0.07] to-card shadow-sm">
            <CardContent className="space-y-3 p-6">
              <p className="text-sm text-muted-foreground">Conversões (valor registado)</p>
              <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                $ {revenue.toFixed(2)}
                <span className="text-lg font-normal text-muted-foreground"> USD</span>
              </p>
              {periodLabel ? (
                <Badge variant="secondary" className="font-normal">
                  {periodLabel}
                </Badge>
              ) : null}
              <Button className="w-full gap-2 rounded-xl" asChild>
                <Link to="/tracking/analytics">
                  Analytics
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <section
          aria-labelledby="tracking-metrics-heading"
          className="space-y-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-7"
        >
          <div className="space-y-1.5 border-b border-border/50 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Desempenho</p>
            <h2 id="tracking-metrics-heading" className="text-lg font-semibold tracking-tight text-foreground">
              Métricas do período
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Totais de cliques e conversões, dados da conta Google Ads e cliques por país, mais a evolução no gráfico.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Cliques" value={dashboard?.total_clicks?.toLocaleString() ?? "0"} change="" changeType="positive" icon={MousePointerClick} />
            <MetricCard title="Impressões" value={dashboard?.total_impressions?.toLocaleString() ?? "0"} change="" changeType="positive" icon={Eye} />
            <MetricCard title="CTR" value={`${(dashboard?.ctr ?? 0).toFixed(1)}%`} change="" changeType="positive" icon={TrendingUp} />
            <MetricCard title="Conversões" value={dashboard?.total_conversions?.toLocaleString() ?? "0"} change="" changeType="positive" icon={ShoppingCart} />
          </div>

          <DashboardGoogleGeoSection dashboard={dashboard} />

          {chartData.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
              <h3 className="text-base font-semibold text-card-foreground mb-4">Cliques e impressões</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="subCliques" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(172 66% 38%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(172 66% 38%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="subImps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(28 92% 48%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(28 92% 48%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 88%)" />
                    <XAxis dataKey="name" stroke="hsl(215 16% 47%)" fontSize={12} />
                    <YAxis stroke="hsl(215 16% 47%)" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(38 20% 88%)", borderRadius: "0.5rem" }} />
                    <Legend />
                    <Area type="monotone" dataKey="impressoes" stroke="hsl(28 92% 48%)" fill="url(#subImps)" strokeWidth={2} name="Impressões" />
                    <Area type="monotone" dataKey="cliques" stroke="hsl(172 66% 38%)" fill="url(#subCliques)" strokeWidth={2} name="Cliques" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={cn(APP_PAGE_SHELL, "space-y-8")}>
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Guia — instalação na presell</h2>
          <ol className="mt-3 list-decimal list-outside space-y-2 pl-5 text-sm text-muted-foreground max-w-3xl marker:font-semibold marker:text-foreground">
            <li>
              <strong className="text-foreground/90">Presell publicada:</strong> cola o <strong className="text-foreground/90">script</strong> (passo 2 desta página)
              no HTML da página; o teu ID está em <span className="font-mono text-[11px]">data-id</span>.
            </li>
            <li>
              <strong className="text-foreground/90">Google Ads:</strong> na campanha, <strong className="text-foreground/90">URL final</strong> = URL
              público da presell — o Google acrescenta o <span className="font-mono text-[11px]">gclid</span> ao clicar no anúncio.
            </li>
            <li>
              <strong className="text-foreground/90">Rede de afiliados:</strong> em{" "}
              <strong className="text-foreground/90">Meu rastreamento → Plataformas</strong>, copia o postback e cola no painel da rede (Postback / IPN).
              Inclui o identificador de clique (ex.{" "}
              <span className="font-mono text-[11px]">{"subid1={SUBID}"}</span> ou o que a rede mostrar).
            </li>
            <li>
              <strong className="text-foreground/90">CSV (opcional):</strong> importação manual de conversões — usa <strong className="text-foreground/90">POST</strong>{" "}
              com o URL à esquerda; <strong className="text-foreground/90">GET</strong> só testa o token.
            </li>
            <li>
              <strong className="text-foreground/90">Enviar vendas ao Google Ads:</strong> preenche o bloco <strong className="text-foreground/90">Google Ads</strong>{" "}
              abaixo (conta, ação de conversão, OAuth).
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3 max-w-3xl">
            API pública: <span className="font-mono text-[11px]">{apiBase}</span> (mesmo host do script e do CSV).
          </p>
        </div>
        <h3 className="text-base font-semibold text-foreground">Script e CSV</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-shadow hover:shadow-md md:p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileDown className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground">URL de conversões (CSV)</h3>
              </div>
            </div>
            <CopyFieldRow
              id="csv-url"
              value={csvUploadUrl || csvPlaceholder}
              disabled={!csvUploadUrl}
              copied={copiedCsv}
              onCopy={() => csvUploadUrl && handleCopy(csvUploadUrl, "csv")}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              <strong className="text-foreground/90">POST</strong> com o CSV no corpo importa linhas;{" "}
              <strong className="text-foreground/90">GET</strong> no mesmo URL só confirma que o{" "}
              <span className="font-mono">token</span> é válido (resposta JSON).
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Não partilhes o token.</p>
          </div>

          <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-shadow hover:shadow-md md:p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <Code className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground">Script da presell</h3>
              </div>
            </div>
            {embedSrcWasPatched && (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                URL do script ajustada via <span className="font-mono">VITE_API_URL</span>. Em produção define <span className="font-mono">API_PUBLIC_URL</span> no servidor.
              </p>
            )}
            {scriptStillLocalhostOnDeploy && (
              <p className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">
                O script aponta para <span className="font-mono">localhost</span> no site público — corrige <span className="font-mono">VITE_API_URL</span> / <span className="font-mono">API_PUBLIC_URL</span>.
              </p>
            )}
            <CopyFieldRow
              id="tracking-script"
              value={trackingScript || "Carregando credenciais…"}
              disabled={!trackingScript}
              copied={copiedScript}
              onCopy={() => trackingScript && handleCopy(trackingScript, "script")}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="font-semibold text-card-foreground">Google Ads</h3>
              <p className="text-xs text-muted-foreground">
                Envio automático de conversões offline (API de upload de cliques) após venda aprovada no webhook de afiliados.
              </p>
            </div>
          </div>

          <Alert className="border-blue-500/25 bg-blue-500/[0.06] px-3 py-3">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-sm text-foreground">Como é feito</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
              <ol className="list-decimal list-inside space-y-1.5 mt-2">
                <li>
                  O tráfego pago traz <span className="font-mono text-[11px]">gclid</span> (ou <span className="font-mono text-[11px]">gbraid</span>/
                  <span className="font-mono text-[11px]">wbraid</span>) até à presell e o clique no CTA regista esse ID no servidor.
                </li>
                <li>
                  A rede de afiliados devolve o postback com o mesmo UUID de clique (<span className="font-mono text-[11px]">clickora_click_id</span> / subids).
                </li>
                <li>
                  O dclickora valida o clique, cria a conversão e chama a <strong className="text-foreground/90">Google Ads API</strong>{" "}
                  (<span className="font-mono text-[11px]">uploadClickConversions</span>) com o ID de clique do Google e o valor da venda.
                </li>
                <li>
                  O estado fica registado na conversão (enviado ou falha); erros parciais da API são tratados e guardados para diagnóstico.
                </li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-3 space-y-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground text-sm">Conta simples vs conta gestora (MCC)</p>
            <ul className="space-y-2 leading-relaxed list-disc list-inside">
              <li>
                <strong className="text-foreground/90">Conta simples:</strong> em <strong className="text-foreground/90">Customer ID</strong> cola o ID da
                própria conta Google Ads (10 dígitos). Deixa <strong className="text-foreground/90">Login customer ID</strong> vazio. O OAuth (refresh token)
                deve ser da mesma conta.
              </li>
              <li>
                <strong className="text-foreground/90">Via MCC:</strong> <strong className="text-foreground/90">Customer ID</strong> é sempre o da{" "}
                <em>conta cliente</em> onde está a campanha e a ação de conversão. Em <strong className="text-foreground/90">Login customer ID</strong> cola o
                ID da <em>conta gestora</em> com que o OAuth entra. O refresh token deve ter acesso a essa gestão.
              </li>
            </ul>
            <p className="text-[11px] pt-1 border-t border-border/50">
              <strong className="text-foreground/90">Importante:</strong> o MCC deve ser configurado aqui por perfil — não depender de variáveis globais no
              servidor para contas mistas, para o envio não falhar em contas diretas.
            </p>
          </div>

          {!googleAds?.api_env_configured && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
              Variáveis <span className="font-mono">GOOGLE_ADS_DEVELOPER_TOKEN</span>, <span className="font-mono">CLIENT_ID</span> e{" "}
              <span className="font-mono">CLIENT_SECRET</span> são obrigatórias no servidor; o refresh pode vir do utilizador abaixo ou de{" "}
              <span className="font-mono">GOOGLE_ADS_REFRESH_TOKEN</span> no ambiente.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Switch id="ga-enabled" checked={gaEnabled} onCheckedChange={setGaEnabled} />
            <Label htmlFor="ga-enabled" className="text-sm cursor-pointer">
              Ativar envio após venda aprovada
            </Label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Customer ID</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Conta Google Ads onde criaste a ação de conversão (10 dígitos, só números). Em MCC: conta <em>cliente</em>, não a gestora.
              </p>
              <Input
                value={gaCustomerId}
                onChange={(e) => setGaCustomerId(e.target.value)}
                placeholder="1234567890"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">ID da ação de conversão</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                ID numérico da ação (Ferramentas → Conversões). Deve ser compatível com <strong className="text-foreground/90">conversões offline / importação por clique</strong> (gclid).
              </p>
              <Input
                value={gaActionId}
                onChange={(e) => setGaActionId(e.target.value)}
                placeholder="número em Ferramentas → Conversões"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Login customer ID (MCC, opcional)</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Só se o acesso à API for através de uma conta gestora. Vazio = OAuth da própria conta em Customer ID.
              </p>
              <Input
                value={gaLoginMcc}
                onChange={(e) => setGaLoginMcc(e.target.value)}
                placeholder="ID da conta gestora (10 dígitos) ou vazio"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Refresh token OAuth (opcional)</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Credencial OAuth com âmbito Google Ads. Em branco mantém o token já guardado; preenche para ligar ou atualizar esta conta.
              </p>
              <Input
                type="password"
                value={gaRefresh}
                onChange={(e) => setGaRefresh(e.target.value)}
                placeholder="vazio = não alterar; cola o token OAuth desta conta"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => saveGoogleAds.mutate()} disabled={saveGoogleAds.isPending} className="gap-2">
              {saveGoogleAds.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar Google Ads
            </Button>
            {googleAds?.can_upload ? (
              <Badge variant="secondary" className="font-normal">
                Pronto para enviar
              </Badge>
            ) : (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Configuração incompleta
              </Badge>
            )}
            {googleAds?.has_refresh_token ? (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Refresh token OK
              </Badge>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            O estado <strong className="text-foreground/90">Pronto para enviar</strong> exige integração ativa, customer e ação de conversão, refresh token
            (utilizador ou servidor) e credenciais API no backend.
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.08] via-background to-violet-500/[0.07] shadow-sm">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_min(340px,100%)] lg:items-center lg:gap-10">
          <div className="min-w-0 space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-[2rem] lg:leading-tight">
              {firstName ? `Bem-vindo, ${firstName}` : "Bem-vindo ao rastreamento"}
            </h1>
            {dashboard?.tracking_pipeline ? (
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-3 sm:px-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Estado</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      { ok: dashboard.tracking_pipeline.click_tracking, label: "Rastreamento de clique" },
                      { ok: dashboard.tracking_pipeline.campaign_tracking, label: "Rastreamento de campanha" },
                      { ok: dashboard.tracking_pipeline.sale_tracking, label: "Rastreamento de venda" },
                      { ok: dashboard.tracking_pipeline.google_ads_integration, label: "Integração Google Ads" },
                    ] as const
                  ).map((row) => (
                    <li key={row.label} className="flex items-center gap-2 text-xs text-foreground">
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                          row.ok ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {row.ok ? <Check className="h-3 w-3" strokeWidth={3} /> : "—"}
                      </span>
                      {row.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/presell/dashboard">Presell</Link>
              </Button>
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/tracking/links">Links</Link>
              </Button>
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/tracking/analytics">Analytics</Link>
              </Button>
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/tracking/tools">Tools</Link>
              </Button>
            </div>
          </div>

          <Card className="border-border/80 bg-card/90 shadow-lg shadow-primary/5 backdrop-blur-sm">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Neste período você converteu</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 md:text-4xl">
                    $ {revenue.toFixed(2)}
                    <span className="text-lg font-normal text-muted-foreground md:text-xl"> USD</span>
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
              </div>
              {periodLabel ? (
                <Badge variant="secondary" className="font-normal text-muted-foreground">
                  {periodLabel}
                </Badge>
              ) : null}
              <Button className="w-full gap-2 rounded-xl" asChild>
                <Link to="/tracking/analytics">
                  Analytics
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <div>
        <h2 className="text-lg font-semibold text-foreground">Resumo do período</h2>
        <ol className="mt-2 list-decimal list-outside space-y-1 pl-5 text-sm text-muted-foreground marker:font-semibold marker:text-foreground max-w-xl">
          <li>Define <strong className="text-foreground/90">data inicial</strong> e <strong className="text-foreground/90">final</strong> (ou &quot;Últimos 30 dias&quot;).</li>
          <li>Consulta os <strong className="text-foreground/90">números</strong> e o gráfico abaixo.</li>
          <li>Para mais detalhe, abre <strong className="text-foreground/90">Analytics</strong> no cartão acima ou no menu.</li>
        </ol>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Período</h3>
              {periodLabel ? <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto shrink-0"
              onClick={() => {
                const r = defaultDateRange();
                setStartDate(r.start);
                setEndDate(r.end);
              }}
            >
              Últimos 30 dias
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      <section
        aria-labelledby="tracking-metrics-heading-admin"
        className="space-y-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-7"
      >
        <div className="space-y-1.5 border-b border-border/50 pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Desempenho</p>
          <h2 id="tracking-metrics-heading-admin" className="text-lg font-semibold tracking-tight text-foreground">
            Métricas do período
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Totais de cliques e conversões, dados da conta Google Ads e cliques por país, mais a evolução no gráfico.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Cliques (período)" value={dashboard?.total_clicks?.toLocaleString() ?? "0"} change="" changeType="positive" icon={MousePointerClick} />
          <MetricCard title="Impressões (período)" value={dashboard?.total_impressions?.toLocaleString() ?? "0"} change="" changeType="positive" icon={Eye} />
          <MetricCard title="CTR (período)" value={`${(dashboard?.ctr ?? 0).toFixed(1)}%`} change="" changeType="positive" icon={TrendingUp} />
          <MetricCard title="Conversões (período)" value={dashboard?.total_conversions?.toLocaleString() ?? "0"} change="" changeType="positive" icon={ShoppingCart} />
        </div>

        <DashboardGoogleGeoSection dashboard={dashboard} />

        {chartData.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <h3 className="text-base font-semibold text-card-foreground mb-4">Cliques e impressões no período</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cCliques" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(172 66% 38%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(172 66% 38%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cImps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(28 92% 48%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(28 92% 48%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 88%)" />
                  <XAxis dataKey="name" stroke="hsl(215 16% 47%)" fontSize={12} />
                  <YAxis stroke="hsl(215 16% 47%)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(38 20% 88%)", borderRadius: "0.5rem" }} />
                  <Legend />
                  <Area type="monotone" dataKey="impressoes" stroke="hsl(28 92% 48%)" fill="url(#cImps)" strokeWidth={2} name="Impressões" />
                  <Area type="monotone" dataKey="cliques" stroke="hsl(172 66% 38%)" fill="url(#cCliques)" strokeWidth={2} name="Cliques" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
