import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { analyticsService } from "@/services/analyticsService";
import { campaignsService } from "@/services/campaignsService";
import { rangeLast14Days, previousPeriodOfSameLength } from "@/lib/dateRangePresets";
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

type DimId = "campaigns" | "keywords" | "adgroups" | "countries" | "devices" | "sources";

type ReportRow = {
  id: string;
  label: string;
  sub?: string;
  href?: string;
  clicks: number;
  sales: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
  roas: number | null;
  roi: number | null;
  epc: number | null;
  cvr: number | null;
};

function money(n: number | null | undefined, currency = "EUR") {
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

function spendSourceLabel(src: string | undefined) {
  if (src === "persisted") return "Sync período";
  if (src === "google_ads") return "Google Ads API";
  if (src === "manual") return "Manual (fora do ROAS)";
  return "Sem custo";
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

function deviceLabel(d: string) {
  const x = d.toLowerCase();
  if (x === "mobile" || x === "mobile phone") return "Mobile";
  if (x === "desktop") return "Desktop";
  if (x === "tablet") return "Tablet";
  if (x === "(desconhecido)" || x === "unknown") return "Desconhecido";
  return d;
}

/** P&L estilo tracker enterprise — dimensões + grelha densa + totais. */
export default function ResultsOverviewPage() {
  const initial = useMemo(() => rangeLast14Days(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [compare, setCompare] = useState<{ from: string; to: string } | null>(null);
  const [dim, setDim] = useState<DimId>("keywords");
  const [q, setQ] = useState("");

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
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns", "stats", from, to],
    queryFn: async () => {
      const { data, error } = await campaignsService.list({ with_stats: true, from, to });
      if (error) return [];
      return data ?? [];
    },
  });

  const rowsByDim = useMemo((): Record<DimId, ReportRow[]> => {
    if (!data) {
      return { campaigns: [], keywords: [], adgroups: [], countries: [], devices: [], sources: [] };
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
    const countries: ReportRow[] = (data.country_performance ?? []).map((r) => ({
      id: r.country,
      label: r.country,
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
    const devices: ReportRow[] = (data.device_performance ?? []).map((r) => ({
      id: r.device,
      label: deviceLabel(r.device),
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
    const campaignRows: ReportRow[] = [...campaigns]
      .filter((c) => c.stats && (c.stats.clicks > 0 || c.stats.conversions > 0 || (c.spend_amount ?? 0) > 0))
      .map((c) => {
        const s = c.stats!;
        const cost = c.spend_amount ?? null;
        const profit = s.profit ?? (cost != null ? s.revenue - cost : null);
        return {
          id: c.id,
          label: c.name,
          sub: c.traffic_source,
          href: `/campanhas/${c.id}`,
          clicks: s.clicks,
          sales: s.conversions,
          revenue: s.revenue,
          cost,
          profit,
          roas: s.roas ?? (cost != null && cost > 0 ? Math.round((s.revenue / cost) * 100) / 100 : null),
          roi: roiOf(profit, cost),
          epc: s.epc,
          cvr: s.conversion_rate,
        };
      })
      .sort((a, b) => (b.profit ?? b.revenue) - (a.profit ?? a.revenue));

    return {
      campaigns: campaignRows,
      keywords,
      adgroups,
      countries,
      devices,
      sources,
    };
  }, [data, campaigns]);

  if (isLoading) return <LoadingState message="A carregar P&L…" />;
  if (isError || !data) return <ErrorState message="Não foi possível carregar resultados." onRetry={() => refetch()} />;

  const mb = data.media_buyer;
  const health = data.account_health;
  const currency = mb?.spend_currency || data.google_ads_metrics?.currency_code || "EUR";
  const clicks = data.total_clicks ?? 0;
  const impressions = data.total_impressions ?? 0;
  const conversions = data.approved_sales_count ?? data.total_conversions ?? 0;
  const revenue = mb?.revenue ?? data.revenue ?? 0;
  const rate = mb?.conversion_rate ?? data.conversion_rate ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);
  const cmp = data.compare;
  const attr = health?.attribution;
  const alerts = mb?.alerts ?? [];
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const accountRoi = roiOf(mb?.profit ?? null, mb?.spend ?? null);

  const dimTabs: Array<{ id: DimId; label: string; count: number }> = [
    { id: "campaigns", label: "Campanhas", count: rowsByDim.campaigns.length },
    { id: "keywords", label: "Keywords", count: rowsByDim.keywords.length },
    { id: "adgroups", label: "Ad groups", count: rowsByDim.adgroups.length },
    { id: "countries", label: "Países", count: rowsByDim.countries.length },
    { id: "devices", label: "Dispositivos", count: rowsByDim.devices.length },
    { id: "sources", label: "Fontes", count: rowsByDim.sources.length },
  ];

  const activeRows = rowsByDim[dim].filter((r) => {
    if (!q.trim()) return true;
    return r.label.toLowerCase().includes(q.trim().toLowerCase());
  });

  const dimHint: Record<DimId, string> = {
    campaigns: "Atribuição por utm_campaign (slug). Custo = gasto manual na ficha (pode ser lifetime).",
    keywords: "utm_term={keyword} · custo Google sincronizado do período quando disponível.",
    adgroups: "utm_content={adgroupid} · custo por ad group sincronizado.",
    countries: "País do clique (GeoIP / header). Sem custo por país — só receita/EPC/CVR.",
    devices: "device do evento de clique. Sem custo por dispositivo.",
    sources: "utm_source ou source do clique.",
  };

  const exportCsv = () => {
    if (!activeRows.length) {
      toast.message("Sem linhas para exportar.");
      return;
    }
    const headers = ["dimension", "clicks", "sales", "revenue", "cost", "profit", "roas", "roi", "epc", "cvr"];
    const lines = [
      headers.join(","),
      ...activeRows.map((r) =>
        [
          JSON.stringify(r.label),
          r.clicks,
          r.sales,
          r.revenue,
          r.cost ?? "",
          r.profit ?? "",
          r.roas ?? "",
          r.roi ?? "",
          r.epc ?? "",
          r.cvr ?? "",
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
    toast.success("CSV exportado");
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
        title="P&L"
        subtitle="Tracker Search + postback · receita aprovada · lucro/ROAS só com custo sincronizado do período."
        meta={
          <>
            <span className="font-mono tabular-nums">
              {from} → {to}
            </span>
            <span>UTC</span>
            {isFetching ? <span>A actualizar…</span> : null}
            {health ? <ProStatusDot ok={health.score >= 85} label={`Saúde ${health.score}%`} /> : null}
            {attr && attr.approved_sales > 0 ? (
              <ProStatusDot ok={attr.unattributed_sales === 0} label={`Atribuição ${attr.attribution_rate ?? 0}%`} />
            ) : null}
            <ProStatusDot
              ok={mb?.spend_source === "persisted" || mb?.spend_source === "google_ads"}
              label={spendSourceLabel(mb?.spend_source)}
            />
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/resultados/relatorios/acessos">
              Eventos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

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
          Vs período anterior
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {cmp ? (
          <span className="text-[11px] text-muted-foreground">
            Comp. {cmp.period.from}→{cmp.period.to}: {cmp.clicks} clk · {cmp.conversions} vend ·{" "}
            {money(cmp.revenue, currency)}
          </span>
        ) : null}
      </ProToolbar>

      {health && health.score < 100 && health.checks.some((c) => !c.ok) ? (
        <ProPanel
          title="Operações"
          description="Só o que falta para confiar no ROAS."
          actions={<ProInlineLink to="/integracoes">Integrações</ProInlineLink>}
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
                      Resolver
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
        <ProKpiCell label="Visitas" value={impressions.toLocaleString("pt-PT")} hint="Impressões / pageviews" />
        <ProKpiCell
          label="Cliques"
          value={clicks.toLocaleString("pt-PT")}
          hint="Sem bots"
          delta={deltaLabel(cmp?.delta.clicks_pct)}
        />
        <ProKpiCell
          label="Conversões"
          value={conversions.toLocaleString("pt-PT")}
          hint="Postback aprovado"
          delta={deltaLabel(cmp?.delta.conversions_pct)}
        />
        <ProKpiCell
          label="Receita"
          value={money(revenue, currency)}
          delta={deltaLabel(cmp?.delta.revenue_pct)}
        />
        <ProKpiCell label="Custo" value={money(mb?.spend ?? null, currency)} hint={spendSourceLabel(mb?.spend_source)} />
        <ProKpiCell
          label="Lucro"
          value={money(mb?.profit ?? null, currency)}
          tone={mb?.profit != null ? (mb.profit >= 0 ? "positive" : "negative") : "muted"}
        />
        <ProKpiCell
          label="ROI"
          value={accountRoi != null ? pct(accountRoi) : "—"}
          tone={accountRoi != null ? (accountRoi >= 0 ? "positive" : "negative") : "muted"}
        />
        <ProKpiCell
          label="ROAS / EPC / CVR"
          value={mb?.roas != null ? xNum(mb.roas) : "—"}
          hint={`${money(mb?.epc ?? null, currency)} EPC · ${pct(rate)} CVR${ctr != null ? ` · ${pct(ctr)} CTR` : ""}`}
        />
      </ProKpiGrid>

      <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <ProDimTabs tabs={dimTabs} value={dim} onChange={(id) => setDim(id as DimId)} />

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar linhas…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <p className="flex-1 text-[10px] text-muted-foreground leading-snug min-w-[200px]">{dimHint[dim]}</p>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportCsv} disabled={!activeRows.length}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        {activeRows.length === 0 ? (
          <ProEmpty
            title={clicks > 0 ? "Sem linhas nesta dimensão" : "Sem tráfego no período"}
            detail={
              clicks > 0
                ? "Macros/UTMs em falta ou filtro sem match. Confirme o URL do anúncio."
                : "Publique a presell, cole o link rastreado e espere cliques reais."
            }
            action={
              <Button size="sm" variant="outline" asChild>
                <Link to="/tracking/url-builder">URL Builder</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="max-h-[min(62vh,720px)] overflow-auto">
              <table className="w-full min-w-[920px] border-collapse">
                <thead>
                  <tr>
                    <ProReportTh align="left">
                      {dim === "campaigns"
                        ? "Campanha"
                        : dim === "keywords"
                          ? "Keyword"
                          : dim === "adgroups"
                            ? "Ad group"
                            : dim === "countries"
                              ? "País"
                              : dim === "devices"
                                ? "Dispositivo"
                                : "Fonte"}
                    </ProReportTh>
                    <ProReportTh>Clk</ProReportTh>
                    <ProReportTh>Conv</ProReportTh>
                    <ProReportTh>Receita</ProReportTh>
                    <ProReportTh>Custo</ProReportTh>
                    <ProReportTh>Lucro</ProReportTh>
                    <ProReportTh>ROI</ProReportTh>
                    <ProReportTh>ROAS</ProReportTh>
                    <ProReportTh>CVR</ProReportTh>
                    <ProReportTh>EPC</ProReportTh>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row) => (
                    <tr key={row.id} className="hover:bg-sky-500/[0.06]">
                      <ProReportTd align="left" className="max-w-[280px]">
                        {row.href ? (
                          <Link to={row.href} className="font-medium text-primary hover:underline truncate block">
                            {row.label}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px] truncate block" title={row.label}>
                            {row.label}
                          </span>
                        )}
                        {row.sub ? <span className="block text-[10px] text-muted-foreground">{row.sub}</span> : null}
                      </ProReportTd>
                      <ProReportTd>{row.clicks.toLocaleString("pt-PT")}</ProReportTd>
                      <ProReportTd>{row.sales.toLocaleString("pt-PT")}</ProReportTd>
                      <ProReportTd tone={row.revenue > 0 ? "positive" : undefined}>{money(row.revenue, currency)}</ProReportTd>
                      <ProReportTd tone="muted">{row.cost != null ? money(row.cost, currency) : "—"}</ProReportTd>
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
                      <ProReportTd
                        tone={
                          row.roi != null && row.roi < 0 ? "negative" : row.roi != null && row.roi > 0 ? "positive" : "muted"
                        }
                      >
                        {pct(row.roi)}
                      </ProReportTd>
                      <ProReportTd>{xNum(row.roas)}</ProReportTd>
                      <ProReportTd>{pct(row.cvr)}</ProReportTd>
                      <ProReportTd>{money(row.epc, currency)}</ProReportTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ProTotalsBar>
              <ProTotalStat label="Clk" value={totClicks.toLocaleString("pt-PT")} />
              <ProTotalStat label="Conv" value={totSales.toLocaleString("pt-PT")} />
              <ProTotalStat label="Receita" value={money(totRev, currency)} tone="positive" />
              <ProTotalStat label="Custo" value={totCost != null ? money(totCost, currency) : "—"} />
              <ProTotalStat
                label="Lucro"
                value={totProfit != null ? money(totProfit, currency) : "—"}
                tone={totProfit != null ? (totProfit >= 0 ? "positive" : "negative") : undefined}
              />
              <ProTotalStat
                label="ROI"
                value={pct(totRoi)}
                tone={totRoi != null ? (totRoi >= 0 ? "positive" : "negative") : undefined}
              />
              <ProTotalStat label="ROAS" value={xNum(totRoas)} />
              <ProTotalStat label="CVR" value={pct(totCvr)} />
              <ProTotalStat label="EPC" value={money(totEpc, currency)} />
              <span className="ml-auto text-[10px] text-zinc-500">{activeRows.length} linhas</span>
            </ProTotalsBar>
          </>
        )}
      </section>

      {mb?.manual_spend_lifetime != null && mb.spend_source === "manual" ? (
        <p className="text-[11px] text-muted-foreground px-0.5">
          Gasto manual acumulado {money(mb.manual_spend_lifetime, currency)} — não entra no ROAS da conta.{" "}
          <ProInlineLink to="/integracoes/automizer">Sync custos</ProInlineLink>
        </p>
      ) : null}
    </div>
  );
}
