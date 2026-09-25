import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Download,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { analyticsService } from "@/services/analyticsService";
import { campaignsService } from "@/services/campaignsService";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { rangeLast14Days, previousPeriodOfSameLength } from "@/lib/dateRangePresets";
import { toast } from "sonner";

function money(n: number | null | undefined, currency = "EUR") {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 });
}

function spendSourceLabel(src: string | undefined) {
  if (src === "persisted") return "Custo sincronizado (mesmo período)";
  if (src === "google_ads") return "Google Ads API (mesmo período)";
  if (src === "manual") return "Gasto manual acumulado — não entra no ROAS";
  return "Sem gasto do período";
}

function deltaLabel(pct: number | null | undefined) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
}

/** Resultados → Visão geral profissional: saúde, datas, P&L, keywords. */
export default function ResultsOverviewPage() {
  const initial = useMemo(() => rangeLast14Days(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [compare, setCompare] = useState<{ from: string; to: string } | null>(null);

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

  if (isLoading) return <LoadingState message="A carregar resultados…" />;
  if (isError || !data) return <ErrorState message="Não foi possível carregar resultados." onRetry={() => refetch()} />;

  const mb = data.media_buyer;
  const health = data.account_health;
  const currency = mb?.spend_currency || data.google_ads_metrics?.currency_code || "EUR";
  const clicks = data.total_clicks ?? 0;
  const conversions = data.approved_sales_count ?? data.total_conversions ?? 0;
  const revenue = mb?.revenue ?? data.revenue ?? 0;
  const rate = mb?.conversion_rate ?? data.conversion_rate ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);
  const cmp = data.compare;

  const kpis: Array<{
    label: string;
    value: string;
    hint?: string;
    tone?: "positive" | "negative";
    delta?: string | null;
  }> = [
    {
      label: "Receita",
      value: money(revenue, currency),
      hint: "Vendas aprovadas (postback)",
      delta: deltaLabel(cmp?.delta.revenue_pct),
    },
    {
      label: "Gasto",
      value: money(mb?.spend ?? null, currency),
      hint: spendSourceLabel(mb?.spend_source),
    },
    {
      label: "Lucro",
      value: money(mb?.profit ?? null, currency),
      tone: mb?.profit != null ? (mb.profit >= 0 ? "positive" : "negative") : undefined,
      hint:
        mb?.spend == null
          ? "Requer custo Google/sync do período"
          : mb.profit_uses_period_spend === false
            ? "Gasto manual não entra aqui"
            : undefined,
    },
    {
      label: "ROAS",
      value: mb?.roas != null ? `${mb.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—",
    },
    { label: "CPA", value: money(mb?.cpa ?? null, currency) },
    { label: "EPC", value: money(mb?.epc ?? null, currency) },
    {
      label: "Cliques",
      value: clicks.toLocaleString("pt-PT"),
      hint: "Sem bots · UTC",
      delta: deltaLabel(cmp?.delta.clicks_pct),
    },
    {
      label: "CVR",
      value: `${rate.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`,
      hint: "Vendas ÷ cliques",
      delta: deltaLabel(cmp?.delta.conversions_pct),
    },
  ];

  const alerts = mb?.alerts ?? [];
  const ranked = [...campaigns]
    .filter((c) => c.stats && (c.stats.clicks > 0 || c.stats.conversions > 0 || (c.spend_amount ?? 0) > 0))
    .sort((a, b) => (b.stats?.profit ?? b.stats?.revenue ?? 0) - (a.stats?.profit ?? a.stats?.revenue ?? 0));

  const keywords = data.keyword_performance ?? [];
  const adGroups = data.ad_group_performance ?? [];
  const attr = health?.attribution;

  const exportKeywordsCsv = () => {
    if (!keywords.length) {
      toast.message("Sem linhas de keyword para exportar.");
      return;
    }
    const headers = ["keyword", "clicks", "sales", "revenue", "cost", "profit", "roas", "epc", "cvr"];
    const lines = [
      headers.join(","),
      ...keywords.map((r) =>
        [
          JSON.stringify(r.keyword),
          r.clicks,
          r.sales,
          r.revenue,
          r.cost ?? "",
          r.profit ?? "",
          r.roas ?? "",
          r.epc ?? "",
          r.cvr ?? "",
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keywords_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Resultados"
        description={`Vendas = postbacks aprovados · cliques sem bots · lucro/ROAS só com custo do período (UTC). ${from} → ${to}${isFetching ? " · a actualizar…" : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter
              from={from}
              to={to}
              showCompare
              onApply={(p) => {
                setFrom(p.from);
                setTo(p.to);
                if (p.compare) setCompare(p.compare);
                else setCompare(null);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                const prev = previousPeriodOfSameLength(from, to);
                setCompare(prev);
              }}
            >
              Comparar período anterior
            </Button>
            <Button variant="outline" asChild>
              <Link to="/resultados/relatorios/acessos">
                Relatórios <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {health ? (
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Saúde da conta</h2>
              <span
                className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full ${
                  health.score >= 85
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : health.score >= 60
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      : "bg-destructive/15 text-destructive"
                }`}
              >
                {health.score}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Checklist operacional · timezone UTC</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {health.checks.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  c.ok ? "border-border/50 bg-muted/20" : "border-amber-500/35 bg-amber-500/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{c.detail}</p>
                    {!c.ok && c.href ? (
                      <Link to={c.href} className="text-[10px] text-primary hover:underline mt-1 inline-block">
                        Resolver
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {attr && attr.approved_sales > 0 ? (
        <div
          className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
            (attr.unattributed_sales ?? 0) > 0
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border/60 bg-card"
          }`}
        >
          <div>
            <p className="text-sm font-medium">Atribuição no período</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {attr.attributed_sales}/{attr.approved_sales} vendas com click ID
              {attr.attribution_rate != null ? ` (${attr.attribution_rate}%)` : ""}
              {attr.unattributed_sales > 0
                ? ` · ${attr.unattributed_sales} órfã(s) — receita conta, keyword/campanha não`
                : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/resultados/conversoes">Ver conversões</Link>
          </Button>
        </div>
      ) : null}

      {mb?.manual_spend_lifetime != null && mb.spend_source === "manual" ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Gasto manual nas campanhas:{" "}
          <strong className="text-foreground">{money(mb.manual_spend_lifetime, currency)}</strong> (acumulado) —
          não entra no lucro/ROAS deste intervalo. Use sync Google em{" "}
          <Link to="/integracoes/automizer" className="text-primary underline-offset-2 hover:underline">
            Automizer &amp; custos
          </Link>
          .
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a) => {
            const critical = a.severity === "critical";
            const warn = a.severity === "warning";
            return (
              <div
                key={a.code}
                className={`flex gap-3 rounded-xl border px-4 py-3 ${
                  critical
                    ? "border-destructive/40 bg-destructive/5"
                    : warn
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border/60 bg-muted/30"
                }`}
              >
                {critical || warn ? (
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${critical ? "text-destructive" : "text-amber-600"}`} />
                ) : (
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {cmp ? (
        <p className="text-[11px] text-muted-foreground">
          Comparação vs {cmp.period.from} → {cmp.period.to}: cliques {cmp.clicks.toLocaleString("pt-PT")} ·
          vendas {cmp.conversions.toLocaleString("pt-PT")} · receita {money(cmp.revenue, currency)}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card px-4 py-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${
                s.tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""
              } ${s.tone === "negative" ? "text-destructive" : ""}`}
            >
              {s.value}
            </p>
            {s.delta ? (
              <p
                className={`mt-0.5 text-[10px] font-medium tabular-nums ${
                  s.delta.startsWith("+")
                    ? "text-emerald-600"
                    : s.delta.startsWith("-")
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {s.delta} vs período anterior
              </p>
            ) : null}
            {"hint" in s && s.hint ? <p className="mt-1 text-[10px] text-muted-foreground">{s.hint}</p> : null}
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Palavras-chave (P&amp;L)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <code className="text-[10px] bg-muted px-1 rounded">utm_term</code> + custo Google. Macro:{" "}
              <code className="text-[10px] bg-muted px-1 rounded">utm_term=&#123;keyword&#125;</code>
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportKeywordsCsv} disabled={!keywords.length}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
        {keywords.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {clicks > 0
                ? "Há cliques, mas sem keyword útil (macros literais ou utm_term em falta)."
                : "Ainda sem cliques neste período."}
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link to="/tracking/url-builder">Abrir construtor de URL</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Keyword</th>
                  <th className="pb-2 font-medium text-right">Cliques</th>
                  <th className="pb-2 font-medium text-right">Vendas</th>
                  <th className="pb-2 font-medium text-right">Receita</th>
                  <th className="pb-2 font-medium text-right">Custo</th>
                  <th className="pb-2 font-medium text-right">Lucro</th>
                  <th className="pb-2 font-medium text-right">ROAS</th>
                  <th className="pb-2 font-medium text-right">EPC</th>
                  <th className="pb-2 font-medium text-right">CVR</th>
                </tr>
              </thead>
              <tbody>
                {keywords.slice(0, 25).map((row) => (
                  <tr key={row.keyword} className="border-t border-border/40">
                    <td className="py-2.5 pr-3 font-mono text-xs">{row.keyword}</td>
                    <td className="py-2.5 text-right tabular-nums">{row.clicks.toLocaleString("pt-PT")}</td>
                    <td className="py-2.5 text-right tabular-nums">{row.sales.toLocaleString("pt-PT")}</td>
                    <td className="py-2.5 text-right tabular-nums">{money(row.revenue, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {row.cost != null ? money(row.cost, currency) : "—"}
                    </td>
                    <td
                      className={`py-2.5 text-right tabular-nums ${
                        row.profit != null && row.profit < 0
                          ? "text-destructive"
                          : row.profit != null && row.profit > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : ""
                      }`}
                    >
                      {row.profit != null ? money(row.profit, currency) : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {row.roas != null ? `${row.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{money(row.epc, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {row.cvr != null ? `${row.cvr.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(adGroups.length > 0 || clicks > 0) ? (
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Grupos de anúncios (P&amp;L)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <code className="text-[10px] bg-muted px-1 rounded">utm_content=&#123;adgroupid&#125;</code> + custo
              Google
            </p>
          </div>
          {adGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem ad group útil neste período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Ad group</th>
                    <th className="pb-2 font-medium text-right">Cliques</th>
                    <th className="pb-2 font-medium text-right">Vendas</th>
                    <th className="pb-2 font-medium text-right">Receita</th>
                    <th className="pb-2 font-medium text-right">Custo</th>
                    <th className="pb-2 font-medium text-right">Lucro</th>
                    <th className="pb-2 font-medium text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {adGroups.slice(0, 20).map((row) => (
                    <tr key={row.ad_group} className="border-t border-border/40">
                      <td className="py-2.5 pr-3 font-mono text-xs">{row.ad_group}</td>
                      <td className="py-2.5 text-right tabular-nums">{row.clicks.toLocaleString("pt-PT")}</td>
                      <td className="py-2.5 text-right tabular-nums">{row.sales.toLocaleString("pt-PT")}</td>
                      <td className="py-2.5 text-right tabular-nums">{money(row.revenue, currency)}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {row.cost != null ? money(row.cost, currency) : "—"}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums ${
                          row.profit != null && row.profit < 0
                            ? "text-destructive"
                            : row.profit != null && row.profit > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : ""
                        }`}
                      >
                        {row.profit != null ? money(row.profit, currency) : "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {row.roas != null ? `${row.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Campanhas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Só cliques com <code className="text-[10px] bg-muted px-1 rounded">utm_campaign</code> = slug da
              campanha — o total no topo pode ser maior.
            </p>
          </div>
          <Button variant="link" className="px-0 h-auto" asChild>
            <Link to="/campanhas">Gerir</Link>
          </Button>
        </div>
        {ranked.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ainda sem dados por campanha. Crie uma campanha e use o link com utm_campaign no anúncio.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link to="/campanhas">Criar campanha</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/presells/nova">Nova presell</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/tracking/url-builder">Construtor de URL</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Campanha</th>
                  <th className="pb-2 font-medium text-right">Cliques</th>
                  <th className="pb-2 font-medium text-right">Conv.</th>
                  <th className="pb-2 font-medium text-right">Receita</th>
                  <th className="pb-2 font-medium text-right">Gasto*</th>
                  <th className="pb-2 font-medium text-right">Lucro</th>
                  <th className="pb-2 font-medium text-right">ROAS</th>
                  <th className="pb-2 font-medium text-right">EPC</th>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 12).map((c) => {
                  const s = c.stats!;
                  return (
                    <tr key={c.id} className="border-t border-border/40">
                      <td className="py-2.5 pr-3">
                        <Link to={`/campanhas/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">{c.traffic_source}</p>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{s.clicks}</td>
                      <td className="py-2.5 text-right tabular-nums">{s.conversions}</td>
                      <td className="py-2.5 text-right tabular-nums">{money(s.revenue, currency)}</td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                        {money(c.spend_amount, currency)}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums font-medium ${
                          s.profit != null && s.profit < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {money(s.profit, currency)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {s.roas != null ? `${s.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{money(s.epc, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-muted-foreground">
              * Gasto na linha = valor manual na campanha (pode ser lifetime). Lucro/ROAS da linha usam esse valor se
              existir; o ROAS do topo usa só custo sincronizado do período.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
