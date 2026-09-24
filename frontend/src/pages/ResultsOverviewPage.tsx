import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, AlertTriangle, Info } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { analyticsService } from "@/services/analyticsService";
import { campaignsService } from "@/services/campaignsService";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoYmd(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function money(n: number | null | undefined, currency = "EUR") {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 });
}

function spendSourceLabel(src: string | undefined) {
  if (src === "google_ads") return "Google Ads (mesmo período)";
  if (src === "manual") return "Gasto manual acumulado — não usado no ROAS deste intervalo";
  return "Sem gasto do período";
}

/** Resultados → Visão geral: ROI + alertas de media buyer + breakdown. */
export default function ResultsOverviewPage() {
  const from = daysAgoYmd(14);
  const to = todayYmd();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "results", from, to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from, to });
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
  const currency = mb?.spend_currency || data.google_ads_metrics?.currency_code || "EUR";
  const clicks = data.total_clicks ?? 0;
  const conversions = data.approved_sales_count ?? data.total_conversions ?? 0;
  const revenue = mb?.revenue ?? data.revenue ?? 0;
  const rate = mb?.conversion_rate ?? data.conversion_rate ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);

  const kpis = [
    { label: "Receita", value: money(revenue, currency), hint: "Vendas aprovadas (postback)" },
    { label: "Gasto", value: money(mb?.spend ?? null, currency), hint: spendSourceLabel(mb?.spend_source) },
    {
      label: "Lucro",
      value: money(mb?.profit ?? null, currency),
      tone: mb?.profit != null ? (mb.profit >= 0 ? "positive" : "negative") : undefined,
      hint: mb?.spend == null ? "Requer gasto Google do período" : undefined,
    },
    { label: "ROAS", value: mb?.roas != null ? `${mb.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—" },
    { label: "CPA", value: money(mb?.cpa ?? null, currency) },
    { label: "EPC", value: money(mb?.epc ?? null, currency) },
    { label: "Cliques", value: clicks.toLocaleString("pt-PT"), hint: "Visitas com clique (sem bots)" },
    {
      label: "CVR",
      value: `${rate.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`,
      hint: "Vendas ÷ cliques",
    },
  ];

  const alerts = mb?.alerts ?? [];
  const ranked = [...campaigns]
    .filter((c) => c.stats && (c.stats.clicks > 0 || c.stats.conversions > 0 || (c.spend_amount ?? 0) > 0))
    .sort((a, b) => (b.stats?.profit ?? b.stats?.revenue ?? 0) - (a.stats?.profit ?? a.stats?.revenue ?? 0));

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Resultados"
        description="Últimos 14 dias · vendas = postbacks aprovados · cliques sem bots · lucro/ROAS só com gasto Google do mesmo período."
        actions={
          <Button variant="outline" asChild>
            <Link to="/resultados/relatorios">
              Relatórios <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

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
            {"hint" in s && s.hint ? <p className="mt-1 text-[10px] text-muted-foreground">{s.hint}</p> : null}
          </div>
        ))}
      </div>

      {(data.keyword_performance?.length ?? 0) > 0 ? (
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Palavras-chave (P&amp;L)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Receita de postbacks por <code className="text-[10px] bg-muted px-1 rounded">utm_term</code> +
              custo Google Ads (mesmo texto de keyword). No URL do anúncio use{" "}
              <code className="text-[10px] bg-muted px-1 rounded">utm_term=&#123;keyword&#125;</code> — a Google
              só substitui no clique real do anúncio (não em testes manuais do link).
            </p>
          </div>
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
                {data.keyword_performance!.slice(0, 15).map((row) => (
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
        </section>
      ) : null}

      {(data.ad_group_performance?.length ?? 0) > 0 ? (
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Grupos de anúncios (P&amp;L)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Receita por <code className="text-[10px] bg-muted px-1 rounded">utm_content</code> + custo Google
              (ad group). No anúncio: macro{" "}
              <code className="text-[10px] bg-muted px-1 rounded">utm_content=&#123;creative&#125;</code> ou o
              nome do grupo em texto — macros literais não aparecem como linha.
            </p>
          </div>
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
                {data.ad_group_performance!.slice(0, 12).map((row) => (
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
        </section>
      ) : null}

      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Campanhas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ordenadas por lucro (ou receita se sem gasto). Só entram cliques cujo{" "}
              <code className="text-[10px] bg-muted px-1 rounded">utm_campaign</code> coincide com o nome/slug da
              campanha — o total de cliques no topo pode ser maior.
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
                  <th className="pb-2 font-medium text-right">Gasto</th>
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
                      <td className="py-2.5 text-right tabular-nums">{money(c.spend_amount, currency)}</td>
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
          </div>
        )}
      </section>
    </div>
  );
}
