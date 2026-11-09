import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, RefreshCw, Search } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { analyticsService } from "@/services/analyticsService";
import { campaignsService } from "@/services/campaignsService";
import { rangeToday, previousPeriodOfSameLength } from "@/lib/dateRangePresets";
import { AttributionHealthBanner } from "@/components/AttributionHealthBanner";
import { SyncHealthBanner } from "@/components/SyncHealthBanner";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { countryDisplayLabel, countryFlagEmoji, normalizeIsoCountryCode } from "@/lib/countryDisplay";
import { toast } from "sonner";
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
  ProDimTabs,
  ProReportTh,
  ProReportTd,
  ProTotalsBar,
  ProTotalStat,
} from "@/components/enterprise/ProShell";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";

type DimId =
  | "offers"
  | "countries"
  | "campaigns"
  | "keywords"
  | "adgroups"
  | "devices"
  | "sources"
  | "rotators"
  | "arms";

type ReportRow = {
  id: string;
  label: string;
  sub?: string;
  href?: string;
  clicks: number;
  checkouts?: number;
  sales: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
  roas: number | null;
  roi: number | null;
  epc: number | null;
  cvr: number | null;
  /** Cap do braço do rotador (Fase 2). */
  cap_pct?: number | null;
  cap_remaining?: number | null;
  max_clicks?: number | null;
};

function money(n: number | null | undefined, currency = "USD") {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 });
}

function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
}

function xNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x`;
}

function spendSourceLabel(src: string | undefined, t: (k: import("@/i18n").MessageKey) => string) {
  if (src === "persisted") return t("pages.results.spendPersisted");
  if (src === "google_ads") return t("pages.results.spendGoogle");
  if (src === "manual") return t("pages.results.spendManual");
  return t("pages.results.spendNone");
}

function deltaLabel(pctVal: number | null | undefined) {
  if (pctVal == null || !Number.isFinite(pctVal)) return null;
  const sign = pctVal > 0 ? "+" : "";
  return `${sign}${pctVal.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
}

function roiOf(profit: number | null, cost: number | null): number | null {
  if (profit == null || cost == null || cost <= 0) return null;
  return Math.round((profit / cost) * 10000) / 100;
}

function deviceLabel(d: string, t: (k: import("@/i18n").MessageKey) => string) {
  const x = d.toLowerCase();
  if (x === "mobile" || x === "mobile phone") return t("pages.results.deviceMobile");
  if (x === "desktop") return t("pages.results.deviceDesktop");
  if (x === "tablet") return t("pages.results.deviceTablet");
  if (x === "(desconhecido)" || x === "unknown") return t("pages.results.deviceUnknown");
  return d;
}

type ExtraCol = "cost" | "profit" | "roi" | "roas" | "cvr" | "epc";
const ALL_EXTRA_COLS: ExtraCol[] = ["cost", "profit", "roi", "roas", "cvr", "epc"];
const COLS_STORAGE = "dclickora.results.extraCols";

function readExtraCols(): ExtraCol[] {
  try {
    const raw = localStorage.getItem(COLS_STORAGE);
    if (!raw) return [...ALL_EXTRA_COLS];
    const parsed = JSON.parse(raw) as string[];
    return ALL_EXTRA_COLS.filter((c) => parsed.includes(c));
  } catch {
    return [...ALL_EXTRA_COLS];
  }
}

