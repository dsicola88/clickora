import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Globe } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { PresellAnalyticsPeriodControls } from "@/components/presell/PresellAnalyticsPeriodControls";
import { analyticsService } from "@/services/analyticsService";
import { rangeLast30Days } from "@/lib/dateRangePresets";
import { countryDisplayLabel, countryFlagEmoji, normalizeIsoCountryCode } from "@/lib/countryDisplay";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

/** Tipo devolvido por `analyticsService.getDashboard` (sucesso). */
export type PresellDashboardAnalyticsPayload = NonNullable<
  Awaited<ReturnType<typeof analyticsService.getDashboard>>["data"]
>;

export type PresellAnalyticsQueryShape = {
  data: PresellDashboardAnalyticsPayload | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

type DateRangeProps = {
  startDate: string;
  endDate: string;
  onApply: (p: { from: string; to: string }) => void;
};

/** Bloco 1: KPIs do script + gráfico diário (cartão próprio). */
export function PresellRastreamentoScriptCard({
  id = "rastreamento-script",
  startDate,
  endDate,
  onApply,
  query,
  className,
}: DateRangeProps & { id?: string; query: PresellAnalyticsQueryShape; className?: string }) {
  const gradId = useId().replace(/:/g, "");
  const { data: dashboard, isLoading, isError, error, refetch } = query;

  const imps = dashboard?.total_impressions ?? 0;
  const clicks = dashboard?.total_clicks ?? 0;
  const convs = dashboard?.total_conversions ?? 0;
  const ctr = dashboard?.ctr ?? 0;

  const chartData =
    dashboard?.chart_data?.map((d) => ({
      name: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      cliques: d.clicks,
      impressoes: d.impressions,
    })) ?? [];

  const periodLabel = dashboard?.period
    ? `${new Date(dashboard.period.from + "T12:00:00").toLocaleDateString("pt-BR")} — ${new Date(dashboard.period.to + "T12:00:00").toLocaleDateString("pt-BR")}`
    : null;

  const statGridClass =
    "rounded-xl border border-border/60 bg-background/80 px-3 py-3 sm:px-4";
  const statGridLabel = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
  const statGridValue = "mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl";

  const showChart = chartData.length > 0;

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-7 space-y-6",
        className,
      )}
      aria-labelledby="presell-rastreamento-heading"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 id="presell-rastreamento-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Rastreamento (script nas presells)
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Impressões, cliques e conversões onde o <strong className="font-medium text-foreground/90">script Clickora</strong>{" "}
            corre nas tuas páginas. Não substitui o relatório da conta Google Ads — só páginas com o script contam. Detalhe
            por presell:{" "}
            <Link to="/tracking/analytics" className="text-primary font-medium underline underline-offset-2">
              Analytics
            </Link>
            .
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 lg:max-w-xl">
          <PresellAnalyticsPeriodControls from={startDate} to={endDate} onApply={onApply} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar métricas…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Erro ao carregar métricas."}{" "}
          <button type="button" className="underline font-medium" onClick={() => refetch()}>
            Tentar outra vez
          </button>
        </p>
      ) : (
        <>
          {periodLabel ? (
            <p className="text-xs text-muted-foreground">
              Período dos totais: <span className="font-medium text-foreground/90">{periodLabel}</span>
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={statGridClass}>
              <p className={statGridLabel}>Impressões</p>
              <p className={statGridValue}>{imps.toLocaleString()}</p>
            </div>
            <div className={statGridClass}>
              <p className={statGridLabel}>Cliques</p>
              <p className={statGridValue}>{clicks.toLocaleString()}</p>
            </div>
            <div className={statGridClass}>
              <p className={statGridLabel}>Conversões</p>
              <p className={statGridValue}>{convs.toLocaleString()}</p>
            </div>
            <div className={statGridClass}>
              <p className={statGridLabel}>CTR</p>
              <p className={statGridValue}>{ctr.toFixed(1)}%</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5 rounded-lg" asChild>
              <Link to="/tracking/analytics">
                Analytics por presell
                <BarChart3 className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" asChild>
              <Link to="/tracking/relatorios">
                Relatórios
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {showChart ? (
            <div className="rounded-xl border border-border/60 bg-background/50 p-5 shadow-sm md:p-6">
              <h3 className="text-base font-semibold text-card-foreground mb-4">Cliques e impressões (diário)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`${gradId}-cliques`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(172 66% 38%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(172 66% 38%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id={`${gradId}-imps`} x1="0" y1="0" x2="0" y2="1">
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
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="impressoes"
                      stroke="hsl(28 92% 48%)"
                      fill={`url(#${gradId}-imps)`}
                      strokeWidth={2}
                      name="Impressões"
                    />
                    <Area
                      type="monotone"
                      dataKey="cliques"
                      stroke="hsl(172 66% 38%)"
                      fill={`url(#${gradId}-cliques)`}
                      strokeWidth={2}
                      name="Cliques"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 md:p-6">
              <p className="text-sm text-muted-foreground">
                Ainda não há dados de gráfico neste período. Confirme o script no <span className="font-medium text-foreground/90">head</span> das presells.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Bloco 2: cliques por país (cartão próprio; período partilhado com Rastreamento). */
export function PresellCliquesPorPaisCard({
  id = "cliques-pais",
  startDate,
  endDate,
  onApply,
  periodLabel,
  query,
  className,
}: DateRangeProps & {
  id?: string;
  periodLabel: string | null;
  query: PresellAnalyticsQueryShape;
  className?: string;
}) {
  const { data: dashboard, isLoading, isError, error, refetch } = query;
  const countries = dashboard?.clicks_by_country ?? [];
  const showGeo = countries.length > 0;

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-7 space-y-4",
        className,
      )}
      aria-labelledby="presell-pais-heading"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Globe className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 id="presell-pais-heading" className="text-lg font-semibold tracking-tight text-foreground">
              Cliques por país
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Cliques registados pelo <strong className="font-medium text-foreground/90">script Clickora</strong>, agrupados por
              país estimado via IP. O período é o mesmo que em{" "}
              <strong className="font-medium text-foreground/90">Rastreamento (script nas presells)</strong>
              {periodLabel ? (
                <>
                  : <span className="font-medium text-foreground/90">{periodLabel}</span>.
                </>
              ) : (
                <> — pode alterá-lo aqui ou no bloco de rastreamento.</>
              )}
            </p>
          </div>
        </div>
        <PresellAnalyticsPeriodControls from={startDate} to={endDate} onApply={onApply} className="lg:max-w-xl" showHint={false} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Erro ao carregar."}{" "}
          <button type="button" className="underline font-medium" onClick={() => refetch()}>
            Tentar outra vez
          </button>
        </p>
      ) : showGeo ? (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">País</th>
                <th className="px-3 py-2 font-medium text-right">Cliques</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((row, i) => {
                const iso = normalizeIsoCountryCode(row.country_code);
                const label = countryDisplayLabel(row.country_code);
                return (
                  <tr key={`${row.country_code ?? "x"}-${i}`} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-2.5 min-w-0 max-w-[min(100%,20rem)]"
                        title={iso ? `${label} (${iso})` : label}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-[1.35rem] leading-none shadow-inner"
                          aria-hidden
                        >
                          {countryFlagEmoji(row.country_code)}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">{label}</span>
                          {iso ? (
                            <span className="ml-2 text-xs font-mono text-muted-foreground tabular-nums">{iso}</span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{row.clicks.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 md:p-6">
          <p className="text-sm text-muted-foreground">
            Ainda não há cliques com país neste período. Os novos eventos passam a guardar o país automaticamente.
          </p>
        </div>
      )}
    </section>
  );
}

/** Hook reutilizável: um pedido partilhado pelos dois cartões. */
export function usePresellAnalyticsDashboardQuery(tenantKey: string | null, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["presell-script-dashboard", tenantKey, startDate, endDate] as const,
    queryFn: async () => {
      const { data, error: err } = await analyticsService.getDashboard({ from: startDate, to: endDate });
      if (err) throw new Error(err);
      return data as PresellDashboardAnalyticsPayload;
    },
    enabled: Boolean(tenantKey),
    retry: (failureCount, err) => {
      const msg = err instanceof Error ? err.message : "";
      if (/intervalo|inválido|inválida|formato yyyy-mm-dd/i.test(msg)) return false;
      return failureCount < 2;
    },
  });
}

/** @deprecated Preferir `PresellRastreamentoScriptCard` + `PresellCliquesPorPaisCard` com `usePresellAnalyticsDashboardQuery`. */
export function PresellScriptAnalyticsPanel({ tenantKey, className }: { tenantKey: string | null; className?: string }) {
  const initial = useMemo(() => rangeLast30Days(), []);
  const [startDate, setStartDate] = useState(initial.from);
  const [endDate, setEndDate] = useState(initial.to);
  const q = usePresellAnalyticsDashboardQuery(tenantKey, startDate, endDate);
  const periodLabel = q.data?.period
    ? `${new Date(q.data.period.from + "T12:00:00").toLocaleDateString("pt-BR")} — ${new Date(q.data.period.to + "T12:00:00").toLocaleDateString("pt-BR")}`
    : null;
  return (
    <div className={cn("space-y-6", className)}>
      <PresellRastreamentoScriptCard
        startDate={startDate}
        endDate={endDate}
        onApply={({ from, to }) => {
          setStartDate(from);
          setEndDate(to);
        }}
        query={q}
      />
      <PresellCliquesPorPaisCard
        startDate={startDate}
        endDate={endDate}
        onApply={({ from, to }) => {
          setStartDate(from);
          setEndDate(to);
        }}
        periodLabel={periodLabel}
        query={q}
      />
    </div>
  );
}
