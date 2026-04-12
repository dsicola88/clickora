import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bot, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { analyticsService } from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Badge } from "@/components/ui/badge";

const trafficColors = [
  "hsl(172 66% 38%)",
  "hsl(28 92% 48%)",
  "hsl(152 65% 40%)",
  "hsl(38 88% 50%)",
];

export default function Analytics() {
  const { data: summaryData, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getSummary();
      if (error) throw new Error(error);
      return data ?? [];
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

  if (isLoading) return <LoadingState message="Carregando analytics..." />;
  if (isError) return <ErrorState message="Erro ao carregar analytics." onRetry={() => refetch()} />;

  if (!summaryData || summaryData.length === 0) {
    return (
      <EmptyState
        title="Sem dados de analytics"
        description="Os dados aparecerão aqui quando suas presells começarem a receber tráfego."
        icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  const totalClicks = summaryData.reduce((acc, s) => acc + s.clicks, 0);
  const totalImpressions = summaryData.reduce((acc, s) => acc + s.impressions, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;

  const chartData = summaryData.map(s => ({
    name: s.presell_id.slice(0, 8),
    cliques: s.clicks,
    impressoes: s.impressions,
  }));

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Analytics"
        description="Acompanhe a performance das suas páginas por volume e taxa de cliques."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-card-foreground">Resumo</h2>
          </div>
          <div className="space-y-5">
            {[
              { label: "Total de Cliques", value: totalClicks.toLocaleString() },
              { label: "Total de Impressões", value: totalImpressions.toLocaleString() },
              { label: "CTR Médio", value: `${avgCtr.toFixed(2)}%` },
              { label: "Páginas Ativas", value: String(summaryData.length) },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-card-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-card-foreground">Performance por Página</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 88%)" />
                <XAxis dataKey="name" stroke="hsl(215 16% 47%)" fontSize={12} />
                <YAxis stroke="hsl(215 16% 47%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(38 20% 88%)", borderRadius: "0.5rem" }} />
                <Bar dataKey="cliques" fill="hsl(172 66% 38%)" radius={[4, 4, 0, 0]} name="Cliques" />
                <Bar dataKey="impressoes" fill="hsl(28 92% 48% / 0.4)" radius={[4, 4, 0, 0]} name="Impressões" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-card border border-border/50 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-card-foreground">Últimos cliques</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Inclui IP, país e tipo de dispositivo. Tráfego automático (crawlers, pré-visualizações) aparece como <Badge variant="secondary" className="mx-0.5">bot</Badge> com etiqueta.
        </p>
        {!recentClicks?.length ? (
          <p className="text-sm text-muted-foreground">Sem cliques registados ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium">Data</th>
                  <th className="py-2.5 px-3 font-medium">IP</th>
                  <th className="py-2.5 px-3 font-medium">País</th>
                  <th className="py-2.5 px-3 font-medium">Dispositivo</th>
                  <th className="py-2.5 px-3 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {recentClicks.map((ev) => (
                  <tr key={ev.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 px-3 text-xs whitespace-nowrap">{new Date(ev.created_at).toLocaleString("pt-PT")}</td>
                    <td className="py-2 px-3 font-mono text-[11px]">{ev.ip_address || "—"}</td>
                    <td className="py-2 px-3 text-xs">{ev.country || "—"}</td>
                    <td className="py-2 px-3 text-xs">{ev.device || "—"}</td>
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
    </div>
  );
}
