import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { analyticsService } from "@/services/analyticsService";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoYmd(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Resultados → Visão geral: 4 KPIs + atalhos. Sem painéis técnicos. */
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

  const { data: detail } = useQuery({
    queryKey: ["analytics-summary-detail", from, to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getSummary({ from, to, detail: true });
      if (error) return null;
      if (Array.isArray(data)) {
        return { by_presell: data, by_campaign: [] };
      }
      return data as {
        by_presell?: Array<{
          presell_id: string;
          clicks: number;
          conversions: number;
          revenue: number;
          conversion_rate?: number;
        }>;
        by_campaign?: Array<{ campaign: string; conversions: number; revenue: number }>;
      };
    },
  });

  if (isLoading) return <LoadingState message="A carregar resultados…" />;
  if (isError || !data) return <ErrorState message="Não foi possível carregar resultados." onRetry={() => refetch()} />;

  const clicks = data.total_clicks ?? 0;
  const conversions = data.total_conversions ?? 0;
  const revenue = data.revenue ?? 0;
  const rate = data.conversion_rate ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Resultados"
        description="Últimos 14 dias. Detalhe em Conversões e Relatórios."
        actions={
          <Button variant="outline" asChild>
            <Link to="/resultados/relatorios">
              Relatórios <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Cliques", value: clicks.toLocaleString("pt-PT") },
          { label: "Conversões", value: conversions.toLocaleString("pt-PT") },
          {
            label: "Receita",
            value: revenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }),
          },
          {
            label: "Taxa de conversão",
            value: `${rate.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card px-4 py-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Por campanha</h2>
          <p className="mt-1 text-xs text-muted-foreground mb-4">Nome UTM / campanha do clique</p>
          {(detail?.by_campaign?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem conversões com campanha neste período.</p>
          ) : (
            <ul className="space-y-2">
              {detail!.by_campaign!.slice(0, 8).map((r) => (
                <li key={r.campaign} className="flex justify-between gap-3 text-sm border-b border-border/40 py-2 last:border-0">
                  <span className="truncate font-medium">{r.campaign}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {r.conversions} ·{" "}
                    {r.revenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Por presell</h2>
          <p className="mt-1 text-xs text-muted-foreground mb-4">Cliques e conversões por página</p>
          {(detail?.by_presell?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de páginas neste período.</p>
          ) : (
            <ul className="space-y-2">
              {detail!
                .by_presell!.filter((r) => r.presell_id !== "unattributed" && r.presell_id !== "unknown")
                .slice(0, 8)
                .map((r) => (
                  <li
                    key={r.presell_id}
                    className="flex justify-between gap-3 text-sm border-b border-border/40 py-2 last:border-0"
                  >
                    <span className="truncate font-mono text-xs">{r.presell_id.slice(0, 8)}…</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {r.clicks} cliques · {r.conversions} conv.
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <Button variant="link" className="px-0 mt-2 h-auto" asChild>
            <Link to="/presells">Abrir Presells</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
