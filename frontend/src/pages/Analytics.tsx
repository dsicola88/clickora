import { useEffect, useMemo, useState } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor, type MessageKey } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bot, Building2, Link2, RefreshCw, Settings2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  analyticsService,
  GoogleAdsInsightsRequestError,
  type GoogleAdsInsightsBundle,
} from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countryDisplayLabel, countryFlagEmoji } from "@/lib/countryDisplay";
import { cn } from "@/lib/utils";

/** Montado em App sob `/resultados/por-presell/*`. */
const ANALYTICS_BASE = "/resultados/por-presell";

/** Valor sentinela no Radix Select (não usar `value=""`). */
const GOOGLE_ADS_ALL_CAMPAIGNS = "__all_campaigns__";

const GOOGLE_INSIGHT_TABS = ["keywords", "search_terms", "demographics"] as const;
type GoogleInsightTab = (typeof GOOGLE_INSIGHT_TABS)[number];

function isGoogleInsightTab(s: string | undefined): s is GoogleInsightTab {
  return !!s && (GOOGLE_INSIGHT_TABS as readonly string[]).includes(s);
}

function AnalyticsSectionNav() {
  const { t } = useAppLocale();
  const loc = useLocation();
  const onGoogle = loc.pathname.includes(`${ANALYTICS_BASE}/google-ads`);

  return (
    <nav className="mb-6 space-y-3" aria-label={t("pages.analytics.navAria")}>
      <p className="text-sm text-muted-foreground">{t("pages.analytics.navHint")}</p>
      <div className="flex flex-wrap gap-2">
        <NavLink
          to={`${ANALYTICS_BASE}/presells`}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center rounded-lg border px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60",
            )
          }
        >
          {t("pages.analytics.presellsTab")}
        </NavLink>
        <NavLink
          to={`${ANALYTICS_BASE}/google-ads/keywords`}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center rounded-lg border px-3 py-2 text-sm transition-colors",
              isActive || onGoogle
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60",
            )
          }
        >
          {t("pages.analytics.googleTab")}
        </NavLink>
      </div>
      {onGoogle ? (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {(
            [
              { seg: "keywords" as const, label: t("common.keyword") },
              { seg: "search_terms" as const, label: t("pages.analytics.searchTerms") },
              { seg: "demographics" as const, label: t("pages.analytics.demographics") },
            ] as const
          ).map(({ seg, label }) => (
            <NavLink
              key={seg}
              to={`${ANALYTICS_BASE}/google-ads/${seg}`}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs sm:text-sm transition-colors",
                  isActive
                    ? "border-primary/80 bg-primary/15 font-medium text-foreground"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function deviceDisplayLabel(
  device: string | null | undefined,
  tr: (key: MessageKey) => string,
): string {
  if (!device) return "—";
  switch (device.toLowerCase().trim()) {
    case "desktop":
      return tr("pages.results.deviceDesktop");
    case "mobile":
      return tr("pages.results.deviceMobile");
    case "tablet":
      return tr("pages.results.deviceTablet");
    case "bot":
      return tr("pages.analytics.deviceBot");
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
    t.startsWith("O custo do Google Ads ainda não está disponível") ||
    t.startsWith("Para ver o custo, ligue primeiro") ||
    t.startsWith("Para ver o custo, indique o número da conta") ||
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

function uniqueCampaignNamesFromInsights(data: GoogleAdsInsightsBundle): string[] {
  const set = new Set<string>();
  const add = (c: string) => {
    const t = (c ?? "").trim();
    if (t) set.add(t);
  };
  if (data.keywords.ok) for (const r of data.keywords.rows) add(r.campaign);
  if (data.search_terms.ok) for (const r of data.search_terms.rows) add(r.campaign);
  if (data.demographics.ok) {
    for (const r of data.demographics.gender) add(r.campaign);
    for (const r of data.demographics.age) add(r.campaign);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt"));
}

function rowMatchesCampaignFilter(rowCampaign: string, filterNorm: string): boolean {
  if (!filterNorm) return true;
  return (rowCampaign ?? "").trim() === filterNorm;
}

function formatCostFromMicros(micros: number, locale: string): string {
  if (!micros) return "—";
  return (micros / 1_000_000).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** CTR agregado (cliques ÷ impressões) — igual ao raciocínio do Google Ads. */
function formatCtrPct(impressions: number, clicks: number, locale: string): string {
  if (impressions <= 0) return "—";
  const pct = (clicks / impressions) * 100;
  return `${pct.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Conversões com atribuição da conta (podem ser fraccionárias). */
function formatConversions(n: number | undefined, locale: string): string {
  const v = n ?? 0;
  if (Math.abs(v) < 1e-9) return "—";
  return v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PresellsAnalyticsBody() {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const { data: summaryData, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getSummary();
      if (error) throw new Error(error);
      if (!data) return [];
      if (Array.isArray(data)) return data;
      return data.by_presell ?? [];
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

  if (isLoading) return <LoadingState message={t("pages.analytics.loading")} />;
  if (isError) return <ErrorState message={t("pages.analytics.loadError")} onRetry={() => refetch()} />;

  if (!summaryData || summaryData.length === 0) {
    return (
      <EmptyState
        title={t("pages.analytics.emptyTitle")}
        description={t("pages.analytics.emptyDesc")}
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
            <h2 className="font-semibold text-card-foreground">{t("pages.analytics.summary")}</h2>
          </div>
          <div className="space-y-5">
            {[
              { label: t("pages.analytics.totalClicks"), value: totalClicks.toLocaleString() },
              { label: t("pages.analytics.totalImpressions"), value: totalImpressions.toLocaleString() },
              { label: t("pages.analytics.avgCtr"), value: `${avgCtr.toFixed(2)}%` },
              { label: t("pages.analytics.activePages"), value: String(summaryData.length) },
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
            <h2 className="font-semibold text-card-foreground">{t("pages.analytics.performance")}</h2>
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
                <Bar dataKey="cliques" fill="hsl(172 66% 38%)" radius={[4, 4, 0, 0]} name={t("common.clicks")} />
                <Bar
                  dataKey="impressoes"
                  fill="hsl(28 92% 48% / 0.4)"
                  radius={[4, 4, 0, 0]}
                  name={t("common.impressions")}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-card border border-border/50 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-card-foreground">{t("pages.analytics.lastClicks")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {t("pages.analytics.lastClicksHint")}{" "}
          <Badge variant="secondary" className="mx-0.5">
            {t("pages.analytics.deviceBot")}
          </Badge>
        </p>
        {!recentClicks?.length ? (
          <p className="text-sm text-muted-foreground">{t("pages.analytics.noClicksYet")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium">{t("pages.blacklist.colWhen")}</th>
                  <th className="py-2.5 px-3 font-medium">IP</th>
                  <th className="py-2.5 px-3 font-medium">{t("pages.analytics.colCountry")}</th>
                  <th className="py-2.5 px-3 font-medium">{t("pages.results.thDevice")}</th>
                  <th className="py-2.5 px-3 font-medium">{t("pages.reports.typeLegend")}</th>
                </tr>
              </thead>
              <tbody>
                {recentClicks.map((ev) => (
                  <tr key={ev.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 px-3 text-xs whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString(numLocale)}
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
                    <td className="py-2 px-3 text-xs">{deviceDisplayLabel(ev.device, t)}</td>
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
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const initial = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [campaignFilter, setCampaignFilter] = useState("");
  const { insight: insightParam } = useParams<{ insight: string }>();
  const navigate = useNavigate();
  const insight: GoogleInsightTab = isGoogleInsightTab(insightParam) ? insightParam : "keywords";

  useEffect(() => {
    if (insightParam !== undefined && !isGoogleInsightTab(insightParam)) {
      navigate(`${ANALYTICS_BASE}/google-ads/keywords`, { replace: true });
    }
  }, [insightParam, navigate]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["analytics-google-ads-insights", from, to],
    queryFn: async () => {
      const { data: d, error: err, errorCode } = await analyticsService.getGoogleAdsInsights({ from, to });
      if (err) throw new GoogleAdsInsightsRequestError(err, errorCode ?? null);
      if (!d) throw new GoogleAdsInsightsRequestError(t("pages.analytics.loadFail"), null);
      return d;
    },
    retry: 1,
  });

  const insightErr = error instanceof GoogleAdsInsightsRequestError ? error : null;
  const errCode = insightErr?.errorCode ?? null;
  const errMsg = error instanceof Error ? error.message : t("pages.analytics.loadFail");
  const softUnavailable =
    isError &&
    (isGoogleAdsInsightsUnavailableCode(errCode) || (errCode == null && isGoogleAdsReportingSetupMessage(errMsg)));

  const campaignFilterNorm = campaignFilter.trim();
  const uniqueCampaigns = useMemo(
    () => (data ? uniqueCampaignNamesFromInsights(data) : []),
    [data],
  );

  useEffect(() => {
    if (!campaignFilterNorm) return;
    if (!uniqueCampaigns.includes(campaignFilterNorm)) setCampaignFilter("");
  }, [uniqueCampaigns, campaignFilterNorm]);

  const filteredKeywordRows = useMemo(() => {
    if (!data?.keywords.ok) return [];
    return data.keywords.rows.filter((r) => rowMatchesCampaignFilter(r.campaign, campaignFilterNorm));
  }, [data, campaignFilterNorm]);

  const filteredSearchTermRows = useMemo(() => {
    if (!data?.search_terms.ok) return [];
    return data.search_terms.rows.filter((r) => rowMatchesCampaignFilter(r.campaign, campaignFilterNorm));
  }, [data, campaignFilterNorm]);

  const filteredDemoGenderRows = useMemo(() => {
    if (!data?.demographics.ok) return [];
    return data.demographics.gender.filter((r) => rowMatchesCampaignFilter(r.campaign, campaignFilterNorm));
  }, [data, campaignFilterNorm]);

  const filteredDemoAgeRows = useMemo(() => {
    if (!data?.demographics.ok) return [];
    return data.demographics.age.filter((r) => rowMatchesCampaignFilter(r.campaign, campaignFilterNorm));
  }, [data, campaignFilterNorm]);

  /** Totais ao nível de palavra-chave da campanha filtrada — leitura rápida sem abrir o Google Ads. */
  const googleAdsCampaignPulse = useMemo(() => {
    if (!campaignFilterNorm || !data?.keywords.ok) return null;
    if (!filteredKeywordRows.length) return null;
    let impressions = 0;
    let clicks = 0;
    let cost_micros = 0;
    let conversions = 0;
    for (const r of filteredKeywordRows) {
      impressions += r.impressions;
      clicks += r.clicks;
      cost_micros += r.cost_micros;
      conversions += r.conversions ?? 0;
    }
    const costUsd = cost_micros / 1_000_000;
    const cpa = conversions > 1e-6 ? costUsd / conversions : null;
    return {
      impressions,
      clicks,
      cost_micros,
      conversions,
      ctrPct: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa,
    };
  }, [campaignFilterNorm, data?.keywords.ok, filteredKeywordRows]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:min-w-0">
            <div className="space-y-1.5 w-full min-w-0 sm:max-w-md">
              <Label className="text-xs font-medium text-muted-foreground">{t("common.period")}</Label>
              <DateRangeFilter
                from={from}
                to={to}
                onApply={(p) => {
                  setFrom(p.from);
                  setTo(p.to);
                }}
                showCompare
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="gap-2 w-full sm:w-auto shrink-0"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {t("pages.analytics.refreshReports")}
            </Button>
            {data && uniqueCampaigns.length > 0 ? (
              <div className="space-y-1.5 w-full min-w-0 sm:max-w-[min(100%,20rem)] lg:max-w-xs">
                <Label htmlFor="ga-insights-campaign" className="text-xs font-medium text-muted-foreground">
                  {t("pages.analytics.campaign")}
                </Label>
                <Select
                  value={campaignFilterNorm ? campaignFilterNorm : GOOGLE_ADS_ALL_CAMPAIGNS}
                  onValueChange={(v) => setCampaignFilter(v === GOOGLE_ADS_ALL_CAMPAIGNS ? "" : v)}
                >
                  <SelectTrigger id="ga-insights-campaign" className="w-full">
                    <SelectValue placeholder={t("pages.analytics.allCampaigns")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GOOGLE_ADS_ALL_CAMPAIGNS}>{t("pages.analytics.allCampaigns")}</SelectItem>
                    {uniqueCampaigns.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="line-clamp-2 break-words text-left" title={c}>
                          {c}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed max-w-3xl">
          {t("pages.analytics.googleIntro")}{" "}
          <Link to="/integracoes/google-ads" className="text-primary font-medium underline underline-offset-2">
            {t("pages.trackingTools.googleAdsLink")}
          </Link>
        </p>
      </div>

      {isLoading ? <LoadingState message={t("pages.analytics.loadingGoogle")} /> : null}
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
                    ? t("pages.analytics.unavailableCost")
                    : errCode === "google_ads_oauth_required"
                      ? t("pages.analytics.connectAccount")
                      : errCode === "google_ads_customer_id_required"
                        ? t("pages.analytics.needCustomer")
                        : t("pages.analytics.needLink")}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{errMsg}</p>
                {errCode === "google_ads_platform_not_configured" ? (
                  <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
                    {t("pages.analytics.platformHint")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  variant={errCode === "google_ads_platform_not_configured" ? "outline" : "default"}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Link to="/integracoes/google-ads">
                    {errCode === "google_ads_platform_not_configured" ? t("pages.analytics.openGoogle") : t("pages.analytics.goGoogle")}
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
          <AlertTitle>{t("pages.analytics.dataFail")}</AlertTitle>
          <AlertDescription className="text-sm">{errMsg}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <p className="text-[11px] text-muted-foreground">
            {fill(t("pages.analytics.synced"), {
              when: new Date(data.synced_at).toLocaleString(numLocale),
              from: data.period.from,
              to: data.period.to,
            })}
          </p>

          {campaignFilterNorm && googleAdsCampaignPulse ? (
            <div
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 dark:bg-emerald-500/10"
              role="region"
              aria-label={t("pages.analytics.summaryAria")}
            >
              <p className="text-xs font-semibold text-foreground">
                {t("pages.analytics.summary")} · <span className="text-emerald-800 dark:text-emerald-200">{campaignFilterNorm}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">{t("pages.analytics.summaryHint")}</p>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-[13px]">
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("common.impressions")}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {googleAdsCampaignPulse.impressions.toLocaleString(numLocale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("common.clicks")}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {googleAdsCampaignPulse.clicks.toLocaleString(numLocale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CTR</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {googleAdsCampaignPulse.impressions > 0
                      ? `${googleAdsCampaignPulse.ctrPct.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("pages.reports.eventConversion")}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {formatConversions(googleAdsCampaignPulse.conversions, numLocale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("common.cost")}*</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {formatCostFromMicros(googleAdsCampaignPulse.cost_micros, numLocale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("pages.analytics.costPerConv")}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {googleAdsCampaignPulse.cpa != null
                      ? googleAdsCampaignPulse.cpa.toLocaleString("pt-PT", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {insight === "keywords" ? (
            <div className="mt-4">
              {data.keywords.ok ? (
                <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="py-2.5 px-3 font-medium">{t("pages.analytics.campaign")}</th>
                        <th className="py-2.5 px-3 font-medium">{t("pages.results.thAdgroup")}</th>
                        <th className="py-2.5 px-3 font-medium">{t("common.keyword")}</th>
                        <th className="py-2.5 px-3 font-medium text-right">{t("common.impressions")}</th>
                        <th className="py-2.5 px-3 font-medium text-right">{t("common.clicks")}</th>
                        <th className="py-2.5 px-3 font-medium text-right">CTR</th>
                        <th className="py-2.5 px-3 font-medium text-right">Conv.</th>
                        <th className="py-2.5 px-3 font-medium text-right">{t("common.cost")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.keywords.rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                            {t("pages.analytics.emptyKeywords")}
                          </td>
                        </tr>
                      ) : filteredKeywordRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                            {fill(t("pages.analytics.emptyCampaign"), { campaign: campaignFilterNorm })}
                          </td>
                        </tr>
                      ) : (
                        filteredKeywordRows.map((r, i) => (
                          <tr key={`${r.campaign}-${r.ad_group}-${r.keyword}-${i}`} className="border-b border-border/40">
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.campaign}>
                              {r.campaign}
                            </td>
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.ad_group}>
                              {r.ad_group}
                            </td>
                            <td className="py-2 px-3 font-medium">{r.keyword}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString(numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString(numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatCtrPct(r.impressions, r.clicks, numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatConversions(r.conversions, numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatCostFromMicros(r.cost_micros, numLocale)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>{t("common.keyword")}</AlertTitle>
                  <AlertDescription className="text-sm">{data.keywords.error}</AlertDescription>
                </Alert>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">{t("pages.analytics.ctrNote")}</p>
            </div>
          ) : insight === "search_terms" ? (
            <div className="mt-4">
              {data.search_terms.ok ? (
                <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="py-2.5 px-3 font-medium">{t("pages.analytics.campaign")}</th>
                        <th className="py-2.5 px-3 font-medium">{t("pages.results.thAdgroup")}</th>
                        <th className="py-2.5 px-3 font-medium">{t("pages.analytics.searchTerm")}</th>
                        <th className="py-2.5 px-3 font-medium text-right">{t("common.impressions")}</th>
                        <th className="py-2.5 px-3 font-medium text-right">{t("common.clicks")}</th>
                        <th className="py-2.5 px-3 font-medium text-right">CTR</th>
                        <th className="py-2.5 px-3 font-medium text-right">Conv.</th>
                        <th className="py-2.5 px-3 font-medium text-right">{t("common.cost")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.search_terms.rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                            {t("pages.analytics.emptyTerms")}
                          </td>
                        </tr>
                      ) : filteredSearchTermRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                            {fill(t("pages.analytics.emptyTermsCampaign"), { campaign: campaignFilterNorm })}
                          </td>
                        </tr>
                      ) : (
                        filteredSearchTermRows.map((r, i) => (
                          <tr key={`${r.campaign}-${r.ad_group}-${r.search_term}-${i}`} className="border-b border-border/40">
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.campaign}>
                              {r.campaign}
                            </td>
                            <td className="py-2 px-3 max-w-[10rem] truncate" title={r.ad_group}>
                              {r.ad_group}
                            </td>
                            <td className="py-2 px-3">{r.search_term}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString(numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString(numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatCtrPct(r.impressions, r.clicks, numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatConversions(r.conversions, numLocale)}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatCostFromMicros(r.cost_micros, numLocale)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>{t("pages.analytics.searchTerms")}</AlertTitle>
                  <AlertDescription className="text-sm">{data.search_terms.error}</AlertDescription>
                </Alert>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                {t("pages.analytics.costNote")}
              </p>
            </div>
          ) : insight === "demographics" ? (
            <div className="mt-4">
              {data.demographics.ok ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t("pages.analytics.gender")}</h3>
                    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                            <th className="py-2 px-3 font-medium">{t("pages.analytics.campaign")}</th>
                            <th className="py-2 px-3 font-medium">{t("pages.results.thAdgroup")}</th>
                            <th className="py-2 px-3 font-medium">Segmento</th>
                            <th className="py-2 px-3 font-medium text-right">{t("common.impressions")}</th>
                            <th className="py-2 px-3 font-medium text-right">{t("common.clicks")}</th>
                            <th className="py-2 px-3 font-medium text-right">CTR</th>
                            <th className="py-2 px-3 font-medium text-right">Conv.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.demographics.gender.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
                                {t("pages.analytics.emptyGender")}
                              </td>
                            </tr>
                          ) : filteredDemoGenderRows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
                                {fill(t("pages.analytics.emptyGenderCampaign"), { campaign: campaignFilterNorm })}
                              </td>
                            </tr>
                          ) : (
                            filteredDemoGenderRows.map((r, i) => (
                              <tr key={`g-${i}`} className="border-b border-border/40">
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.campaign}>
                                  {r.campaign}
                                </td>
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.ad_group}>
                                  {r.ad_group}
                                </td>
                                <td className="py-2 px-3">{r.segment_label}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString(numLocale)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString(numLocale)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{formatCtrPct(r.impressions, r.clicks, numLocale)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{formatConversions(r.conversions, numLocale)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t("pages.analytics.age")}</h3>
                    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                            <th className="py-2 px-3 font-medium">{t("pages.analytics.campaign")}</th>
                            <th className="py-2 px-3 font-medium">{t("pages.results.thAdgroup")}</th>
                            <th className="py-2 px-3 font-medium">{t("pages.analytics.ageBand")}</th>
                            <th className="py-2 px-3 font-medium text-right">{t("common.impressions")}</th>
                            <th className="py-2 px-3 font-medium text-right">{t("common.clicks")}</th>
                            <th className="py-2 px-3 font-medium text-right">CTR</th>
                            <th className="py-2 px-3 font-medium text-right">Conv.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.demographics.age.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
                                {t("pages.analytics.emptyAge")}
                              </td>
                            </tr>
                          ) : filteredDemoAgeRows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
                                {fill(t("pages.analytics.noAge"), { campaign: campaignFilterNorm })}
                              </td>
                            </tr>
                          ) : (
                            filteredDemoAgeRows.map((r, i) => (
                              <tr key={`a-${i}`} className="border-b border-border/40">
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.campaign}>
                                  {r.campaign}
                                </td>
                                <td className="py-2 px-3 max-w-[8rem] truncate" title={r.ad_group}>
                                  {r.ad_group}
                                </td>
                                <td className="py-2 px-3">{r.segment_label}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.impressions.toLocaleString(numLocale)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.clicks.toLocaleString(numLocale)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{formatCtrPct(r.impressions, r.clicks, numLocale)}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{formatConversions(r.conversions, numLocale)}</td>
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
                  <AlertTitle>{t("pages.analytics.demographics")}</AlertTitle>
                  <AlertDescription className="text-sm">{data.demographics.error}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function Analytics() {
  const { t } = useAppLocale();
  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title={t("pages.analytics.title")}
        description={t("pages.analytics.subtitle")}
      />

      <AnalyticsSectionNav />

      <Routes>
        <Route index element={<Navigate to="presells" replace />} />
        <Route path="presells" element={<PresellsAnalyticsBody />} />
        <Route path="google-ads" element={<Navigate to={`${ANALYTICS_BASE}/google-ads/keywords`} replace />} />
        <Route path="google-ads/:insight" element={<GoogleAdsInsightsPanel />} />
        <Route path="*" element={<Navigate to={`${ANALYTICS_BASE}/presells`} replace />} />
      </Routes>
    </div>
  );
}
