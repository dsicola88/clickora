/**
 * Visão geral Google Ads — KPIs + desempenho + lista de campanhas (Campaign Manager).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { campaignStatusLabel, formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";

function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-slate-200/90 shadow-none">
      <CardContent className="px-4 py-4">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DpilotGoogleVisaoDashboard() {
  const { projectId, campaigns, reload, isConnConnected, overview } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [ov, setOv] = useState<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsManagerOverview>>["data"]>(
    null,
  );
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsCampaignsMetrics>>["data"]>["campaigns"]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, m] = await Promise.all([
      paidAdsService.getGoogleAdsManagerOverview(projectId, { preset: "last_30" }),
      paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset: "last_30" }),
    ]);
    setOv(o.data ?? null);
    setRows(m.data?.campaigns ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const connected = Boolean(ov?.connected) || isConnConnected(overview?.connection);
  const metrics = ov?.metrics;

  const chartData = useMemo(() => {
    const withCost = rows
      .filter((c) => c.metrics && c.local_status !== "archived")
      .slice()
      .sort((a, b) => (b.metrics?.cost_micros ?? 0) - (a.metrics?.cost_micros ?? 0))
      .slice(0, 8);
    if (withCost.length === 0) {
      return [
        { name: "—", investimento: 0, cliques: 0 },
      ];
    }
    return withCost.map((c) => ({
      name: c.name.length > 18 ? `${c.name.slice(0, 16)}…` : c.name,
      investimento: (c.metrics?.cost_micros ?? 0) / 1e6,
      cliques: c.metrics?.clicks ?? 0,
    }));
  }, [rows]);

  const list = useMemo(
    () =>
      rows
        .filter((c) => c.local_status !== "archived")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 12),
    [rows],
  );

  const localGoogle = campaigns.filter((c) => c.platform === "google_ads" && c.status !== "archived");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Visão geral</h1>
            <Badge
              className={
                connected
                  ? "border-emerald-200 bg-emerald-50 font-normal text-emerald-700 hover:bg-emerald-50"
                  : "border-amber-200 bg-amber-50 font-normal text-amber-800 hover:bg-amber-50"
              }
              variant="outline"
            >
              {connected ? "Conectado" : "Por sincronizar"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">Últimos 30 dias · métricas da conta Google Ads</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-200"
            disabled={loading}
            onClick={() => {
              reload();
              void load();
            }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha</Link>
          </Button>
        </div>
      </div>

      {!connected ? (
        <Card className="border-amber-200 bg-amber-50/50 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-amber-950">
              Sincronize a conta de Integrações para ver investimento, cliques e conversões reais.
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google`}>Configurações / sync</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading && !metrics && !ov?.counts ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total de campanhas" value={fmtNum(ov?.counts?.campaigns_total)} />
          <KpiCard label="Campanhas ativas" value={fmtNum(ov?.counts?.campaigns_live)} />
          <KpiCard label="Campanhas pausadas" value={fmtNum(ov?.counts?.campaigns_paused)} />
          <KpiCard
            label="Investimento total"
            value={metrics ? formatUsdFromMicros(metrics.cost_micros) : "—"}
          />
          <KpiCard label="Cliques" value={metrics ? fmtNum(metrics.clicks) : "—"} />
          <KpiCard label="Conversões" value={metrics ? fmtNum(metrics.conversions, 1) : "—"} />
          <KpiCard
            label="Custo por conversão"
            value={metrics ? formatUsdFromMicros(metrics.cost_per_conversion_micros) : "—"}
          />
          <KpiCard
            label="Receita"
            value={
              metrics && metrics.conversions_value > 0
                ? `$${fmtNum(metrics.conversions_value, 2)}`
                : "—"
            }
          />
          <KpiCard
            label="ROAS"
            value={metrics && metrics.roas > 0 ? fmtNum(metrics.roas, 2) : "—"}
          />
        </div>
      )}

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">Desempenho</CardTitle>
          <span className="text-xs text-slate-500">Últimos 30 dias · por campanha</span>
        </CardHeader>
        <CardContent className="h-56 pt-2">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gInvest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1a73e8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) =>
                    name === "investimento"
                      ? [`$${Number(value).toFixed(2)}`, "Investimento"]
                      : [fmtNum(value), "Cliques"]
                  }
                />
                <Area
                  type="monotone"
                  dataKey="investimento"
                  stroke="#1a73e8"
                  strokeWidth={2}
                  fill="url(#gInvest)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">Campanhas</CardTitle>
          <Button variant="link" className="h-auto p-0 text-[#1a73e8]" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-slate-100 px-0">
          {loading && list.length === 0 && localGoogle.length === 0 ? (
            <div className="space-y-2 px-6 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : list.length === 0 && localGoogle.length === 0 ? (
            <p className="px-6 py-6 text-sm text-slate-500">Ainda não há campanhas Google neste projecto.</p>
          ) : (
            (list.length > 0 ? list : localGoogle.map((c) => ({
              id: c.id,
              name: c.name,
              local_status: c.status,
              metrics: null as null,
            }))).map((c) => (
              <Link
                key={c.id}
                to={`/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`}
                className="flex items-center justify-between gap-3 px-6 py-3.5 transition hover:bg-slate-50"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-900">{c.name}</span>
                <Badge
                  variant="outline"
                  className={
                    c.local_status === "live"
                      ? "shrink-0 border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                      : c.local_status === "paused"
                        ? "shrink-0 border-orange-200 bg-orange-50 font-normal text-orange-800"
                        : "shrink-0 font-normal"
                  }
                >
                  {campaignStatusLabel(c.local_status)}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
