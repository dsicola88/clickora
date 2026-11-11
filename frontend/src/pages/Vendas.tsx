import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Info, RefreshCw } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { SyncHealthBanner } from "@/components/SyncHealthBanner";
import { analyticsService } from "@/services/analyticsService";
import { rangeLast30Days } from "@/lib/dateRangePresets";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor } from "@/i18n";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProToolbar,
  ProKpiGrid,
  ProKpiCell,
  ProPanel,
  ProEmpty,
  ProAlert,
  ProStatusDot,
  ProInlineLink,
  ProReportTh,
  ProReportTd,
  ProTotalsBar,
  ProTotalStat,
} from "@/components/enterprise/ProShell";

function money(n: number | null | undefined, currency = "USD", locale = "pt-PT") {
  if (n == null || !Number.isFinite(n)) return "—";
  const cur = currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD";
  try {
    return n.toLocaleString(locale, { style: "currency", currency: cur, maximumFractionDigits: 2 });
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

function pct(n: number | null | undefined, locale = "pt-PT") {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
}

function xNum(n: number | null | undefined, locale = "pt-PT") {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString(locale, { maximumFractionDigits: 2 })}x`;
}

function int(n: number | null | undefined, locale = "pt-PT") {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(locale);
}

const STAGE_TONE: Record<string, string> = {
  impressions: "hsl(215 16% 47%)",
  clicks: "hsl(172 66% 38%)",
  checkouts: "hsl(28 92% 48%)",
  sales: "hsl(152 65% 40%)",
};

/** Funil alinhado a GET /analytics/funnel — mesmas regras KPI que Resultados. */
export default function Vendas() {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const initial = useMemo(() => rangeLast30Days(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [keyword, setKeyword] = useState("all");

  const { data, isLoading, isError, refetch, isFetching, error } = useQuery({
    queryKey: ["analytics", "funnel", from, to, keyword],
    queryFn: async () => {
      const { data, error } = await analyticsService.getFunnel({
        from,
        to,
        keyword: keyword === "all" ? undefined : keyword,
      });
      if (error) throw new Error(error);
      return data!;
    },
  });

  const chartSeries = useMemo(() => {
    if (!data?.series?.length) return [];
    return data.series.map((row) => ({
      date: row.date.slice(5),
      fullDate: row.date,
      impressions: row.impressions,
      clicks: row.clicks,
      checkouts: row.checkouts,
      sales: row.sales,
      paid: row.paid_sales,
      ads_sem_id: row.paid_untracked_sales,
      organic: row.organic_sales,
    }));
  }, [data?.series]);

  const keywordOptions = useMemo(() => {
    const fromApi = (data?.keywords ?? []).map((k) => k.keyword);
    if (keyword !== "all" && !fromApi.includes(keyword)) {
      return [keyword, ...fromApi];
    }
    return fromApi;
  }, [data?.keywords, keyword]);

  if (isLoading && !data) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message={t("pages.funnel.loading")} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <ErrorState
          message={error instanceof Error ? error.message : t("pages.funnel.loadError")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const { stages, traffic, roi, definitions } = data;
  const currency = roi.spend_currency || "USD";
  const hasVolume = stages.some((s) => s.count > 0);
  const spendOk =
    (roi.spend_source === "persisted" || roi.spend_source === "keyword") &&
    roi.spend != null &&
    roi.spend > 0;
  const spendLabel =
    roi.spend_source === "keyword"
      ? t("pages.funnel.spendKeyword")
      : roi.spend_source === "persisted"
        ? t("pages.funnel.spendPeriod")
        : t("pages.funnel.spendNone");
  const alerts = data.alerts ?? [];

  return (
    <div className={PRO_PAGE_SHELL}>
      <SyncHealthBanner className="mb-4" syncHealth={data.sync_health} />
      <ProPageHeader
        title={t("pages.funnel.title")}
        subtitle={t("pages.funnel.subtitle")}
        meta={
          <>
            <span className="font-mono tabular-nums">
              {data.period.from} → {data.period.to}
            </span>
            <span>{t("common.universalTime")}</span>
            {isFetching ? <span>{t("common.updating")}</span> : null}
            <ProStatusDot ok={spendOk} label={spendLabel} />
            {data.filter.keyword ? (
              <span className="font-mono text-[11px]">keyword: {data.filter.keyword}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Info className="h-3.5 w-3.5" /> {t("pages.funnel.definitions")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t("pages.funnel.definitionsTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("pages.funnel.definitionsDesc")}
                  </DialogDescription>
                </DialogHeader>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.labelImpressions")}:</strong> {definitions.impressions}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.labelClicks")}:</strong> {definitions.clicks}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.labelCheckouts")}:</strong> {definitions.checkouts}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.labelSales")}:</strong> {definitions.sales}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.labelPaid")}:</strong> {definitions.paid}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.noClickId")}:</strong> {definitions.paid_untracked}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.labelOrganic")}:</strong> {definitions.organic}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("pages.funnel.labelExclusions")}:</strong> {definitions.kpi_noise}
                  </li>
                </ul>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
            <ProInlineLink to="/resultados">{t("pages.funnel.resultsLink")}</ProInlineLink>
            <ProInlineLink to="/resultados/relatorios/conversoes">{t("pages.funnel.conversionsLink")}</ProInlineLink>
          </>
        }
      />

      <ProToolbar>
        <div className="flex flex-col gap-1.5 min-w-[220px]">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("common.period")}</Label>
          <DateRangeFilter
            from={from}
            to={to}
            onApply={(p) => {
              setFrom(p.from);
              setTo(p.to);
            }}
            showCompare={false}
          />
        </div>
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("pages.funnel.keywordFilter")}</Label>
          <Select value={keyword} onValueChange={setKeyword}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("common.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {keywordOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ProToolbar>

      {alerts.length > 0 ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {alerts.slice(0, 4).map((a) => (
            <ProAlert key={a.code} severity={a.severity} title={a.title} detail={a.detail} />
          ))}
        </div>
      ) : !spendOk ? (
        <ProAlert
          severity="info"
          title={t("pages.funnel.incompleteReturn")}
          detail={t("pages.funnel.incompleteReturnDetail")}
        />
      ) : null}

      <ProKpiGrid>
        {stages.map((s) => (
          <ProKpiCell
            key={s.id}
            label={s.label}
            value={int(s.count, numLocale)}
            hint={
              s.rate_from_previous != null
                ? fill(t("pages.funnel.fromPreviousTop"), {
                    prev: pct(s.rate_from_previous, numLocale),
                    top: pct(s.rate_from_top, numLocale),
                  })
                : s.rate_from_top != null
                  ? fill(t("pages.funnel.fromTop"), { top: pct(s.rate_from_top, numLocale) })
                  : undefined
            }
          />
        ))}
        <ProKpiCell label={t("common.revenue")} value={money(roi.revenue, currency, numLocale)} />
        <ProKpiCell
          label={t("common.cost")}
          value={money(roi.spend, currency, numLocale)}
          hint={spendOk ? spendLabel : t("pages.funnel.noSync")}
          tone={spendOk ? undefined : "muted"}
        />
        <ProKpiCell
          label={t("common.profit")}
          value={money(roi.profit, currency, numLocale)}
          tone={roi.profit == null ? "muted" : roi.profit >= 0 ? "positive" : "negative"}
        />
        <ProKpiCell
          label={t("pages.results.kpiRoi")}
          value={roi.roi_pct != null ? pct(roi.roi_pct, numLocale) : "—"}
          hint={roi.roas != null ? `ROAS ${xNum(roi.roas, numLocale)}` : undefined}
          tone={roi.roi_pct == null ? "muted" : roi.roi_pct >= 0 ? "positive" : "negative"}
        />
      </ProKpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProPanel title={t("pages.funnel.stagesTitle")} description={t("pages.funnel.stagesDesc")}>
          {!hasVolume ? (
            <ProEmpty title={t("pages.funnel.emptyVolume")} />
          ) : (
            <div className="space-y-3 px-4 py-4">
              {stages.map((s) => {
                const width =
                  s.rate_from_top != null ? Math.max(4, Math.min(100, s.rate_from_top)) : s.count > 0 ? 100 : 4;
                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {int(s.count, numLocale)}
                        {s.rate_from_previous != null ? (
                          <span className="ml-2 text-[11px]">→ {pct(s.rate_from_previous, numLocale)}</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${width}%`, backgroundColor: STAGE_TONE[s.id] ?? "hsl(var(--primary))" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ProPanel>

        <ProPanel
          title={t("pages.funnel.paidVsOrganic")}
          description={t("pages.funnel.paidVsOrganicDesc")}
        >
          <div className="px-4 pt-4">
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("pages.funnel.labelPaid")}</p>
                <p className="text-lg font-semibold tabular-nums">{int(traffic.paid_sales, numLocale)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {pct(traffic.paid_pct, numLocale)} · {money(traffic.paid_revenue, currency, numLocale)}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("pages.funnel.noClickId")}</p>
                <p className="text-lg font-semibold tabular-nums">{int(traffic.paid_untracked_sales, numLocale)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {pct(traffic.paid_untracked_pct, numLocale)} · {money(traffic.paid_untracked_revenue, currency, numLocale)}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("pages.funnel.labelOrganic")}</p>
                <p className="text-lg font-semibold tabular-nums">{int(traffic.organic_sales, numLocale)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {pct(traffic.organic_pct, numLocale)} · {money(traffic.organic_revenue, currency, numLocale)}
                </p>
              </div>
            </div>
          </div>
          {chartSeries.length === 0 ? (
            <ProEmpty title={t("pages.funnel.emptySalesSeries")} />
          ) : (
            <div className="h-56 px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip
                    labelFormatter={(_, payload) => {
                      const full = payload?.[0]?.payload?.fullDate;
                      return typeof full === "string" ? full : "";
                    }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="paid"
                    name={t("pages.funnel.labelPaid")}
                    stroke="hsl(172 66% 38%)"
                    fill="hsl(172 66% 38%)"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="ads_sem_id"
                    name={t("pages.funnel.noClickId")}
                    stroke="hsl(38 88% 50%)"
                    fill="hsl(38 88% 50%)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="organic"
                    name={t("pages.funnel.labelOrganic")}
                    stroke="hsl(28 92% 48%)"
                    fill="hsl(28 92% 48%)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ProPanel>
      </div>

      <ProPanel title={t("pages.funnel.volumeTitle")} description={t("pages.funnel.volumeDesc")}>
        {chartSeries.length === 0 ? (
          <ProEmpty title={t("pages.funnel.emptyDaily")} />
        ) : (
          <div className="h-64 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const full = payload?.[0]?.payload?.fullDate;
                    return typeof full === "string" ? full : "";
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  name={t("common.impressions")}
                  stroke={STAGE_TONE.impressions}
                  fill={STAGE_TONE.impressions}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  name={t("common.clicks")}
                  stroke={STAGE_TONE.clicks}
                  fill={STAGE_TONE.clicks}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="checkouts"
                  name={t("common.checkouts")}
                  stroke={STAGE_TONE.checkouts}
                  fill={STAGE_TONE.checkouts}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name={t("common.sales")}
                  stroke={STAGE_TONE.sales}
                  fill={STAGE_TONE.sales}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </ProPanel>

      <ProPanel
        title={t("pages.funnel.keywordsTitle")}
        description={t("pages.funnel.keywordsDesc")}
        actions={
          <Link to="/integracoes" className="text-[11px] font-medium text-primary hover:underline">
            {t("nav.integrations")}
          </Link>
        }
      >
        {(data.keywords ?? []).length === 0 ? (
          <ProEmpty title={t("pages.funnel.emptyKeywords")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left">
                  <ProReportTh align="left">{t("common.keyword")}</ProReportTh>
                  <ProReportTh>{t("common.clicks")}</ProReportTh>
                  <ProReportTh>{t("common.checkouts")}</ProReportTh>
                  <ProReportTh>{t("common.sales")}</ProReportTh>
                  <ProReportTh>{t("common.revenue")}</ProReportTh>
                  <ProReportTh>{t("common.cost")}</ProReportTh>
                  <ProReportTh>{t("common.profit")}</ProReportTh>
                  <ProReportTh>{t("pages.results.colRoi")}</ProReportTh>
                  <ProReportTh>{t("pages.results.colCvr")}</ProReportTh>
                </tr>
              </thead>
              <tbody>
                {data.keywords.map((row) => (
                  <tr key={row.keyword} className="border-b border-border/40 hover:bg-muted/20">
                    <ProReportTd align="left">
                      <button
                        type="button"
                        className="text-left font-medium text-foreground hover:underline"
                        onClick={() => setKeyword(row.keyword)}
                      >
                        {row.keyword}
                      </button>
                    </ProReportTd>
                    <ProReportTd>{int(row.clicks, numLocale)}</ProReportTd>
                    <ProReportTd>{int(row.checkouts, numLocale)}</ProReportTd>
                    <ProReportTd>{int(row.sales, numLocale)}</ProReportTd>
                    <ProReportTd>{money(row.revenue, currency, numLocale)}</ProReportTd>
                    <ProReportTd>{money(row.cost, currency, numLocale)}</ProReportTd>
                    <ProReportTd
                      tone={row.profit == null ? "muted" : row.profit >= 0 ? "positive" : "negative"}
                    >
                      {money(row.profit, currency, numLocale)}
                    </ProReportTd>
                    <ProReportTd>
                      {row.roi_pct != null ? pct(row.roi_pct, numLocale) : row.roas != null ? xNum(row.roas, numLocale) : "—"}
                    </ProReportTd>
                    <ProReportTd>{pct(row.cvr, numLocale)}</ProReportTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ProTotalsBar>
          <ProTotalStat label={t("common.clicks")} value={int(stages.find((s) => s.id === "clicks")?.count, numLocale)} />
          <ProTotalStat label={t("common.sales")} value={int(stages.find((s) => s.id === "sales")?.count, numLocale)} />
          <ProTotalStat label={t("common.revenue")} value={money(roi.revenue, currency, numLocale)} />
          <ProTotalStat label="CPA" value={money(roi.cpa, currency, numLocale)} />
          <ProTotalStat label="EPC" value={money(roi.epc, currency, numLocale)} />
          <ProTotalStat label="CVR" value={pct(roi.conversion_rate, numLocale)} />
        </ProTotalsBar>
      </ProPanel>
    </div>
  );
}
