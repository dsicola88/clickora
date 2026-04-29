import { useMemo, useState } from "react";
import { Filter, Users, DollarSign, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { rangeLast30Days } from "@/lib/dateRangePresets";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

type FunnelStage = { stage: string; value: number; percent: number; color: string };

const funnelData: FunnelStage[] = [];

const funnelChart: { x: number; visitantes: number; clicaram: number; abandonaram: number; converteram: number }[] = [];

const conversionChart: { name: string; pagos: number; organicos: number }[] = [];

export default function Vendas() {
  const initial = useMemo(() => rangeLast30Days(), []);
  const [startDate, setStartDate] = useState(initial.from);
  const [endDate, setEndDate] = useState(initial.to);
  const [keyword, setKeyword] = useState("all");

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Funil de Conversões"
        description="Funil por etapas; agregados no Resumo — detalhe em Relatórios."
      />

      {/* Date Filter + Keyword */}
      <div className="bg-foreground/95 rounded-xl p-6 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-2 flex-1 min-w-0 max-w-sm">
            <Label className="text-background/70">Período</Label>
            <DateRangeFilter
              from={startDate}
              to={endDate}
              variant="inverted"
              onApply={(p) => {
                setStartDate(p.from);
                setEndDate(p.to);
              }}
              showCompare={false}
            />
          </div>
          <div className="space-y-2 flex-1">
            <Label className="text-background/70">Palavra-chave</Label>
            <Select value={keyword} onValueChange={setKeyword}>
              <SelectTrigger className="bg-background/10 border-background/20 text-background">
                <SelectValue placeholder="Palavra-chave" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-2 bg-background text-foreground hover:bg-background/90">
            <Filter className="h-4 w-4" /> Pesquisar
          </Button>
        </div>
      </div>

      {/* Info Button */}
      <div className="flex justify-center">
        <Button variant="outline" className="gap-2">
          <Info className="h-4 w-4" /> Entenda o Funil de Conversões
        </Button>
      </div>

      {/* Funnel Visualization - Stacked Area Style */}
      <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
        {funnelData.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
            Sem dados de funil para o período selecionado.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-0 mb-4">
              {funnelData.map((item) => (
                <div key={item.stage} className="text-center border-r border-border/30 last:border-0 py-2">
                  <p className="text-sm font-medium" style={{ color: item.color }}>{item.stage}</p>
                  <p className="text-xs text-muted-foreground">{item.percent}%</p>
                </div>
              ))}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={funnelChart}>
                  <Area type="monotone" dataKey="visitantes" stackId="1" stroke="hsl(172 66% 38%)" fill="hsl(172 66% 38%)" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="clicaram" stackId="1" stroke="hsl(28 92% 48%)" fill="hsl(28 92% 48%)" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="abandonaram" stackId="1" stroke="hsl(38 88% 50%)" fill="hsl(38 88% 50%)" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="converteram" stackId="1" stroke="hsl(152 65% 40%)" fill="hsl(152 65% 40%)" fillOpacity={0.8} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(38 20% 88%)", borderRadius: "0.5rem" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {funnelData.map((item) => (
                <div key={item.stage} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.stage}: <strong className="text-card-foreground">{item.value.toLocaleString()}</strong></span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Summary Cards */}
      {funnelData.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {funnelData.map((item) => (
            <div key={item.stage} className="bg-card rounded-xl p-4 shadow-card border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-medium text-muted-foreground">{item.stage}</span>
              </div>
              <p className="text-2xl font-bold text-card-foreground">{item.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.percent}% do total</p>
            </div>
          ))}
        </div>
      )}

      {/* Conversion Chart */}
      <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">Conversões: Pagos vs Orgânicos</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-sm text-card-foreground">Pagos: <strong>0</strong></span>
            <span className="text-xs text-muted-foreground ml-auto">—</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10">
            <Users className="h-4 w-4 text-accent" />
            <span className="text-sm text-card-foreground">Orgânicos: <strong>0</strong></span>
            <span className="text-xs text-muted-foreground ml-auto">—</span>
          </div>
        </div>
        {conversionChart.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
            Sem dados de conversões para o período.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={conversionChart}>
                <defs>
                  <linearGradient id="colorPagos2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(172 66% 38%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(172 66% 38%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOrganicos2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(28 92% 48%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(28 92% 48%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="hsl(215 16% 47%)" fontSize={12} />
                <YAxis stroke="hsl(215 16% 47%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(38 20% 88%)", borderRadius: "0.5rem" }} />
                <Area type="monotone" dataKey="pagos" stroke="hsl(172 66% 38%)" fill="url(#colorPagos2)" strokeWidth={2} name="Pagos" />
                <Area type="monotone" dataKey="organicos" stroke="hsl(28 92% 48%)" fill="url(#colorOrganicos2)" strokeWidth={2} name="Orgânicos" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
