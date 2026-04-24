import { useMemo, useState } from "react";
import { MousePointerClick, Eye, TrendingUp, FileText, ArrowUpRight, DollarSign, Tag, Globe } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Label } from "@/components/ui/label";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { rangeLast30Days } from "@/lib/dateRangePresets";

const chartData: { name: string; cliques: number; impressoes: number }[] = [];

const recentPages: { name: string; clicks: number; ctr: string; status: string }[] = [];

export default function Dashboard() {
  const initial = useMemo(() => rangeLast30Days(), []);
  const [startDate, setStartDate] = useState(initial.from);
  const [endDate, setEndDate] = useState(initial.to);

  return (
    <div className={APP_PAGE_SHELL}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da sua performance</p>
        </div>
      </div>

      {/* Date Filter + Conversion Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50 space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Selecione o intervalo desejado</h3>
          <div className="space-y-1 max-w-md">
            <Label className="text-xs">Período</Label>
            <DateRangeFilter
              from={startDate}
              to={endDate}
              onApply={(p) => {
                setStartDate(p.from);
                setEndDate(p.to);
              }}
              showCompare={false}
            />
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Neste período você converteu:</p>
          <p className="text-3xl font-bold">
            <span className="text-success">$ 0.00</span>{" "}
            <span className="text-muted-foreground text-lg font-normal">USD</span>
          </p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Sem dados no período
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total de Cliques" value="0" change="—" changeType="neutral" icon={MousePointerClick} />
        <MetricCard title="Impressões" value="0" change="—" changeType="neutral" icon={Eye} />
        <MetricCard title="CTR Médio" value="0%" change="—" changeType="neutral" icon={TrendingUp} />
        <MetricCard title="Páginas Ativas" value="0" change="—" changeType="neutral" icon={FileText} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-primary rounded-xl p-5 text-primary-foreground">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4" />
            <span className="text-sm font-medium opacity-90">Total de vendas</span>
          </div>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Plataformas</span>
          </div>
          <p className="text-3xl font-bold text-card-foreground">0</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Comissão média</span>
          </div>
          <p className="text-3xl font-bold text-card-foreground">$0.00</p>
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">Performance Semanal</h2>
        {chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
            Sem dados para o período selecionado.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCliques" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(172 66% 38%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(172 66% 38%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorImpressoes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(28 92% 48%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(28 92% 48%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 88%)" />
                <XAxis dataKey="name" stroke="hsl(215 16% 47%)" fontSize={12} />
                <YAxis stroke="hsl(215 16% 47%)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 100%)",
                    border: "1px solid hsl(38 20% 88%)",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                />
                <Area type="monotone" dataKey="impressoes" stroke="hsl(28 92% 48%)" fill="url(#colorImpressoes)" strokeWidth={2} name="Impressões" />
                <Area type="monotone" dataKey="cliques" stroke="hsl(172 66% 38%)" fill="url(#colorCliques)" strokeWidth={2} name="Cliques" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border/50">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground">Páginas Recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-5 text-sm font-medium text-muted-foreground">Página</th>
                <th className="text-left py-3 px-5 text-sm font-medium text-muted-foreground">Cliques</th>
                <th className="text-left py-3 px-5 text-sm font-medium text-muted-foreground">CTR</th>
                <th className="text-left py-3 px-5 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-5 text-sm font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {recentPages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    Nenhuma página com atividade recente.
                  </td>
                </tr>
              ) : (
                recentPages.map((page) => (
                  <tr key={page.name} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-5 text-sm font-medium text-card-foreground">{page.name}</td>
                    <td className="py-3 px-5 text-sm text-muted-foreground">{page.clicks}</td>
                    <td className="py-3 px-5 text-sm text-muted-foreground">{page.ctr}</td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${page.status === "Ativa" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {page.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button className="text-primary hover:text-primary/80 transition-colors">
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
