import { useMemo, useState } from "react";
import { format } from "date-fns";
import { enUS, es, pt, ptBR } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { AppLocale } from "@/i18n/types";
import type { DemandVolumeTrend } from "@/services/demandRadarService";

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

export function DemandVolumeTrendChart({ trend }: { trend: DemandVolumeTrend }) {
  const { t, locale } = useAppLocale();
  const nl = numberLocale(locale);
  const dl = dateLocale(locale);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [rangePreset, setRangePreset] = useState<string>("12");
  const [granularity, setGranularity] = useState<"month" | "year">("month");

  const yearsAvailable = useMemo(() => {
    const ys = new Set<number>();
    for (const p of trend.points) ys.add(p.year);
    return [...ys].sort((a, b) => a - b);
  }, [trend.points]);

  const filteredMonths = useMemo(() => {
    let pts = [...trend.points];
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
    else if (rangePreset === "36" && pts.length > 36) pts = pts.slice(-36);
    return pts;
  }, [trend.points, yearFilter, rangePreset]);

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
      label: format(new Date(p.year, p.month - 1, 1), "MMM yyyy", { locale: dl }),
      volume: p.volume,
    }));
  }, [filteredMonths, granularity, dl]);

  if (!trend.points.length) {
    return (
      <div className="rounded-lg border border-border/70 px-4 py-6 text-sm text-muted-foreground">
        {t("pages.demandRadar.trendEmpty")}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t("pages.demandRadar.trendTitle")}</h3>
          <p className="text-[11px] text-muted-foreground">{t("pages.demandRadar.trendSource")}</p>
        </div>
        <p className="max-w-sm text-[10px] leading-snug text-muted-foreground">
          {t("pages.demandRadar.trendDayUnavailable")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">{t("pages.demandRadar.trendYear")}</Label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pages.demandRadar.trendAllYears")}</SelectItem>
              {yearsAvailable.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">{t("pages.demandRadar.trendWindow")}</Label>
          <Select value={rangePreset} onValueChange={setRangePreset}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t("pages.demandRadar.trendLast1")}</SelectItem>
              <SelectItem value="12">{t("pages.demandRadar.trendLast12")}</SelectItem>
              <SelectItem value="24">{t("pages.demandRadar.trendLast24")}</SelectItem>
              <SelectItem value="36">{t("pages.demandRadar.trendLast36")}</SelectItem>
              <SelectItem value="all">{t("pages.demandRadar.trendAllSeries")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">{t("pages.demandRadar.trendGranularity")}</Label>
          <Select
            value={granularity}
            onValueChange={(v) => setGranularity(v as "month" | "year")}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("pages.demandRadar.trendByMonth")}</SelectItem>
              <SelectItem value="year">{t("pages.demandRadar.trendByYear")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">{t("pages.demandRadar.trendNoPoints")}</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 10 }}
                width={48}
                tickFormatter={(v) => formatInt(Number(v), nl)}
              />
              <Tooltip
                formatter={(value: number | string) => [
                  formatInt(Number(value), nl),
                  t("pages.demandRadar.thVolume"),
                ]}
                labelClassName="text-xs"
              />
              <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
