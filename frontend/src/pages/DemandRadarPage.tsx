import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  type DemandPlannerIdea,
  type DemandPlannerTimeframe,
  type DemandPrimaryKind,
  type DemandRadarAnalyze,
} from "@/services/demandRadarService";
import { keywordResearchService } from "@/services/keywordResearchService";
import {
  defaultMarketForLanguage,
  marketsForLanguage,
} from "@/lib/keywordResearchMarkets";
import { DemandVolumeTrendChart } from "@/components/demandRadar/DemandVolumeTrendChart";
import { DemandDeviceBreakdownPanel } from "@/components/demandRadar/DemandDeviceBreakdown";
import { cn } from "@/lib/utils";

const LANGS: { code: string; labelKey: MessageKey }[] = [
  { code: "en", labelKey: "pages.demandRadar.langEn" },
  { code: "pt", labelKey: "pages.demandRadar.langPt" },
  { code: "es", labelKey: "pages.demandRadar.langEs" },
  { code: "fr", labelKey: "pages.demandRadar.langFr" },
  { code: "de", labelKey: "pages.demandRadar.langDe" },
  { code: "it", labelKey: "pages.demandRadar.langIt" },
];

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
  if (c === "low") return t("pages.demandRadar.competitionLow");
  if (c === "high") return t("pages.demandRadar.competitionHigh");
  return t("pages.demandRadar.competitionMedium");
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
  const [timeframe, setTimeframe] = useState<DemandPlannerTimeframe>("default");
  const [analysis, setAnalysis] = useState<DemandRadarAnalyze | null>(null);

  const overviewQ = useQuery({
    queryKey: ["demand-radar", "overview"],
    queryFn: async () => {
      const { data, error } = await demandRadarService.overview();
      if (error) throw new Error(error);
      return data!;
    },
  });

  const optionsQ = useQuery({
    queryKey: ["keyword-researches", "options"],
    queryFn: async () => {
      const { data, error } = await keywordResearchService.options();
      if (error) throw new Error(error);
      return data;
    },
  });

  const marketOptions = useMemo(
    () => marketsForLanguage(language, optionsQ.data?.markets ?? []),
    [language, optionsQ.data?.markets],
  );

  useEffect(() => {
    if (!marketOptions.length) return;
    if (!marketOptions.some((m) => m.code === market)) {
      setMarket(defaultMarketForLanguage(language));
    }
  }, [language, market, marketOptions]);

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
      setTimeframe(data.query.timeframe);
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
    const mkt = opts?.market ?? market;
    const lang = opts?.language ?? language;
    const tf = opts?.timeframe ?? timeframe;
    if (p.length < 2 || analyzeM.isPending) return;
    if (opts?.product) setProduct(p);
    if (opts?.market) setMarket(mkt);
    if (opts?.language) setLanguage(lang);
    if (opts?.timeframe) setTimeframe(tf);
    analyzeM.mutate({ product: p, market: mkt, language: lang, timeframe: tf });
  }

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
  const plannerOk = analysis?.planner.status === "ok";
  const primary = analysis?.planner.primary ?? null;
  const primaryKind = analysis?.planner.primary_kind ?? null;

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
            <Label>{t("pages.demandRadar.languageLabel")}</Label>
            <Select
              value={language}
              disabled={analyzeM.isPending}
              onValueChange={(v) => {
                setLanguage(v);
                setMarket(defaultMarketForLanguage(v));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {t(l.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("pages.demandRadar.marketLabel")}</Label>
            <Select value={market} disabled={analyzeM.isPending} onValueChange={setMarket}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(marketOptions.length ? marketOptions : [{ code: market, name: market }]).map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <Label>{t("pages.demandRadar.timeframeLabel")}</Label>
            <Select
              value={timeframe}
              disabled={analyzeM.isPending}
              onValueChange={(v) => setTimeframe(v as DemandPlannerTimeframe)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{t("pages.demandRadar.timeframeDefault")}</SelectItem>
                <SelectItem value="last_24">{t("pages.demandRadar.timeframe24")}</SelectItem>
                <SelectItem value="last_36">{t("pages.demandRadar.timeframe36")}</SelectItem>
              </SelectContent>
            </Select>
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
          {analysis ? (
            <Button asChild variant="secondary">
              <Link to={analysis.next_steps.keywords_path}>
                {t("pages.demandRadar.openKeywords")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {!analysis && !analyzeM.isPending ? (
        <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("pages.demandRadar.emptyAnalyzeHint")}
        </p>
      ) : null}

      {analyzeM.isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border/70 px-4 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("pages.demandRadar.analyzing")}
        </div>
      ) : null}

      {analysis && !analyzeM.isPending ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.resultsTitle")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge tone={plannerOk ? "google" : "muted"}>
                {plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              </SourceBadge>
            </div>
          </div>
          {!plannerOk && analysis.planner.message ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              {analysis.planner.message}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-4">
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
              value={primary ? competitionLabel(primary.competition, t) : t("pages.demandRadar.noVolume")}
              hint={plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              muted={!primary}
            />
            <KpiCell
              label={t("pages.demandRadar.sales")}
              value={formatInt(
                analysis.account.matching_offers.reduce((s, o) => s + o.approved_sales, 0),
                nl,
              )}
              hint={t("pages.demandRadar.sourceClickora")}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            {analysis.planner.trend ? (
              <DemandVolumeTrendChart
                trend={analysis.planner.trend}
                keyword={primary?.keyword ?? analysis.query.product}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                {t("pages.demandRadar.trendEmpty")}
              </div>
            )}
            <DemandDeviceBreakdownPanel devices={analysis.account.devices} />
          </div>

          <div className="rounded-lg border border-border/70 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-semibold">{t("pages.demandRadar.ideasTitle")}</h3>
              <SourceBadge tone={plannerOk ? "google" : "muted"}>
                {plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
              </SourceBadge>
            </div>
            {analysis.planner.ideas.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t("pages.demandRadar.ideasEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-semibold">{t("pages.demandRadar.thKeyword")}</th>
                      <th className="px-4 py-2 font-semibold tabular-nums">{t("pages.demandRadar.thVolume")}</th>
                      <th className="px-4 py-2 font-semibold tabular-nums">{t("pages.demandRadar.thCpc")}</th>
                      <th className="px-4 py-2 font-semibold">{t("pages.demandRadar.thCompetition")}</th>
                      <th className="px-4 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.planner.ideas.map((idea) => {
                      const isPrimary =
                        primary &&
                        idea.keyword.trim().toLowerCase() === primary.keyword.trim().toLowerCase();
                      return (
                        <tr
                          key={idea.keyword}
                          className={cn(
                            "border-t border-border/50",
                            isPrimary && "bg-sky-500/5",
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium">
                            {idea.keyword}
                            {isPrimary ? (
                              <span className="ml-2 text-[10px] font-semibold uppercase text-sky-700 dark:text-sky-300">
                                {primaryKindLabel(primaryKind, t)}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{formatInt(idea.monthly_volume, nl)}</td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {idea.avg_cpc > 0 ? formatMoney(idea.avg_cpc, nl) : t("pages.demandRadar.noVolume")}
                          </td>
                          <td className="px-4 py-2.5">{competitionLabel(idea.competition, t)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={analyzeM.isPending}
                              onClick={() => runAnalyze({ product: idea.keyword })}
                            >
                              {t("pages.demandRadar.useKeyword")}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border/70">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold">{t("pages.demandRadar.accountOffers")}</h3>
                <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
              </div>
              {analysis.account.matching_offers.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {t("pages.demandRadar.accountOffersEmpty")}
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {analysis.account.matching_offers.map((o) => (
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
              )}
            </div>

            <div className="rounded-lg border border-border/70">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold">{t("pages.demandRadar.accountResearches")}</h3>
                <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
              </div>
              {analysis.account.matching_researches.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {t("pages.demandRadar.accountResearchesEmpty")}
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {analysis.account.matching_researches.map((r) => (
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
              )}
            </div>
          </div>
        </section>
      ) : null}

      {!analysis ? <DemandDeviceBreakdownPanel devices={overview.devices} /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/70">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold">{t("pages.demandRadar.topOffers")}</h3>
            <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
          </div>
          {overview.internal_offers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t("pages.demandRadar.topOffersEmpty")}</p>
          ) : (
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
          )}
        </div>

        <div className="rounded-lg border border-border/70">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold">{t("pages.demandRadar.recentResearches")}</h3>
            <SourceBadge tone="clickora">{t("pages.demandRadar.sourceClickora")}</SourceBadge>
          </div>
          {overview.recent_researches.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("pages.demandRadar.recentResearchesEmpty")}
            </p>
          ) : (
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
          )}
        </div>
      </section>

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
    </div>
  );
}