/** P&L estilo tracker enterprise — dimensões + grelha densa + totais. */
export default function ResultsOverviewPage() {
  const { t } = useAppLocale();
  const EXTRA_COL_LABELS: Record<ExtraCol, string> = {
    cost: t("pages.results.colCost"),
    profit: t("pages.results.colProfit"),
    roi: t("pages.results.colRoi"),
    roas: t("pages.results.colRoas"),
    cvr: t("pages.results.colCvr"),
    epc: t("pages.results.colEpc"),
  };
  const initial = useMemo(() => rangeToday(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [compare, setCompare] = useState<{ from: string; to: string } | null>(null);
  const [dim, setDim] = useState<DimId>("offers");
  const [q, setQ] = useState("");
  const [extraCols, setExtraCols] = useState<ExtraCol[]>(() =>
    typeof window !== "undefined" ? readExtraCols() : [...ALL_EXTRA_COLS],
  );
  const [liveRefresh, setLiveRefresh] = useState(false);
  const colOn = (c: ExtraCol) => extraCols.includes(c);
  const toggleCol = (c: ExtraCol) => {
    setExtraCols((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      try {
        localStorage.setItem(COLS_STORAGE, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", "results", from, to, compare?.from, compare?.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({
        from,
        to,
        compare_from: compare?.from,
        compare_to: compare?.to,
      });
      if (error) throw new Error(error);
      return data!;
    },
    refetchInterval: liveRefresh ? 30_000 : false,
  });

  const {
    data: campaigns = [],
    refetch: refetchCampaigns,
    isFetching: fetchingCampaigns,
    isError: campaignsError,
  } = useQuery({
    queryKey: ["campaigns", "stats", from, to],
    queryFn: async () => {
      const { data, error } = await campaignsService.list({ with_stats: true, from, to });
      if (error) throw new Error(error);
      return data ?? [];
    },
    refetchInterval: liveRefresh ? 30_000 : false,
  });

  const refreshAll = () => {
    void refetch();
    void refetchCampaigns();
  };

  const rowsByDim = useMemo((): Record<DimId, ReportRow[]> => {
    if (!data) {
      return {
        offers: [],
        campaigns: [],
        keywords: [],
        adgroups: [],
        countries: [],
        devices: [],
        sources: [],
        rotators: [],
        arms: [],
      };
    }
    const keywords: ReportRow[] = (data.keyword_performance ?? []).map((r) => ({
      id: r.keyword,
      label: r.keyword,
      clicks: r.clicks,
      sales: r.sales,
      revenue: r.revenue,
      cost: r.cost ?? null,
      profit: r.profit ?? null,
      roas: r.roas ?? null,
      roi: roiOf(r.profit ?? null, r.cost ?? null),
      epc: r.epc,
      cvr: r.cvr,
    }));
    const adgroups: ReportRow[] = (data.ad_group_performance ?? []).map((r) => ({
      id: r.ad_group,
      label: r.ad_group,
      clicks: r.clicks,
      sales: r.sales,
      revenue: r.revenue,
      cost: r.cost,
      profit: r.profit,
      roas: r.roas,
      roi: roiOf(r.profit, r.cost),
      epc: r.clicks > 0 ? Math.round((r.revenue / r.clicks) * 10000) / 10000 : null,
      cvr: r.clicks > 0 ? Math.round((r.sales / r.clicks) * 10000) / 100 : null,
    }));
    const offers: ReportRow[] = (data.offer_performance ?? []).map((r) => ({
      id: r.presell_id || r.offer,
      label: r.offer,
      clicks: r.clicks,
      checkouts: r.checkouts,
      sales: r.sales,
      revenue: r.revenue,
      cost: null,
      profit: null,
      roas: null,
      roi: null,
      epc: r.epc,
      cvr: r.cvr,
    }));
    const countries: ReportRow[] = (data.country_performance ?? []).map((r) => {
      const iso = normalizeIsoCountryCode(r.country === "(sem país)" ? "" : r.country);
      return {
      id: r.country,
      label: iso ? countryDisplayLabel(iso) : r.country,
      sub: iso ?? undefined,
      clicks: r.clicks,
      checkouts: r.checkouts ?? 0,
      sales: r.sales,
      revenue: r.revenue,
      cost: null,
      profit: null,
      roas: null,
      roi: null,
      epc: r.epc,
      cvr: r.cvr,
      };
    });
    const devices: ReportRow[] = (data.device_performance ?? []).map((r) => ({
      id: r.device,
      label: deviceLabel(r.device, t),
      clicks: r.clicks,
      sales: r.sales,
      revenue: r.revenue,
      cost: null,
      profit: null,
      roas: null,
      roi: null,
      epc: r.epc,
      cvr: r.cvr,
    }));
    const sources: ReportRow[] = (data.source_performance ?? []).map((r) => ({
      id: r.source,
      label: r.source,
      clicks: r.clicks,
      sales: r.sales,
      revenue: r.revenue,
      cost: null,
      profit: null,
      roas: null,
      roi: null,
      epc: r.epc,
      cvr: r.cvr,
    }));
    const rotators: ReportRow[] = (data.rotator_performance ?? []).map((r) => ({
      id: r.rotator_id,
      label: r.rotator_name,
      clicks: r.clicks,
      sales: r.sales,
      revenue: r.revenue,
      cost: r.cost ?? null,
      profit: r.profit ?? null,
      roas: r.roas ?? null,
      roi: roiOf(r.profit ?? null, r.cost ?? null),
      epc: r.epc,
      cvr: r.cvr,
    }));
    const arms: ReportRow[] = (data.rotator_arm_performance ?? []).map((r) => ({
      id: r.arm_id,
      label: r.arm_label,
      sub:
        r.max_clicks != null
          ? `${r.rotator_name} · limite ${r.clicks_delivered}/${r.max_clicks}${r.cap_pct != null ? ` (${r.cap_pct}%)` : ""}`
          : r.rotator_name,
      clicks: r.clicks,
      sales: r.sales,
      revenue: r.revenue,
      cost: r.cost ?? null,
      profit: r.profit ?? null,
      roas: r.roas ?? null,
      roi: roiOf(r.profit ?? null, r.cost ?? null),
      epc: r.epc,
      cvr: r.cvr,
      max_clicks: r.max_clicks,
      cap_pct: r.cap_pct,
      cap_remaining: r.cap_remaining,
    }));
    const campaignRows: ReportRow[] = [...campaigns]
      .filter((c) => c.stats && (c.stats.clicks > 0 || c.stats.conversions > 0 || (c.spend_amount ?? 0) > 0))
      .map((c) => {
        const s = c.stats!;
        /**
         * Spend truth: gasto manual na ficha é lifetime — NÃO entra em custo/lucro/ROAS da grelha
         * (igual ao ROAS de conta). Só receita/cliques/EPC/CVR do período.
         */
        return {
          id: c.id,
          label: c.name,
          sub: c.traffic_source,
          href: `/campanhas/${c.id}`,
          clicks: s.clicks,
          sales: s.conversions,
          revenue: s.revenue,
          cost: null,
          profit: null,
          roas: null,
          roi: null,
          epc: s.epc,
          cvr: s.conversion_rate,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return {
      offers,
      campaigns: campaignRows,
      keywords,
      adgroups,
      countries,
      devices,
      sources,
      rotators,
      arms,
    };
  }, [data, campaigns, t]);

  if (isLoading) return <LoadingState message={t("pages.results.loading")} />;
  if (isError || !data) return <ErrorState message={t("pages.results.loadError")} onRetry={() => refetch()} />;

  const mb = data.media_buyer;
  const health = data.account_health;
  const currency = (mb?.spend_currency || "USD").toUpperCase();
  const clicks = data.entry_clicks ?? data.total_clicks ?? 0;
  const hopClicks = data.total_hops ?? data.total_clicks ?? clicks;
  const impressions = data.total_impressions ?? 0;
  const conversions = data.approved_sales_count ?? data.total_conversions ?? 0;
  const revenue = mb?.revenue ?? data.revenue ?? 0;
  const rate = mb?.conversion_rate ?? data.conversion_rate ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);
  const cmp = data.compare;
  const attr = health?.attribution;
  const alerts = mb?.alerts ?? [];
  // CTA hops ÷ page impressions — never use entry/root clicks here (can exceed 100%).
  const rawCtr = impressions > 0 ? (hopClicks / impressions) * 100 : null;
  const ctr = rawCtr != null && Number.isFinite(rawCtr) && rawCtr >= 0 && rawCtr <= 100 ? rawCtr : null;
  const accountRoi = roiOf(mb?.profit ?? null, mb?.spend ?? null);

  const dimTabs: Array<{ id: DimId; label: string; count: number }> = [
    { id: "offers", label: t("pages.results.dimOffers"), count: rowsByDim.offers.length },
    { id: "countries", label: t("pages.results.dimCountries"), count: rowsByDim.countries.length },
    { id: "campaigns", label: t("pages.results.dimCampaigns"), count: rowsByDim.campaigns.length },
    { id: "keywords", label: t("pages.results.dimKeywords"), count: rowsByDim.keywords.length },
    { id: "adgroups", label: t("pages.results.dimAdgroups"), count: rowsByDim.adgroups.length },
    { id: "devices", label: t("pages.results.dimDevices"), count: rowsByDim.devices.length },
    { id: "sources", label: t("pages.results.dimSources"), count: rowsByDim.sources.length },
    { id: "rotators", label: t("pages.results.dimRotators"), count: rowsByDim.rotators.length },
    { id: "arms", label: t("pages.results.dimArms"), count: rowsByDim.arms.length },
  ];

  const activeRows = rowsByDim[dim].filter((r) => {
    if (!q.trim()) return true;
    return r.label.toLowerCase().includes(q.trim().toLowerCase()) || (r.sub || "").toLowerCase().includes(q.trim().toLowerCase());
  });

  const showCheckouts = dim === "offers" || dim === "countries";
  const dimHint: Record<DimId, string> = {
    offers: t("pages.results.hintOffers"),
    campaigns: t("pages.results.hintCampaigns"),
    keywords: t("pages.results.hintKeywords"),
    adgroups: t("pages.results.hintAdgroups"),
    countries: t("pages.results.hintCountries"),
    devices: t("pages.results.hintDevices"),
    sources: t("pages.results.hintSources"),
    rotators: t("pages.results.hintRotators"),
    arms: t("pages.results.hintArms"),
  };

  const exportCsv = () => {
    if (!activeRows.length) {
      toast.message(t("pages.results.exportEmpty"));
      return;
    }
    const headers = [
      "nome",
      "detalhe",
      "visitantes",
      "checkouts",
      "vendas",
      "receita",
      "custo",
      "lucro",
      "retorno_do_gasto",
      "retorno",
      "por_visita",
      "taxa_de_venda",
      "cap_pct",
      "cap_restante",
      "max_clicks",
    ];
    const lines = [
      headers.join(","),
      ...activeRows.map((r) =>
        [
          JSON.stringify(r.label),
          JSON.stringify(r.sub ?? ""),
          r.clicks,
          r.checkouts ?? "",
          r.sales,
          r.revenue,
          r.cost ?? "",
          r.profit ?? "",
          r.roas ?? "",
          r.roi ?? "",
          r.epc ?? "",
          r.cvr ?? "",
          r.cap_pct ?? "",
          r.cap_remaining ?? "",
          r.max_clicks ?? "",
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl_${dim}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("pages.results.exportDone"));
  };

  const totClicks = activeRows.reduce((s, r) => s + r.clicks, 0);
  const totSales = activeRows.reduce((s, r) => s + r.sales, 0);
  const totRev = activeRows.reduce((s, r) => s + r.revenue, 0);
  const totCostParts = activeRows.map((r) => r.cost).filter((c): c is number => c != null);
  const totCost = totCostParts.length ? totCostParts.reduce((s, c) => s + c, 0) : null;
  const totProfit =
    totCost != null ? Math.round((totRev - totCost) * 100) / 100 : activeRows.every((r) => r.profit == null) ? null : activeRows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totRoas = totCost != null && totCost > 0 ? Math.round((totRev / totCost) * 100) / 100 : null;
  const totRoi = roiOf(totProfit, totCost);
  const totEpc = totClicks > 0 ? totRev / totClicks : null;
  const totCvr = totClicks > 0 ? (totSales / totClicks) * 100 : null;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.results.title")}
        subtitle={t("pages.results.subtitle")}
        meta={
          <>
            <span className="font-mono tabular-nums">
              {from} → {to}
            </span>
            <span>{t("common.universalTime")}</span>
            {isFetching ? <span>{t("common.updating")}</span> : null}
            {health ? <ProStatusDot ok={health.score >= 85} label={fill(t("pages.results.healthScore"), { n: health.score })} /> : null}
            {attr && attr.approved_sales > 0 ? (
              <ProStatusDot ok={attr.unattributed_sales === 0} label={fill(t("pages.results.attributedSales"), { n: attr.attribution_rate ?? 0 })} />
            ) : null}
            <ProStatusDot
              ok={mb?.spend_source === "persisted" || mb?.spend_source === "google_ads"}
              label={spendSourceLabel(mb?.spend_source, t)}
            />
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/resultados/funil">
                {t("pages.results.funnelLink")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/resultados/relatorios/acessos">
                {t("pages.results.eventsLink")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        }
      />

      {health ? (
        <AttributionHealthBanner
          className="mb-4"
          attribution={health.attribution}
          checks={health.checks}
        />
      ) : null}
      <SyncHealthBanner className="mb-4" syncHealth={data.sync_health} />
      <TrackPathStatus className="mb-4" />

      <ProToolbar>
        <DateRangeFilter
          from={from}
          to={to}
          showCompare
          onApply={(p) => {
            setFrom(p.from);
            setTo(p.to);
            setCompare(p.compare ?? null);
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setCompare(previousPeriodOfSameLength(from, to))}
        >
          {t("pages.results.vsPrevious")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => refreshAll()}
          disabled={isFetching || fetchingCampaigns}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching || fetchingCampaigns ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
        <Button
          variant={liveRefresh ? "secondary" : "ghost"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setLiveRefresh((v) => !v)}
          title={t("pages.results.liveTitle")}
        >
          {liveRefresh ? t("pages.results.liveOn") : t("pages.results.liveOff")}
        </Button>
        {cmp ? (
          <span className="text-[11px] text-muted-foreground">
            {fill(t("pages.results.comparedWith"), {
              from: cmp.period.from,
              to: cmp.period.to,
              clicks: cmp.clicks,
              sales: cmp.conversions,
              revenue: money(cmp.revenue, currency),
            })}
          </span>
        ) : null}
      </ProToolbar>

      {health && health.score < 100 && health.checks.some((c) => !c.ok) ? (
        <ProPanel
          title={t("pages.results.opsTitle")}
          description={t("pages.results.opsDesc")}
          actions={<ProInlineLink to="/integracoes">{t("nav.integrations")}</ProInlineLink>}
        >
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {health.checks
              .filter((c) => !c.ok)
              .map((c) => (
                <div key={c.id} className="border-b border-r border-border/50 px-4 py-3">
                  <ProStatusDot ok={false} label={c.title} />
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{c.detail}</p>
                  {c.href ? (
                    <Link to={c.href} className="mt-1.5 inline-block text-[11px] font-medium text-primary hover:underline">
                      {t("common.resolve")}
                    </Link>
                  ) : null}
                </div>
              ))}
          </div>
        </ProPanel>
      ) : null}

      {alerts.length > 0 ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {alerts.slice(0, 4).map((a) => (
            <ProAlert key={a.code} severity={a.severity} title={a.title} detail={a.detail} />
          ))}
        </div>
      ) : null}

      <ProKpiGrid>
        <ProKpiCell
          label={t("pages.results.kpiVisitors")}
          value={clicks.toLocaleString("pt-PT")}
          hint={
            hopClicks > clicks
              ? fill(t("pages.results.kpiVisitorsHintHops"), {
                  root: clicks.toLocaleString("pt-PT"),
                  hops: hopClicks.toLocaleString("pt-PT"),
                })
              : t("pages.results.kpiVisitorsHint")
          }
          delta={deltaLabel(cmp?.delta.clicks_pct)}
        />
        <ProKpiCell
          label={t("pages.results.kpiCheckouts")}
          value={(data.checkout_visitors ?? 0).toLocaleString("pt-PT")}
          hint={
            (data.checkout_visitors ?? 0) > 0
              ? t("pages.results.kpiCheckoutsHintOk")
              : t("pages.results.kpiCheckoutsHintEmpty")
          }
        />
        <ProKpiCell
          label={t("pages.results.kpiConversions")}
          value={conversions.toLocaleString("pt-PT")}
          hint={t("pages.results.kpiConversionsHint")}
          delta={deltaLabel(cmp?.delta.conversions_pct)}
        />
        <ProKpiCell
          label={t("pages.results.kpiRevenue")}
          value={money(revenue, currency)}
          delta={deltaLabel(cmp?.delta.revenue_pct)}
        />
        <ProKpiCell
          label={t("pages.results.kpiCost")}
          value={money(mb?.spend ?? null, currency)}
          hint={
            mb?.spend_by_platform
              ? Object.entries(mb.spend_by_platform)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${k.replace(/_/g, " ")} ${money(v, currency)}`)
                  .join(" · ") || spendSourceLabel(mb?.spend_source, t)
              : spendSourceLabel(mb?.spend_source, t)
          }
        />
        <ProKpiCell
          label={t("pages.results.kpiProfit")}
          value={money(mb?.profit ?? null, currency)}
          tone={mb?.profit != null ? (mb.profit >= 0 ? "positive" : "negative") : "muted"}
        />
        <ProKpiCell
          label={t("pages.results.kpiRoi")}
          value={accountRoi != null ? pct(accountRoi) : "—"}
          tone={accountRoi != null ? (accountRoi >= 0 ? "positive" : "negative") : "muted"}
        />
        <ProKpiCell
          label={t("pages.results.kpiRoas")}
          value={mb?.roas != null ? xNum(mb.roas) : "—"}
          hint={fill(t("pages.results.kpiRoasHint"), {
            epc: money(mb?.epc ?? null, currency),
            cvr: pct(rate),
            ctr: ctr != null ? fill(t("pages.results.kpiRoasCtr"), { ctr: pct(ctr) }) : "",
          })}
        />
      </ProKpiGrid>

      <ProPanel
        title={t("pages.results.chartTitle")}
        description={t("pages.results.chartDesc")}
      >
        {(data.chart_data ?? []).length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">{t("pages.results.chartEmpty")}</p>
        ) : (
          <div className="h-72 w-full px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.chart_data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#cbd5e1" strokeDasharray="" vertical horizontal />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#334155" }}
                  tickFormatter={(v: string) => v.slice(5)}
                  axisLine={{ stroke: "#334155", strokeWidth: 1 }}
                  tickLine={{ stroke: "#334155" }}
                />
                <YAxis
                  yAxisId="visitors"
                  allowDecimals={false}
                  width={32}
                  tick={{ fontSize: 10, fill: "#334155" }}
                  axisLine={{ stroke: "#334155", strokeWidth: 1 }}
                  tickLine={{ stroke: "#334155" }}
                />
                {(data.chart_data ?? []).some((point) => (point.sale_revenue ?? 0) > 0) ? (
                  <YAxis
                    yAxisId="sales"
                    orientation="right"
                    width={44}
                    tick={{ fontSize: 10, fill: "#15803d" }}
                    axisLine={{ stroke: "#166534", strokeWidth: 1 }}
                    tickLine={{ stroke: "#166534" }}
                    tickFormatter={(v: number) =>
                      Number(v).toLocaleString("pt-PT", { maximumFractionDigits: 0 })
                    }
                  />
                ) : null}
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as {
                      clicks?: number;
                      checkouts?: number;
                      conversions?: number;
                      sale_revenue?: number;
                    };
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
                        <p className="mb-1 font-medium text-foreground">{String(label ?? "")}</p>
                        <p className="text-[#0284c7]">
                          {fill(t("pages.results.chartVisitors"), { n: (row.clicks ?? 0).toLocaleString("pt-PT") })}
                        </p>
                        {(data.checkout_visitors ?? 0) > 0 ? (
                          <p className="text-[#0f766e]">
                            {fill(t("pages.results.chartCheckouts"), { n: (row.checkouts ?? 0).toLocaleString("pt-PT") })}
                          </p>
                        ) : null}
                        <p className="text-foreground">
                          {fill(t("pages.results.chartConversions"), { n: (row.conversions ?? 0).toLocaleString("pt-PT") })}
                        </p>
                        <p className="font-medium text-[#15803d]">
                          {fill(t("pages.results.chartCommission"), { n: money(row.sale_revenue ?? 0, currency) })}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  yAxisId="visitors"
                  type="linear"
                  dataKey="clicks"
                  name="clicks"
                  stroke="#0369a1"
                  fill="#0284c7"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  strokeLinejoin="miter"
                  dot={false}
                  activeDot={{ r: 3, stroke: "#0369a1", strokeWidth: 1, fill: "#ffffff" }}
                />
                {(data.checkout_visitors ?? 0) > 0 ? (
                  <Area
                    yAxisId="visitors"
                    type="linear"
                    dataKey="checkouts"
                    name="checkouts"
                    stroke="#0f766e"
                    fill="#0f766e"
                    fillOpacity={0.08}
                    strokeWidth={1.5}
                    strokeLinejoin="miter"
                  />
                ) : null}
                {(data.chart_data ?? []).some((point) => (point.sale_revenue ?? 0) > 0) ? (
                  <Bar
                    yAxisId="sales"
                    dataKey="sale_revenue"
                    name="sale_revenue"
                    fill="#16a34a"
                    stroke="#166534"
                    strokeWidth={1}
                    radius={0}
                    maxBarSize={22}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </ProPanel>

      <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <ProDimTabs tabs={dimTabs} value={dim} onChange={(id) => setDim(id as DimId)} />

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("pages.results.filterRows")}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <p className="flex-1 text-[10px] text-muted-foreground leading-snug min-w-[200px]">{dimHint[dim]}</p>
          <div className="flex flex-wrap gap-1" title={t("pages.results.extraColsTitle")}>
            {ALL_EXTRA_COLS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCol(c)}
                className={`rounded border px-1.5 py-0.5 text-[10px] tabular-nums transition-colors ${
                  colOn(c)
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {EXTRA_COL_LABELS[c]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportCsv} disabled={!activeRows.length}>
            <Download className="h-3.5 w-3.5" /> {t("common.export")}
          </Button>
        </div>

        {dim === "campaigns" && campaignsError ? (
          <ProEmpty
            title={t("pages.results.campaignsLoadTitle")}
            detail={t("pages.results.campaignsLoadDetail")}
            action={
              <Button size="sm" variant="outline" onClick={() => void refetchCampaigns()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : activeRows.length === 0 ? (
          <ProEmpty
            title={clicks > 0 ? t("pages.results.emptyDimTitle") : t("pages.results.emptyTrafficTitle")}
            detail={
              clicks > 0
                ? t("pages.results.emptyDimDetail")
                : t("pages.results.emptyTrafficDetail")
            }
            action={
              <Button size="sm" variant="outline" asChild>
                <Link to="/tracking/url-builder">{t("pages.results.urlBuilder")}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="max-h-[min(62vh,720px)] overflow-auto touch-pan-x">
              <table className="w-full min-w-[720px] border-collapse sm:min-w-[920px]">
                <thead>
                  <tr>
                    <ProReportTh align="left" className="left-0 z-20 min-w-[8.5rem] bg-muted">
                      {dim === "offers"
                        ? t("pages.results.thOffer")
                        : dim === "campaigns"
                        ? t("pages.results.thCampaign")
                        : dim === "keywords"
                          ? t("pages.results.thKeyword")
                          : dim === "adgroups"
                            ? t("pages.results.thAdgroup")
                            : dim === "countries"
                              ? t("pages.results.thCountry")
                              : dim === "devices"
                                ? t("pages.results.thDevice")
                                : dim === "arms"
                                  ? t("pages.results.thArm")
                                  : dim === "rotators"
                                    ? t("pages.results.dimRotators")
                                    : t("pages.results.thSource")}
                    </ProReportTh>
                    <ProReportTh>{t("pages.results.thVisitors")}</ProReportTh>
                    {showCheckouts ? <ProReportTh>{t("pages.results.thCheckouts")}</ProReportTh> : null}
                    <ProReportTh>{t("pages.results.thSales")}</ProReportTh>
                    <ProReportTh>{t("pages.results.thRevenue")}</ProReportTh>
                    {colOn("cost") ? <ProReportTh>{t("pages.results.colCost")}</ProReportTh> : null}
                    {colOn("profit") ? <ProReportTh>{t("pages.results.colProfit")}</ProReportTh> : null}
                    {colOn("roi") ? <ProReportTh>{t("pages.results.colRoi")}</ProReportTh> : null}
                    {colOn("roas") ? <ProReportTh>{t("pages.results.colRoas")}</ProReportTh> : null}
                    {colOn("cvr") ? <ProReportTh>{t("pages.results.colCvr")}</ProReportTh> : null}
                    {colOn("epc") ? <ProReportTh>{t("pages.results.colEpc")}</ProReportTh> : null}
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row) => (
                    <tr key={row.id} className="hover:bg-sky-500/[0.06]">
                      <ProReportTd align="left" className="sticky left-0 z-10 max-w-[9.5rem] bg-card sm:max-w-[280px]">
                        {row.href ? (
                          <Link to={row.href} className="font-medium text-primary hover:underline truncate block">
                            {row.label}
                          </Link>
                        ) : dim === "countries" && row.sub ? (
                          <span className="inline-flex items-center gap-1.5 truncate" title={row.sub}>
                            <span aria-hidden>{countryFlagEmoji(row.sub)}</span>
                            <span className="truncate">{row.label}</span>
                          </span>
                        ) : (
                          <span className={dim === "offers" ? "truncate block font-medium" : "font-mono text-[11px] truncate block"} title={row.label}>
                            {row.label}
                          </span>
                        )}
                        {row.sub ? <span className="block text-[10px] text-muted-foreground">{row.sub}</span> : null}
                      </ProReportTd>
                      <ProReportTd>{row.clicks.toLocaleString("pt-PT")}</ProReportTd>
                      {showCheckouts ? <ProReportTd>{(row.checkouts ?? 0).toLocaleString("pt-PT")}</ProReportTd> : null}
                      <ProReportTd>{row.sales.toLocaleString("pt-PT")}</ProReportTd>
                      <ProReportTd tone={row.revenue > 0 ? "positive" : undefined}>{money(row.revenue, currency)}</ProReportTd>
                      {colOn("cost") ? (
                        <ProReportTd tone="muted">{row.cost != null ? money(row.cost, currency) : "—"}</ProReportTd>
                      ) : null}
                      {colOn("profit") ? (
                        <ProReportTd
                          tone={
                            row.profit != null && row.profit < 0
                              ? "negative"
                              : row.profit != null && row.profit > 0
                                ? "positive"
                                : "muted"
                          }
                        >
                          {row.profit != null ? money(row.profit, currency) : "—"}
                        </ProReportTd>
                      ) : null}
                      {colOn("roi") ? (
                        <ProReportTd
                          tone={
                            row.roi != null && row.roi < 0
                              ? "negative"
                              : row.roi != null && row.roi > 0
                                ? "positive"
                                : "muted"
                          }
                        >
                          {pct(row.roi)}
                        </ProReportTd>
                      ) : null}
                      {colOn("roas") ? <ProReportTd>{xNum(row.roas)}</ProReportTd> : null}
                      {colOn("cvr") ? <ProReportTd>{pct(row.cvr)}</ProReportTd> : null}
                      {colOn("epc") ? <ProReportTd>{money(row.epc, currency)}</ProReportTd> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ProTotalsBar>
              <ProTotalStat label={t("pages.results.thVisitors")} value={totClicks.toLocaleString("pt-PT")} />
              {showCheckouts ? (
                <ProTotalStat
                  label={t("pages.results.thCheckouts")}
                  value={activeRows.reduce((s, r) => s + (r.checkouts ?? 0), 0).toLocaleString("pt-PT")}
                />
              ) : null}
              <ProTotalStat label={t("pages.results.thSales")} value={totSales.toLocaleString("pt-PT")} />
              <ProTotalStat label={t("pages.results.thRevenue")} value={money(totRev, currency)} tone="positive" />
              <ProTotalStat label={t("pages.results.colCost")} value={totCost != null ? money(totCost, currency) : "—"} />
              <ProTotalStat
                label={t("pages.results.colProfit")}
                value={totProfit != null ? money(totProfit, currency) : "—"}
                tone={totProfit != null ? (totProfit >= 0 ? "positive" : "negative") : undefined}
              />
              <ProTotalStat
                label={t("pages.results.colRoi")}
                value={pct(totRoi)}
                tone={totRoi != null ? (totRoi >= 0 ? "positive" : "negative") : undefined}
              />
              <ProTotalStat label={t("pages.results.colRoas")} value={xNum(totRoas)} />
              <ProTotalStat label={t("pages.results.colCvr")} value={pct(totCvr)} />
              <ProTotalStat label={t("pages.results.colEpc")} value={money(totEpc, currency)} />
              <span className="ml-auto text-[10px] text-zinc-500">{fill(t("pages.results.rowsCount"), { n: activeRows.length })}</span>
            </ProTotalsBar>
          </>
        )}
      </section>

      {mb?.manual_spend_lifetime != null && mb.spend_source === "manual" ? (
        <p className="text-[11px] text-muted-foreground px-0.5">
          {fill(t("pages.results.manualSpendNote"), { amount: money(mb.manual_spend_lifetime, currency) })}
          <ProInlineLink to="/integracoes/automizer">{t("pages.results.updateCosts")}</ProInlineLink>
        </p>
      ) : null}
    </div>
  );
}
