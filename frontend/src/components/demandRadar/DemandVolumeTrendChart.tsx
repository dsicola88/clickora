import { useMemo, useState } from "react";
import { format } from "date-fns";
import { enUS, es, pt, ptBR } from "date-fns/locale";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { AppLocale } from "@/i18n/types";
import type { DemandVolumeTrend } from "@/services/demandRadarService";
import { cn } from "@/lib/utils";

function formatInt(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

function dateLocale(locale: AppLocale) {
  if (locale === "pt-BR") return ptBR;
  if (locale === "pt") return pt;
  if (locale === "es") return es;
  return enUS;
}

function numberLocale(locale: AppLocale) {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "pt") return "pt-PT";
  if (locale === "es") return "es-ES";
  return "en-US";
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border/70 bg-muted/30 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-[5px] px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
            value === opt.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[7.5rem] rounded-md border border-border/60 bg-background/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function DemandVolumeTrendChart({
  trend,
  keyword,
}: {
  trend: DemandVolumeTrend;
  keyword?: string;
}) {
  const { t, locale } = useAppLocale();
  const nl = numberLocale(locale);
  const dl = dateLocale(locale);
  const [rangePreset, setRangePreset] = useState<string>("12");
  const [granularity, setGranularity] = useState<"month" | "year">("month");

  const filteredMonths = useMemo(() => {
    let pts = [...trend.points].sort((a, b) => a.year - b.year || a.month - b.month);
    const today = new Date();
    const cy = today.getFullYear();
    const cm = today.getMonth() + 1;
    pts = pts.filter((p) => p.year < cy || (p.year === cy && p.month <= cm));
    if (rangePreset === "1" && pts.length > 1) pts = pts.slice(-1);
    else if (rangePreset === "12" && pts.length > 12) pts = pts.slice(-12);
    else if (rangePreset === "24" && pts.length > 24) pts = pts.slice(-24);
    else if (rangePreset === "36" && pts.length > 36) pts = pts.slice(-36);
    return pts;
  }, [trend.points, rangePreset]);

  const chartData = useMemo(() => {
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
    return filteredMonths.map((p) => ({
      key: `${p.year}-${p.month}`,
      label: format(new Date(p.year, p.month - 1, 1), "MMM yy", { locale: dl }),
      volume: p.volume,
    }));
  }, [filteredMonths, granularity, dl]);

  const stats = useMemo(() => {
    if (!filteredMonths.length) return null;
    const vols = filteredMonths.map((p) => p.volume);
    const avg = Math.round(vols.reduce((a, b) => a + b, 0) / vols.length);
    let peak = filteredMonths[0]!;
    for (const p of filteredMonths) {
      if (p.volume > peak.volume) peak = p;
    }
    const last = filteredMonths[filteredMonths.length - 1]!;
    const prev = filteredMonths.length > 1 ? filteredMonths[filteredMonths.length - 2]! : null;
    const mom =
      prev && prev.volume > 0
        ? Math.round(((last.volume - prev.volume) / prev.volume) * 1000) / 10
        : null;
    return { avg, peak, mom, last };
  }, [filteredMonths]);

  if (!trend.points.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {t("pages.demandRadar.trendEmpty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.trendTitle")}</h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {t("pages.demandRadar.trendSource")}
            {keyword ? ` · ${keyword}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={rangePreset}
            onChange={setRangePreset}
            options={[
              { id: "12", label: t("pages.demandRadar.trendLast12Short") },
              { id: "24", label: t("pages.demandRadar.trendLast24Short") },
              { id: "36", label: t("pages.demandRadar.trendLast36Short") },
              { id: "all", label: t("pages.demandRadar.trendAllSeriesShort") },
            ]}
          />
          <Segmented
            value={granularity}
            onChange={(v) => setGranularity(v as "month" | "year")}
            options={[
              { id: "month", label: t("pages.demandRadar.trendByMonth") },
              { id: "year", label: t("pages.demandRadar.trendByYear") },
            ]}
          />
        </div>
      </div>

      {stats ? (
        <div className="flex flex-wrap gap-2 border-b border-border/50 bg-muted/20 px-4 py-3">
          <StatChip label={t("pages.demandRadar.trendAvg")} value={formatInt(stats.avg, nl)} />
          <StatChip
            label={t("pages.demandRadar.trendPeak")}
            value={`${formatInt(stats.peak.volume, nl)} · ${format(
              new Date(stats.peak.year, stats.peak.month - 1, 1),
              "MMM yyyy",
              { locale: dl },
            )}`}
          />
          <StatChip
            label={t("pages.demandRadar.trendMom")}
            value={
              stats.mom == null
                ? t("pages.demandRadar.noVolume")
                : `${stats.mom > 0 ? "+" : ""}${stats.mom}%`
            }
          />
          <StatChip label={t("pages.demandRadar.trendLatest")} value={formatInt(stats.last.volume, nl)} />
        </div>
      ) : null}

      <div className="px-2 pb-3 pt-2 sm:px-4">
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">{t("pages.demandRadar.trendNoPoints")}</p>
        ) : (
          <div className="h-64 w-full min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {granularity === "year" ? (
                <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) => formatInt(Number(v), nl)}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.35)" }}
                    contentStyle={{
                      borderRadius: 10,
                      fontSize: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                    }}
                    formatter={(value: number | string) => [
                      formatInt(Number(value), nl),
                      t("pages.demandRadar.thVolume"),
                    ]}
                  />
                  <Bar dataKey="volume" fill="hsl(199 89% 42%)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="demandVolFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(199 89% 48%)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(199 89% 48%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) => formatInt(Number(v), nl)}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      fontSize: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                    }}
                    formatter={(value: number | string) => [
                      formatInt(Number(value), nl),
                      t("pages.demandRadar.thVolume"),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="hsl(199 89% 40%)"
                    strokeWidth={2.25}
                    fill="url(#demandVolFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
        <p className="px-2 pb-1 text-[10px] leading-relaxed text-muted-foreground">
          {t("pages.demandRadar.trendDayUnavailable")}
        </p>
      </div>
    </div>
  );
}
