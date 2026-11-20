/**
 * Visão geral Google Ads — KPIs da conta + captura do funil + top campanhas (Campaign Manager).
 * Sem inventário inventado: rede OK = métricas Google; senão "—"/rascunhos locais.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  campaignStatusBadgeClass,
  campaignStatusLabel,
  changeRequestCampaignIdFromPayload,
  effectiveCampaignServingStatus,
  formatUsdFromMicros,
} from "@/lib/paidAdsUi";
import { cn } from "@/lib/utils";
import { useGoogleManagerPrefs } from "@/hooks/useGoogleManagerPrefs";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7", label: "Últimos 7 dias" },
  { value: "last_30", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
] as const;

function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtPct(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <Card className="border-slate-200/90 shadow-none">
      <CardContent className="px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p
          className={
            tone === "danger"
              ? "mt-1 text-2xl font-semibold tracking-tight text-red-700 tabular-nums"
              : tone === "warn"
                ? "mt-1 text-2xl font-semibold tracking-tight text-amber-800 tabular-nums"
                : tone === "ok"
                  ? "mt-1 text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums"
                  : "mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums"
          }
        >
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function DpilotGoogleVisaoDashboard() {
  const { projectId, reload, isConnConnected, overview, changeRequests } = useDpilotPaid();
  const { preset, setPreset } = useGoogleManagerPrefs(projectId);
  const [loading, setLoading] = useState(true);
  const [ov, setOv] = useState<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsManagerOverview>>["data"]>(
    null,
  );
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsCampaignsMetrics>>["data"]>["campaigns"]
  >([]);
  const [urlTotals, setUrlTotals] = useState<{ critical: number; warn: number; ok: number } | null>(null);
  const [funnelRisk, setFunnelRisk] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    /** Overview primeiro — pode curar solo/MCC; métricas usam o login já persistido. */
    const o = await paidAdsService.getGoogleAdsManagerOverview(projectId, { preset });
    setOv(o.data ?? null);
    const [m, audit] = await Promise.all([
      paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset }),
      paidAdsService.getGoogleAdsFinalUrlAudit(projectId),
    ]);
    setRows(m.data?.campaigns ?? []);
    setFunnelRisk(m.data?.totals?.funnel_risk ?? 0);
    if (!audit.error && audit.data) {
      setUrlTotals({
        critical: audit.data.totals.critical,
        warn: audit.data.totals.warn,
        ok: audit.data.totals.ok,
      });
    } else {
      setUrlTotals(null);
    }
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const networkOk = Boolean(ov?.connected) && !ov?.connection_error && ov?.source === "google_ads_api";
  const paidLinked = Boolean(ov?.connected) || isConnConnected(overview?.connection);
  const localOnly = Boolean(ov?.connection_error) || ov?.source === "local_only" || !networkOk;
  const connected = paidLinked;
  const metrics = ov?.metrics;
  const presetLabel = PRESETS.find((p) => p.value === preset)?.label ?? preset;

  const linkedRows = useMemo(
    () =>
      rows.filter(
        (c) => c.local_status !== "archived" && Boolean(c.external_campaign_id),
      ),
    [rows],
  );

  const pendingByCampaign = useMemo(() => {
    const map = new Map<string, number>();
    for (const cr of changeRequests) {
      if (cr.status !== "pending") continue;
      const cid = changeRequestCampaignIdFromPayload(cr.payload);
      if (!cid) continue;
      map.set(cid, (map.get(cid) ?? 0) + 1);
    }
    return map;
  }, [changeRequests]);

  /** Captura colectiva = soma Clickora / soma Google nas campanhas importadas. */
  const captureAgg = useMemo(() => {
    let g = 0;
    let t = 0;
    let withG = 0;
    for (const c of linkedRows) {
      if (c.google_clicks == null) continue;
      withG += 1;
      g += c.google_clicks;
      t += c.tracking_clicks ?? 0;
    }
    if (withG === 0 || g <= 0) return null;
    return { google: g, tracking: t, ratio: t / g };
  }, [linkedRows]);

  const importedRollup = useMemo(() => {
    let impressions = 0;
    let clicks = 0;
    let cost = 0;
    let conv = 0;
    let withM = 0;
    for (const c of linkedRows) {
      if (!c.metrics) continue;
      withM += 1;
      impressions += c.metrics.impressions;
      clicks += c.metrics.clicks;
      cost += c.metrics.cost_micros;
      conv += c.metrics.conversions;
    }
    return withM > 0 ? { impressions, clicks, cost, conv, withM } : null;
  }, [linkedRows]);

  const chartData = useMemo(() => {
    return linkedRows
      .filter((c) => c.metrics)
      .slice()
      .sort((a, b) => (b.metrics?.cost_micros ?? 0) - (a.metrics?.cost_micros ?? 0))
      .slice(0, 8)
      .map((c) => ({
        name: c.name.length > 16 ? `${c.name.slice(0, 14)}…` : c.name,
        fullName: c.name,
        investimento: (c.metrics?.cost_micros ?? 0) / 1e6,
        cliques: c.metrics?.clicks ?? 0,
        conversoes: c.metrics?.conversions ?? 0,
      }));
  }, [linkedRows]);

  const list = useMemo(
    () =>
      networkOk
        ? linkedRows
            .slice()
            .sort((a, b) => (b.metrics?.cost_micros ?? 0) - (a.metrics?.cost_micros ?? 0))
            .slice(0, 12)
        : [],
    [linkedRows, networkOk],
  );

  const draftCount = ov?.counts?.campaigns_local_drafts ?? 0;
  const rangeLabel =
    ov?.range?.from && ov?.range?.to ? `${ov.range.from} → ${ov.range.to}` : presetLabel;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Visão geral</h1>
            <Badge
              className={
                networkOk
                  ? "border-emerald-200 bg-emerald-50 font-normal text-emerald-700 hover:bg-emerald-50"
                  : connected
                    ? "border-amber-200 bg-amber-50 font-normal text-amber-800 hover:bg-amber-50"
                    : "border-amber-200 bg-amber-50 font-normal text-amber-800 hover:bg-amber-50"
              }
              variant="outline"
            >
              {networkOk ? "Rede OK" : connected ? "Só rascunhos locais" : "Por sincronizar"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {networkOk
              ? `${rangeLabel} · métricas da conta Google Ads`
              : `${rangeLabel} · contagens locais neste projecto (ainda sem inventário Google)`}
            {ov?.account?.customer_id
              ? ` · ${ov.account.account_name || ov.account.customer_id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[180px] border-slate-200" aria-label="Período">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button size="sm" variant="outline" className="border-slate-200" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google/conversoes`}>Conversões</Link>
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

      {networkOk && (funnelRisk > 0 || (urlTotals && urlTotals.critical + urlTotals.warn > 0)) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {funnelRisk > 0 ? (
            <Card className="border-red-200/80 bg-red-50/40 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                <p className="text-xs leading-relaxed text-red-950">
                  <span className="font-semibold">{funnelRisk} campanha(s)</span> com captura &lt; 50% (Google →
                  Clickora).
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Ver campanhas</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {urlTotals && urlTotals.critical + urlTotals.warn > 0 ? (
            <Card className="border-amber-200/80 bg-amber-50/40 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                <p className="text-xs leading-relaxed text-amber-950">
                  Final URL: <span className="font-semibold">{urlTotals.critical}</span> crítica(s) ·{" "}
                  {urlTotals.warn} aviso(s).
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Reparar em Campanhas</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {loading && !metrics && !ov?.counts ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {localOnly ? "Contagens locais" : "Conta Google (colectivo)"}
            </p>
            <p className="text-[11px] text-slate-400">
              <span className="font-semibold tabular-nums text-slate-600">—</span> = sem dados no período
              (não é zero)
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {localOnly ? (
              <>
                <KpiCard label="Na Google (lidas)" value="—" />
                <KpiCard label="Rascunhos neste projecto" value={fmtNum(draftCount)} />
                <KpiCard
                  label="IDs importados (não verificados)"
                  value={fmtNum(ov?.counts?.campaigns_linked)}
                />
              </>
            ) : (
              <>
                <KpiCard
                  label="Campanhas importadas"
                  value={fmtNum(ov?.counts?.campaigns_linked ?? ov?.counts?.campaigns_total)}
                  hint={`${fmtNum(ov?.counts?.campaigns_live)} ativas · ${fmtNum(ov?.counts?.campaigns_paused)} pausadas`}
                />
                <KpiCard label="Impressões" value={metrics ? fmtNum(metrics.impressions) : "—"} />
                <KpiCard label="Cliques" value={metrics ? fmtNum(metrics.clicks) : "—"} />
                <KpiCard label="CTR" value={metrics ? fmtPct(metrics.ctr) : "—"} />
                <KpiCard
                  label="CPC médio"
                  value={metrics ? formatUsdFromMicros(metrics.average_cpc_micros) : "—"}
                />
              </>
            )}
            <KpiCard
              label="Investimento"
              value={metrics ? formatUsdFromMicros(metrics.cost_micros) : "—"}
            />
            <KpiCard label="Conversões" value={metrics ? fmtNum(metrics.conversions, 1) : "—"} />
            <KpiCard
              label="Custo / conv."
              value={metrics ? formatUsdFromMicros(metrics.cost_per_conversion_micros) : "—"}
            />
            <KpiCard
              label="ROAS"
              value={metrics && metrics.roas > 0 ? fmtNum(metrics.roas, 2) : "—"}
            />
            <KpiCard
              label="Captura (Clickora / Google)"
              value={
                captureAgg
                  ? fmtPct(captureAgg.ratio, 0)
                  : networkOk
                    ? "—"
                    : "—"
              }
              hint={
                captureAgg
                  ? `${fmtNum(captureAgg.tracking)} / ${fmtNum(captureAgg.google)} cliques · campanhas importadas`
                  : networkOk
                    ? "Sem cliques Google no período nas importadas"
                    : undefined
              }
              tone={
                captureAgg == null
                  ? undefined
                  : captureAgg.ratio < 0.5 && captureAgg.google >= 10
                    ? "danger"
                    : captureAgg.ratio < 0.8
                      ? "warn"
                      : "ok"
              }
            />
          </div>
          {networkOk && importedRollup ? (
            <p className="text-[11px] text-slate-500">
              Soma das importadas: {fmtNum(importedRollup.impressions)} impr. · {fmtNum(importedRollup.clicks)}{" "}
              cliques · {formatUsdFromMicros(importedRollup.cost)} · {fmtNum(importedRollup.conv, 1)} conv. — pode
              diferir ligeiramente do total da conta se nem todas as campanhas estiverem importadas.
            </p>
          ) : null}
        </div>
      )}

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">Top campanhas por custo</CardTitle>
          <span className="text-xs text-slate-500">{presetLabel} · importadas</span>
        </CardHeader>
        <CardContent className="h-56 pt-2">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              Sem custo no período nas campanhas importadas.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                  labelFormatter={(_, payload) =>
                    String((payload?.[0]?.payload as { fullName?: string } | undefined)?.fullName ?? "")
                  }
                  formatter={(value: number, name: string) =>
                    name === "investimento"
                      ? [`$${Number(value).toFixed(2)}`, "Investimento"]
                      : name === "cliques"
                        ? [fmtNum(value), "Cliques"]
                        : [fmtNum(value, 1), "Conversões"]
                  }
                />
                <Bar dataKey="investimento" fill="#1a73e8" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              {localOnly ? "Inventário Google" : "Desempenho por campanha"}
            </CardTitle>
            {localOnly ? (
              <p className="mt-1 text-xs text-amber-800/90">
                A rede não respondeu — não listamos rascunhos deste projecto como se fossem da conta{" "}
                {ov?.account?.customer_id ?? "Google"}. Use «Re-sincronizar e importar» em Campanhas.
                {draftCount > 0
                  ? ` (${draftCount} rascunho${draftCount === 1 ? "" : "s"} só neste projecto.)`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Ordenado por custo · Google vs Clickora na mesma linha
              </p>
            )}
          </div>
          <Button variant="link" className="h-auto p-0 text-[#1a73e8]" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
              {localOnly ? "Importar da Google" : "Ver todas"}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {loading && list.length === 0 ? (
            <div className="space-y-2 px-6 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : list.length === 0 ? (
            <p className="px-6 py-6 text-sm text-slate-500">
              {localOnly
                ? "Nenhuma campanha da Google confirmada. Os rascunhos ficam em Campanhas → «Só neste projecto»."
                : "Ainda não há campanhas Google importadas neste projecto."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-2 font-medium">Campanha</th>
                    <th className="px-2 py-2 font-medium text-right">Impr.</th>
                    <th className="px-2 py-2 font-medium text-right">Cliques</th>
                    <th className="px-2 py-2 font-medium text-right">CTR</th>
                    <th className="px-2 py-2 font-medium text-right">Custo</th>
                    <th className="px-2 py-2 font-medium text-right">Conv.</th>
                    <th className="px-6 py-2 font-medium text-right">Captura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((c) => {
                    const m = c.metrics;
                    const capturePct =
                      c.click_capture_ratio != null ? `${(c.click_capture_ratio * 100).toFixed(0)}%` : null;
                    const serving = effectiveCampaignServingStatus(c);
                    const pendingN = pendingByCampaign.get(c.id) ?? 0;
                    const localDraftLinked =
                      Boolean(c.external_campaign_id) &&
                      (c.local_status === "draft" || c.local_status === "pending_publish") &&
                      (serving === "live" || serving === "paused");
                    return (
                      <tr key={c.id} className="transition hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Link
                              to={`/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`}
                              className="min-w-0 truncate font-medium text-slate-900 hover:text-[#1a73e8]"
                            >
                              {c.name}
                            </Link>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 font-normal",
                                campaignStatusBadgeClass(serving),
                              )}
                              title={
                                c.google_status
                                  ? `Google: ${c.google_status}`
                                  : c.external_campaign_id
                                    ? "Estado local (rede sem status)"
                                    : undefined
                              }
                            >
                              {campaignStatusLabel(serving)}
                            </Badge>
                            {pendingN > 0 ? (
                              <Link
                                to={`/tracking/dpilot/p/${projectId}/google/aprovacoes?campaign=${c.id}`}
                                className="inline-flex shrink-0"
                                title="Pedidos pendentes em Aprovações"
                                aria-label={`Fila de aprovações: ${pendingN} pendente(s)`}
                              >
                                <Badge variant="secondary" className="h-5 font-normal text-[10px] hover:bg-secondary/80">
                                  Fila {pendingN}
                                </Badge>
                              </Link>
                            ) : null}
                            {localDraftLinked ? (
                              <span className="text-[10px] text-amber-800">Local: rascunho</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                          {m ? fmtNum(m.impressions) : "—"}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                          {m ? fmtNum(m.clicks) : "—"}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                          {m ? fmtPct(m.ctr) : "—"}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                          {m ? formatUsdFromMicros(m.cost_micros) : "—"}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                          {m ? fmtNum(m.conversions, 1) : "—"}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {c.funnel_risk ? (
                            <span
                              className="text-xs font-medium text-red-700"
                              title={`Clickora ${fmtNum(c.tracking_clicks)} / Google ${fmtNum(c.google_clicks)}`}
                            >
                              {capturePct ?? "Risco"}
                            </span>
                          ) : capturePct ? (
                            <span
                              className="text-xs text-slate-600"
                              title={`Clickora ${fmtNum(c.tracking_clicks)} / Google ${fmtNum(c.google_clicks)}`}
                            >
                              {fmtNum(c.tracking_clicks)}/{fmtNum(c.google_clicks)} · {capturePct}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
