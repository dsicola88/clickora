import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  ProTable,
  ProTh,
  ProTd,
  ProEmpty,
  ProAlert,
  ProStatusDot,
  ProInlineLink,
} from "@/components/enterprise/ProShell";

function money(n: number | null | undefined, currency = "EUR") {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 });
}

function spendSourceLabel(src: string | undefined) {
  if (src === "persisted") return "Sync período";
  if (src === "google_ads") return "Google Ads API";
  if (src === "manual") return "Manual (fora do ROAS)";
  return "Sem custo";
}

function deltaLabel(pct: number | null | undefined) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
}

/** P&L enterprise — fonte de verdade para media buyers. */
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

  if (isLoading) return <LoadingState message="A carregar P&L…" />;
  if (isError || !data) return <ErrorState message="Não foi possível carregar resultados." onRetry={() => refetch()} />;

  const mb = data.media_buyer;
  const health = data.account_health;
  const currency = mb?.spend_currency || data.google_ads_metrics?.currency_code || "EUR";
  const clicks = data.total_clicks ?? 0;
  const conversions = data.approved_sales_count ?? data.total_conversions ?? 0;
  const revenue = mb?.revenue ?? data.revenue ?? 0;
  const rate = mb?.conversion_rate ?? data.conversion_rate ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);
  const cmp = data.compare;
  const attr = health?.attribution;
  const keywords = data.keyword_performance ?? [];
  const adGroups = data.ad_group_performance ?? [];
  const alerts = mb?.alerts ?? [];

  const ranked = [...campaigns]
    .filter((c) => c.stats && (c.stats.clicks > 0 || c.stats.conversions > 0 || (c.spend_amount ?? 0) > 0))
    .sort((a, b) => (b.stats?.profit ?? b.stats?.revenue ?? 0) - (a.stats?.profit ?? a.stats?.revenue ?? 0));

  const exportKeywordsCsv = () => {
    if (!keywords.length) {
      toast.message("Sem linhas para exportar.");
      return;
    }
    const headers = ["keyword", "clicks", "sales", "revenue", "cost", "profit", "roas", "epc", "cvr"];
    const lines = [
      headers.join(","),
      ...keywords.map((r) =>
        [JSON.stringify(r.keyword), r.clicks, r.sales, r.revenue, r.cost ?? "", r.profit ?? "", r.roas ?? "", r.epc ?? "", r.cvr ?? ""].join(
          ",",
        ),
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
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="P&L"
        subtitle="Receita = postbacks aprovados · cliques sem bots · lucro/ROAS só com custo sincronizado do período."
        meta={
          <>
            <span className="font-mono tabular-nums">
              {from} → {to}
            </span>
            <span>UTC</span>
            {isFetching ? <span>A actualizar…</span> : null}
            {health ? (
              <ProStatusDot ok={health.score >= 85} label={`Saúde ${health.score}%`} />
            ) : null}
            {attr && attr.approved_sales > 0 ? (
              <ProStatusDot
                ok={attr.unattributed_sales === 0}
                label={`Atribuição ${attr.attribution_rate ?? 0}%`}
              />
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
              Relatórios <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
        {cmp ? (
          <span className="text-[11px] text-muted-foreground">
            Comp. {cmp.period.from}→{cmp.period.to}: {cmp.clicks} clk · {cmp.conversions} vend ·{" "}
            {money(cmp.revenue, currency)}
          </span>
        ) : null}
      </ProToolbar>

      {health && health.score < 100 ? (
        <ProPanel
          title="Operações"
          description="Checklist antes de confiar no ROAS. Só o que falta aparece aqui."
          actions={<ProInlineLink to="/integracoes">Integrações</ProInlineLink>}
        >
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {health.checks
              .filter((c) => !c.ok)
              .map((c) => (
                <div key={c.id} className="border-b border-r border-border/50 px-4 py-3 last:border-r-0">
                  <ProStatusDot ok={false} label={c.title} />
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{c.detail}</p>
                  {c.href ? (
                    <Link to={c.href} className="mt-1.5 inline-block text-[11px] font-medium text-primary hover:underline">
                      Resolver
                    </Link>
                  ) : null}
                </div>
              ))}
            {health.checks.every((c) => c.ok) ? (
              <div className="px-4 py-6 text-xs text-muted-foreground sm:col-span-4">Conta operacionalmente pronta.</div>
            ) : null}
          </div>
        </ProPanel>
      ) : null}

      {alerts.length > 0 ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {alerts.slice(0, 6).map((a) => (
            <ProAlert key={a.code} severity={a.severity} title={a.title} detail={a.detail} />
          ))}
        </div>
      ) : null}

      <ProKpiGrid>
        <ProKpiCell
          label="Receita"
          value={money(revenue, currency)}
          hint="Postback aprovado"
          delta={deltaLabel(cmp?.delta.revenue_pct)}
        />
        <ProKpiCell label="Gasto" value={money(mb?.spend ?? null, currency)} hint={spendSourceLabel(mb?.spend_source)} />
        <ProKpiCell
          label="Lucro"
          value={money(mb?.profit ?? null, currency)}
          tone={mb?.profit != null ? (mb.profit >= 0 ? "positive" : "negative") : "muted"}
          hint={mb?.spend == null ? "Requer sync de custo" : undefined}
        />
        <ProKpiCell
          label="ROAS"
          value={mb?.roas != null ? `${mb.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
        />
        <ProKpiCell label="CPA" value={money(mb?.cpa ?? null, currency)} />
        <ProKpiCell label="EPC" value={money(mb?.epc ?? null, currency)} />
        <ProKpiCell
          label="Cliques"
          value={clicks.toLocaleString("pt-PT")}
          hint="Sem bots"
          delta={deltaLabel(cmp?.delta.clicks_pct)}
        />
        <ProKpiCell
          label="CVR"
          value={`${rate.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`}
          delta={deltaLabel(cmp?.delta.conversions_pct)}
        />
      </ProKpiGrid>

      {mb?.manual_spend_lifetime != null && mb.spend_source === "manual" ? (
        <p className="text-[11px] text-muted-foreground px-0.5">
          Gasto manual acumulado {money(mb.manual_spend_lifetime, currency)} — não entra no ROAS deste intervalo.{" "}
          <ProInlineLink to="/integracoes/automizer">Sync custos</ProInlineLink>
        </p>
      ) : null}

      <ProPanel
        id="keywords"
        title="Keywords"
        description={
          <>
            <code className="rounded bg-muted px-1 text-[10px]">utm_term=&#123;keyword&#125;</code> + custo Google do
            período
          </>
        }
        actions={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportKeywordsCsv} disabled={!keywords.length}>
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
        }
      >
        {keywords.length === 0 ? (
          <ProEmpty
            title={clicks > 0 ? "Cliques sem keyword útil" : "Sem cliques no período"}
            detail={
              clicks > 0
                ? "Macros literais ou utm_term em falta. Use o URL da campanha no anúncio (não teste manual)."
                : "Quando houver tráfego pago, o P&L por palavra-chave aparece aqui."
            }
            action={
              <Button size="sm" variant="outline" asChild>
                <Link to="/tracking/url-builder">Construtor de URL</Link>
              </Button>
            }
          />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <ProTh>Keyword</ProTh>
                <ProTh align="right">Clk</ProTh>
                <ProTh align="right">Vend</ProTh>
                <ProTh align="right">Receita</ProTh>
                <ProTh align="right">Custo</ProTh>
                <ProTh align="right">Lucro</ProTh>
                <ProTh align="right">ROAS</ProTh>
                <ProTh align="right">EPC</ProTh>
                <ProTh align="right">CVR</ProTh>
              </tr>
            </thead>
            <tbody>
              {keywords.slice(0, 40).map((row) => (
                <tr key={row.keyword} className="hover:bg-muted/30">
                  <ProTd mono>{row.keyword}</ProTd>
                  <ProTd align="right">{row.clicks.toLocaleString("pt-PT")}</ProTd>
                  <ProTd align="right">{row.sales.toLocaleString("pt-PT")}</ProTd>
                  <ProTd align="right">{money(row.revenue, currency)}</ProTd>
                  <ProTd align="right">{row.cost != null ? money(row.cost, currency) : "—"}</ProTd>
                  <ProTd
                    align="right"
                    className={
                      row.profit != null && row.profit < 0
                        ? "text-destructive"
                        : row.profit != null && row.profit > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ""
                    }
                  >
                    {row.profit != null ? money(row.profit, currency) : "—"}
                  </ProTd>
                  <ProTd align="right">
                    {row.roas != null ? `${row.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
                  </ProTd>
                  <ProTd align="right">{money(row.epc, currency)}</ProTd>
                  <ProTd align="right">
                    {row.cvr != null ? `${row.cvr.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%` : "—"}
                  </ProTd>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </ProPanel>

      <ProPanel
        id="ad-groups"
        title="Ad groups"
        description={
          <>
            <code className="rounded bg-muted px-1 text-[10px]">utm_content=&#123;adgroupid&#125;</code>
          </>
        }
      >
        {adGroups.length === 0 ? (
          <ProEmpty title="Sem ad groups no período" detail="Após cliques reais do Google Ads, o ID do grupo aparece aqui." />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <ProTh>Ad group</ProTh>
                <ProTh align="right">Clk</ProTh>
                <ProTh align="right">Vend</ProTh>
                <ProTh align="right">Receita</ProTh>
                <ProTh align="right">Custo</ProTh>
                <ProTh align="right">Lucro</ProTh>
                <ProTh align="right">ROAS</ProTh>
              </tr>
            </thead>
            <tbody>
              {adGroups.slice(0, 30).map((row) => (
                <tr key={row.ad_group} className="hover:bg-muted/30">
                  <ProTd mono>{row.ad_group}</ProTd>
                  <ProTd align="right">{row.clicks.toLocaleString("pt-PT")}</ProTd>
                  <ProTd align="right">{row.sales.toLocaleString("pt-PT")}</ProTd>
                  <ProTd align="right">{money(row.revenue, currency)}</ProTd>
                  <ProTd align="right">{row.cost != null ? money(row.cost, currency) : "—"}</ProTd>
                  <ProTd
                    align="right"
                    className={
                      row.profit != null && row.profit < 0
                        ? "text-destructive"
                        : row.profit != null && row.profit > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ""
                    }
                  >
                    {row.profit != null ? money(row.profit, currency) : "—"}
                  </ProTd>
                  <ProTd align="right">
                    {row.roas != null ? `${row.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
                  </ProTd>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </ProPanel>

      <ProPanel
        title="Campanhas"
        description="Atribuição por utm_campaign (slug). Total P&L no topo pode ser maior."
        actions={<ProInlineLink to="/campanhas">Gerir</ProInlineLink>}
      >
        {ranked.length === 0 ? (
          <ProEmpty
            title="Sem campanhas com dados"
            detail="Crie campanha, publique presell e cole o URL rastreado no anúncio."
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link to="/campanhas">Campanhas</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/presells/nova">Nova presell</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <ProTable>
              <thead>
                <tr>
                  <ProTh>Campanha</ProTh>
                  <ProTh align="right">Clk</ProTh>
                  <ProTh align="right">Conv</ProTh>
                  <ProTh align="right">Receita</ProTh>
                  <ProTh align="right">Manual*</ProTh>
                  <ProTh align="right">Lucro</ProTh>
                  <ProTh align="right">ROAS</ProTh>
                  <ProTh align="right">EPC</ProTh>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 20).map((c) => {
                  const s = c.stats!;
                  return (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <ProTd>
                        <Link to={`/campanhas/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">{c.traffic_source}</p>
                      </ProTd>
                      <ProTd align="right">{s.clicks}</ProTd>
                      <ProTd align="right">{s.conversions}</ProTd>
                      <ProTd align="right">{money(s.revenue, currency)}</ProTd>
                      <ProTd align="right" className="text-muted-foreground">
                        {money(c.spend_amount, currency)}
                      </ProTd>
                      <ProTd align="right" className={s.profit != null && s.profit < 0 ? "text-destructive font-medium" : "font-medium"}>
                        {money(s.profit, currency)}
                      </ProTd>
                      <ProTd align="right">
                        {s.roas != null ? `${s.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
                      </ProTd>
                      <ProTd align="right">{money(s.epc, currency)}</ProTd>
                    </tr>
                  );
                })}
              </tbody>
            </ProTable>
            <p className="border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground">
              * Manual = valor na ficha da campanha (pode ser lifetime). O ROAS do topo usa só custo sincronizado do
              período.
            </p>
          </>
        )}
      </ProPanel>
    </div>
  );
}
