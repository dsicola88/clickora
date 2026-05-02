import { useMemo, useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type KeywordVolumeTrendInput = {
  points: Array<{ year: number; month: number; day: number | null; volume: number }>;
  point_source: "google_monthly" | "synthetic_from_average" | "estimated_model";
  disclaimer_pt: string;
};

function formatPtInt(n: number): string {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(n);
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Reparte um mês em dias com padrão determinístico; normaliza para somar ao volume mensal.
 *  Nunca inventa dias depois de «hoje» no mês corrente; meses futuros devolvem lista vazia. */
function expandMonthToDaily(
  year: number,
  month: number,
  monthVolume: number,
  seed: number,
  now: Date,
): { key: string; label: string; volume: number; t: number }[] {
  const yNow = now.getFullYear();
  const mNow = now.getMonth() + 1;
  const dNow = now.getDate();

  if (year > yNow || (year === yNow && month > mNow)) {
    return [];
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = year === yNow && month === mNow;
  const lastDayInclusive = isCurrentMonth ? Math.min(daysInMonth, dNow) : daysInMonth;
  if (lastDayInclusive < 1) return [];

  const weights = Array.from({ length: lastDayInclusive }, (_, i) => {
    const d = i + 1;
    const weekend = [0, 6].includes(new Date(year, month - 1, d).getDay()) ? 0.88 : 1.05;
    const noise = 0.82 + ((seed + d * 47) % 37) / 100;
    return weekend * noise;
  });
  const sumW = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => {
    const d = i + 1;
    const vol = Math.max(0, Math.round((monthVolume * w) / sumW));
    const date = new Date(year, month - 1, d);
    return {
      key: `${year}-${month}-${d}`,
      label: format(date, "d MMM", { locale: pt }),
      volume: vol,
      t: date.getTime(),
    };
  });
}

const SOURCE_LABEL: Record<KeywordVolumeTrendInput["point_source"], string> = {
  google_monthly: "Google Ads (mensal)",
  synthetic_from_average: "Derivado da média",
  estimated_model: "Modelo interno",
};

export function DpilotKeywordVolumeTrendChart({
  trend,
  keyword,
  countryCode,
}: {
  trend: KeywordVolumeTrendInput;
  keyword: string;
  countryCode: string;
}) {
  const seed = hashSeed(`${keyword}\n${countryCode}`);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [rangePreset, setRangePreset] = useState<string>("12");
  const [granularity, setGranularity] = useState<"month" | "year" | "day">("month");

  const yearsAvailable = useMemo(() => {
    const ys = new Set<number>();
    for (const p of trend.points) ys.add(p.year);
    return [...ys].sort((a, b) => a - b);
  }, [trend.points]);

  const filteredMonths = useMemo(() => {
    let pts = trend.points.map((p) => ({ ...p }));
    if (yearFilter !== "all") {
      const y = parseInt(yearFilter, 10);
      if (Number.isFinite(y)) pts = pts.filter((p) => p.year === y);
    }
    pts.sort((a, b) => a.year - b.year || a.month - b.month);
    const today = new Date();
    const cy = today.getFullYear();
    const cm = today.getMonth() + 1;
    pts = pts.filter((p) => p.year < cy || (p.year === cy && p.month <= cm));
    if (rangePreset === "1" && pts.length > 1) pts = pts.slice(-1);
    else if (rangePreset === "12" && pts.length > 12) pts = pts.slice(-12);
    else if (rangePreset === "24" && pts.length > 24) pts = pts.slice(-24);
    return pts;
  }, [trend.points, yearFilter, rangePreset]);

  const chartData = useMemo(() => {
    const now = new Date();
    if (granularity === "year") {
      const byYear = new Map<number, number>();
      for (const p of filteredMonths) {
        byYear.set(p.year, (byYear.get(p.year) ?? 0) + p.volume);
      }
      return [...byYear.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, volume]) => ({
          key: String(year),
          label: String(year),
          volume,
        }));
    }
    if (granularity === "day") {
      const rows: { key: string; label: string; volume: number }[] = [];
      for (const p of filteredMonths) {
        rows.push(...expandMonthToDaily(p.year, p.month, p.volume, seed + p.month * 13, now));
      }
      return rows;
    }
    return filteredMonths.map((p) => ({
      key: `${p.year}-${p.month}`,
      label: format(new Date(p.year, p.month - 1, 1), "MMM yyyy", { locale: pt }),
      volume: p.volume,
    }));
  }, [filteredMonths, granularity, seed]);

  if (trend.points.length === 0) return null;

  if (chartData.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-border/90 bg-muted/20 p-4 text-center text-[12px] text-muted-foreground">
        <p className="font-medium text-foreground">Tendência de pesquisa</p>
        <p>Não há pontos para os filtros seleccionados. Experimente «Todos os anos», «Último mês» ou «Toda a série».</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/90 bg-gradient-to-b from-muted/30 to-transparent p-3 dark:from-muted/15">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-foreground">Tendência de pesquisa</p>
          <p className="text-[10px] text-muted-foreground">
            Origem: <span className="text-foreground/80">{SOURCE_LABEL[trend.point_source]}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">Ano</Label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {yearsAvailable.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">Janela</Label>
          <Select value={rangePreset} onValueChange={setRangePreset}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mês</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
              <SelectItem value="all">Toda a série</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label className="text-[10px] text-muted-foreground">Agregação</Label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "month" as const, label: "Mensal" },
                { id: "year" as const, label: "Anual" },
                { id: "day" as const, label: "Diário (estim.)" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGranularity(opt.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  granularity === opt.id
                    ? "border-violet-500/60 bg-violet-500/15 text-violet-900 dark:text-violet-100"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/70",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-52 w-full min-w-0 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          {granularity === "year" ? (
            <BarChart data={chartData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  fontSize: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
                formatter={(v: number) => [formatPtInt(v), "Pesquisas"]}
                labelFormatter={(l) => `Ano ${l}`}
              />
              <Bar dataKey="volume" fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} name="Volume" />
            </BarChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="kwVolFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(262 83% 58%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(262 83% 58%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: granularity === "day" ? 9 : 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={granularity === "day" ? 4 : 8}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  fontSize: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
                formatter={(v: number) => [formatPtInt(v), "Pesquisas"]}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="hsl(262 83% 58%)"
                strokeWidth={2}
                fill="url(#kwVolFill)"
                name="Volume"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">{trend.disclaimer_pt}</p>
      {granularity === "day" ? (
        <p className="text-[10px] leading-relaxed text-amber-800/90 dark:text-amber-200/90">
          Vista diária: distribuição indicativa a partir dos totais mensais (não é dado horário da API). No mês corrente só
          aparecem dias até à data de hoje — não são gerados dias futuros.
        </p>
      ) : null}
    </div>
  );
}
