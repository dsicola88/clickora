import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Radar, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, type MessageKey } from "@/i18n";
import {
  demandRadarService,
  normalizeDemandTimeframe,
  type DemandPlannerIdea,
  type DemandPlannerTimeframe,
  type DemandPrimaryKind,
  type DemandRadarAnalyze,
} from "@/services/demandRadarService";
import {
  GOOGLE_ADS_COUNTRY_OPTIONS,
  GOOGLE_ADS_LANGUAGE_OPTIONS,
  localizedCountryOptions,
  localizedLanguageOptions,
} from "@/lib/googleAdsTargeting";
import {
  GoogleAdsCountrySingleSelect,
  GoogleAdsLanguageSingleSelect,
} from "@/components/dpilot/GoogleAdsTargetingSelect";
import { DemandVolumeTrendChart } from "@/components/demandRadar/DemandVolumeTrendChart";
import {
  DemandDeviceBreakdownPanel,
  type DeviceFilter,
} from "@/components/demandRadar/DemandDeviceBreakdown";
import { DemandKeywordIdeasTable } from "@/components/demandRadar/DemandKeywordIdeasTable";
import { cn } from "@/lib/utils";

function formatInt(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

function formatMoney(n: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function competitionLabel(
  c: DemandPlannerIdea["competition"],
  t: (k: MessageKey) => string,
) {
  if (c == null) return t("pages.demandRadar.noVolume");
  if (c === "low") return t("pages.demandRadar.competitionLow");
  if (c === "high") return t("pages.demandRadar.competitionHigh");
  if (c === "medium") return t("pages.demandRadar.competitionMedium");
  return t("pages.demandRadar.noVolume");
}

function primaryKindLabel(kind: DemandPrimaryKind | null, t: (k: MessageKey) => string) {
  if (kind === "exact_seed") return t("pages.demandRadar.primaryExact");
  if (kind === "close_seed") return t("pages.demandRadar.primaryClose");
  if (kind === "top_related") return t("pages.demandRadar.primaryTop");
  return t("pages.demandRadar.sourceUnavailable");
}

function SourceBadge({
  tone,
  children,
}: {
  tone: "google" | "clickora" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "google" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        tone === "clickora" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function KpiCell({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-card px-3 py-3.5 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function DemandRadarPage() {
  const { t, locale } = useAppLocale();
  const nl = locale === "pt-BR" ? "pt-BR" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "en-US";

  const [product, setProduct] = useState("");
  const [language, setLanguage] = useState("en");
  const [market, setMarket] = useState("US");
  const [timeframe, setTimeframe] = useState<DemandPlannerTimeframe>("last_12");
  const [analysis, setAnalysis] = useState<DemandRadarAnalyze | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");

  const overviewQ = useQuery({
    queryKey: ["demand-radar", "overview"],
    queryFn: async () => {
      const { data, error } = await demandRadarService.overview();
      if (error) throw new Error(error);
      return data!;
    },
  });

  const languageOptions = useMemo(() => localizedLanguageOptions(nl), [nl]);
  const marketOptions = useMemo(() => localizedCountryOptions(nl), [nl]);

  const analyzeM = useMutation({
    mutationFn: async (payload?: {
      product?: string;
      market?: string;
      language?: string;
      timeframe?: DemandPlannerTimeframe;
    }) => {
      const body = {
        product: (payload?.product ?? product).trim(),
        market: payload?.market ?? market,
        language: payload?.language ?? language,
        timeframe: payload?.timeframe ?? timeframe,
      };
      const { data, error } = await demandRadarService.analyze(body);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      setProduct(data.query.product);
      setMarket(data.query.market);
      setLanguage(data.query.language);
      setTimeframe(normalizeDemandTimeframe(data.query.timeframe));
      setDeviceFilter("all");
    },
    onError: (err: Error) => {
      toast.error(err.message || t("pages.demandRadar.analyzeError"));
    },
  });

  function runAnalyze(opts?: {
    product?: string;
    market?: string;
    language?: string;
    timeframe?: DemandPlannerTimeframe;
  }) {
    const p = (opts?.product ?? product).trim();
    const mktRaw = (opts?.market ?? market).trim().toUpperCase();
    const mkt = mktRaw === "UK" ? "GB" : mktRaw;
    const lang = (opts?.language ?? language).trim().toLowerCase();
    const tf = normalizeDemandTimeframe(opts?.timeframe ?? timeframe);
    if (p.length < 2 || analyzeM.isPending) return;
    if (!GOOGLE_ADS_COUNTRY_OPTIONS.some((o) => o.code === mkt)) {
      toast.error(t("pages.demandRadar.marketEmpty"));
      return;
    }
    if (!GOOGLE_ADS_LANGUAGE_OPTIONS.some((o) => o.code === lang)) {
      toast.error(t("pages.demandRadar.languageEmpty"));
      return;
    }
    if (opts?.product) setProduct(p);
    if (opts?.market) setMarket(mkt);
    if (opts?.language) setLanguage(lang);
    if (opts?.timeframe) setTimeframe(tf);
    analyzeM.mutate({ product: p, market: mkt, language: lang, timeframe: tf });
  }

  /** Resultados só visíveis se os filtros coincidirem com a última análise — sem inventar métricas. */
  const resultsLive =
    analysis != null &&
    analysis.query.product.trim() === product.trim() &&
    analysis.query.market.toUpperCase() === market.toUpperCase() &&
    analysis.query.language.toLowerCase() === language.toLowerCase() &&
    normalizeDemandTimeframe(analysis.query.timeframe) === normalizeDemandTimeframe(timeframe);
  const view = resultsLive ? analysis : null;

  if (overviewQ.isLoading) return <LoadingState message={t("common.loading")} />;
  if (overviewQ.isError || !overviewQ.data) {
    return (
      <ErrorState
        message={t("pages.demandRadar.loadError")}
        onRetry={() => void overviewQ.refetch()}
      />
    );
  }

  const overview = overviewQ.data;
  const googleReady = overview.google_ads.ready;
  const googleReason = overview.google_ads.reason;
  const googlePlatformMissing = googleReason === "google_ads_platform_not_configured";
  const plannerOk = view?.planner.status === "ok";
  const primary = view?.planner.primary ?? null;
  const primaryKind = view?.planner.primary_kind ?? null;

  const honestyNotes = [
    t("pages.demandRadar.honestyNote1"),
    t("pages.demandRadar.honestyNote2"),
    t("pages.demandRadar.honestyNote3"),
  ];

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.demandRadar.title")}
        subtitle={t("pages.demandRadar.subtitle")}
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Radar className="h-3.5 w-3.5" />
            {fill(t("pages.demandRadar.periodNote"), { days: overview.period.days })}
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/presells/nova">{t("pages.demandRadar.createPresell")}</Link>
          </Button>
        }
      />

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
          googleReady ? "border-sky-500/30 bg-sky-500/5" : "border-amber-500/30 bg-amber-500/5",
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">
            {googleReady
              ? t("pages.demandRadar.googleReady")
              : googlePlatformMissing
                ? t("pages.demandRadar.googlePlatformMissing")
                : t("pages.demandRadar.googleMissing")}
          </p>
          <p className="text-xs text-muted-foreground">{overview.google_ads.message}</p>
        </div>
        {!googleReady ? (
          <Button asChild size="sm">
            <Link to="/integracoes/google-ads">
              {googlePlatformMissing
                ? t("pages.demandRadar.openIntegrations")
                : t("pages.demandRadar.connectGoogle")}
            </Link>
          </Button>
        ) : null}
      </div>

      <section className="rounded-lg border border-border/70 bg-card p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.analyzeTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="demand-product">{t("pages.demandRadar.productLabel")}</Label>
            <Input
              id="demand-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder={t("pages.demandRadar.productPlaceholder")}
              disabled={analyzeM.isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") runAnalyze({});
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demand-language">{t("pages.demandRadar.languageLabel")}</Label>
            <GoogleAdsLanguageSingleSelect
              id="demand-language"
              options={languageOptions}
              value={language}
              disabled={analyzeM.isPending}
              searchPlaceholder={t("pages.demandRadar.languageSearch")}
              emptyText={t("pages.demandRadar.languageEmpty")}
              onChange={setLanguage}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demand-market">{t("pages.demandRadar.marketLabel")}</Label>
            <GoogleAdsCountrySingleSelect
              id="demand-market"
              options={marketOptions}
              value={market}
              disabled={analyzeM.isPending}
              searchPlaceholder={t("pages.demandRadar.marketSearch")}
              emptyText={t("pages.demandRadar.marketEmpty")}
              onChange={setMarket}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("pages.demandRadar.networkLabel")}</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
              {t("pages.demandRadar.networkGoogle")}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>{t("pages.demandRadar.timeframeLabel")}</Label>
            <Select
              value={normalizeDemandTimeframe(timeframe)}
              disabled={analyzeM.isPending}
              onValueChange={(v) => setTimeframe(v as DemandPlannerTimeframe)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_1">{t("pages.demandRadar.timeframe1")}</SelectItem>
                <SelectItem value="last_12">{t("pages.demandRadar.timeframe12")}</SelectItem>
                <SelectItem value="last_24">{t("pages.demandRadar.timeframe24")}</SelectItem>
                <SelectItem value="all_available">{t("pages.demandRadar.timeframeAll")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">{t("pages.demandRadar.timeframeHint")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={product.trim().length < 2 || analyzeM.isPending} onClick={() => runAnalyze({})}>
            {analyzeM.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("pages.demandRadar.analyzing")}
              </>
            ) : (
              t("pages.demandRadar.analyze")
            )}
          </Button>
          {view ? (
            <Button asChild variant="secondary">
              <Link to={view.next_steps.keywords_path}>
                {t("pages.demandRadar.openKeywords")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {!view && !analyzeM.isPending ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
          <Radar className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">{t("pages.demandRadar.emptyAnalyzeTitle")}</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
            {t("pages.demandRadar.emptyAnalyzeHint")}
          </p>
        </div>
      ) : null}

      {analyzeM.isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border/70 px-4 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("pages.demandRadar.analyzing")}
        </div>
      ) : null}

      {view && !analyzeM.isPending ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.resultsTitle")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge tone={plannerOk ? "google" : "muted"}>
                {plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              </SourceBadge>
            </div>
          </div>
          {!plannerOk && view.planner.message ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              {view.planner.message}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCell
              label={t("pages.demandRadar.seedVolume")}
              value={primary ? formatInt(primary.monthly_volume, nl) : t("pages.demandRadar.noVolume")}
              hint={
                primary
                  ? `${t("pages.demandRadar.primaryKeyword")}: ${primary.keyword} · ${primaryKindLabel(primaryKind, t)}`
                  : t("pages.demandRadar.sourceUnavailable")
              }
              muted={!primary}
            />
            <KpiCell
              label={t("pages.demandRadar.seedCpc")}
              value={
                primary && primary.avg_cpc > 0
                  ? formatMoney(primary.avg_cpc, nl)
                  : t("pages.demandRadar.noVolume")
              }
              hint={plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              muted={!primary || primary.avg_cpc <= 0}
            />
            <KpiCell
              label={t("pages.demandRadar.seedCompetition")}
              value={
                primary?.competition != null
                  ? competitionLabel(primary.competition, t)
                  : t("pages.demandRadar.noVolume")
              }
              hint={plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              muted={!primary || primary.competition == null}
            />
            <KpiCell
              label={t("pages.demandRadar.kpiIndex")}
              value={
                primary?.competition_index != null
                  ? String(primary.competition_index)
                  : t("pages.demandRadar.noVolume")
              }
              hint={plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              muted={primary?.competition_index == null}
            />
            <KpiCell
              label={t("pages.demandRadar.kpiIdeas")}
              value={formatInt(view.planner.ideas.length, nl)}
              hint={plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              muted={!plannerOk}
            />
            <KpiCell
              label={t("pages.demandRadar.kpiRelatedVol")}
              value={
                plannerOk
                  ? formatInt(
                      view.planner.ideas.reduce((s, i) => s + i.monthly_volume, 0),
                      nl,
                    )
                  : t("pages.demandRadar.noVolume")
              }
              hint={plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              muted={!plannerOk}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            {view.planner.trend ? (
              <DemandVolumeTrendChart
                trend={view.planner.trend}
                keyword={primary?.keyword ?? view.query.product}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                {t("pages.demandRadar.trendEmpty")}
              </div>
            )}
            {view.planner.device_split ||
            (view.account.devices?.total_clicks ?? 0) > 0 ? (
              <DemandDeviceBreakdownPanel
                devices={view.account.devices}
                googleDevices={view.planner.device_split}
                filter={deviceFilter}
                onFilterChange={setDeviceFilter}
              />
            ) : null}
          </div>

          <DemandKeywordIdeasTable
            ideas={view.planner.ideas}
            primaryKeyword={primary?.keyword}
            primaryKindLabel={primary ? primaryKindLabel(primaryKind, t) : null}
            plannerOk={plannerOk}
            busy={analyzeM.isPending}
            onAnalyze={(keyword) => runAnalyze({ product: keyword })}
          />

          {view.account.matching_offers.length > 0 ||
          view.account.matching_researches.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {view.account.matching_offers.length > 0 ? (
                <div className="rounded-lg border border-border/70">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                    <h3 className="text-sm font-semibold">{t("pages.demandRadar.accountOffers")}</h3>
                    <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {view.account.matching_offers.map((o) => (
                      <li key={o.presell_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.title}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {t("pages.demandRadar.clicks")}: {formatInt(o.clicks, nl)} ·{" "}
                            {t("pages.demandRadar.sales")}: {formatInt(o.approved_sales, nl)} ·{" "}
                            {t("pages.demandRadar.revenue")}: {formatMoney(o.revenue, nl)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="ghost" onClick={() => runAnalyze({ product: o.title })}>
                            {t("pages.demandRadar.analyzeOffer")}
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/resultados">{t("pages.demandRadar.viewResults")}</Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {view.account.matching_researches.length > 0 ? (
                <div className="rounded-lg border border-border/70">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                    <h3 className="text-sm font-semibold">{t("pages.demandRadar.accountResearches")}</h3>
                    <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {view.account.matching_researches.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{r.product}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.market_name} · {r.language}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/palavras-chave?research=${encodeURIComponent(r.id)}`}>
                            {t("pages.demandRadar.openResearch")}
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {view && !analyzeM.isPending ? (
        <>
          {(overview.internal_offers.length > 0 || overview.recent_researches.length > 0) ? (
            <section className="grid gap-4 lg:grid-cols-2">
              {overview.internal_offers.length > 0 ? (
                <div className="rounded-lg border border-border/70">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                    <h3 className="text-sm font-semibold">{t("pages.demandRadar.topOffers")}</h3>
                    <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {overview.internal_offers.map((o) => (
                      <li key={o.presell_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.title}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {t("pages.demandRadar.sales")}: {formatInt(o.approved_sales, nl)} ·{" "}
                            {t("pages.demandRadar.revenue")}: {formatMoney(o.revenue, nl)} ·{" "}
                            {t("pages.demandRadar.clicks")}: {formatInt(o.clicks, nl)}
                            {o.conversion_rate != null
                              ? ` · ${t("pages.demandRadar.rate")}: ${o.conversion_rate}%`
                              : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={analyzeM.isPending}
                          onClick={() => runAnalyze({ product: o.title })}
                        >
                          {t("pages.demandRadar.analyzeOffer")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {overview.recent_researches.length > 0 ? (
                <div className="rounded-lg border border-border/70">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                    <h3 className="text-sm font-semibold">{t("pages.demandRadar.recentResearches")}</h3>
                    <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {overview.recent_researches.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{r.product}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.market_name} · {r.language}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={analyzeM.isPending}
                            onClick={() =>
                              runAnalyze({
                                product: r.product,
                                market: r.market,
                                language: r.language,
                              })
                            }
                          >
                            {t("pages.demandRadar.analyzeOffer")}
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/palavras-chave?research=${encodeURIComponent(r.id)}`}>
                              {t("pages.demandRadar.openResearch")}
                            </Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-lg border border-border/60 bg-muted/20 px-4 py-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">{t("pages.demandRadar.honestyTitle")}</h3>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {honestyNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-border/60 bg-muted/20 px-4 py-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold">{t("pages.demandRadar.honestyTitle")}</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {honestyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
