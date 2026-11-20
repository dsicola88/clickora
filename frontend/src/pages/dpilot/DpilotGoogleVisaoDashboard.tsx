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
import { fill, type MessageKey } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import {
  campaignStatusBadgeClass,
  campaignStatusLabel,
  changeRequestCampaignIdFromPayload,
  effectiveCampaignServingStatus,
  formatUsdFromMicros,
} from "@/lib/paidAdsUi";
import { cn } from "@/lib/utils";
import { useGoogleManagerPrefs } from "@/hooks/useGoogleManagerPrefs";
import { GOOGLE_MANAGER_PRESETS, type GoogleManagerPreset } from "@/lib/googleManagerPrefs";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";

const PRESET_KEYS: Record<GoogleManagerPreset, MessageKey> = {
  today: "pages.dpilot.google.cm.presetToday",
  yesterday: "pages.dpilot.google.cm.presetYesterday",
  last_7: "pages.dpilot.google.cm.presetLast7",
  last_30: "pages.dpilot.google.cm.presetLast30",
  this_month: "pages.dpilot.google.cm.presetThisMonth",
  last_month: "pages.dpilot.google.cm.presetLastMonth",
};

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
  const { t } = useAppLocale();
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
  const presetLabel =
    preset in PRESET_KEYS ? t(PRESET_KEYS[preset as GoogleManagerPreset]) : preset;

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
    let tClicks = 0;
    let withG = 0;
    for (const c of linkedRows) {
      if (c.google_clicks == null) continue;
      withG += 1;
      g += c.google_clicks;
      tClicks += c.tracking_clicks ?? 0;
    }
    if (withG === 0 || g <= 0) return null;
    return { google: g, tracking: tClicks, ratio: tClicks / g };
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
    <div className="space-y-6" data-no-i18n>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {t("pages.dpilot.google.cm.visao.title")}
            </h1>
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
              {networkOk
                ? t("pages.dpilot.google.cm.visao.networkOk")
                : connected
                  ? t("pages.dpilot.google.cm.visao.localDraftsOnly")
                  : t("pages.dpilot.google.cm.visao.pendingSync")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {networkOk
              ? fill(t("pages.dpilot.google.cm.visao.metricsFromGoogle"), { range: rangeLabel })
              : fill(t("pages.dpilot.google.cm.visao.metricsLocalOnly"), { range: rangeLabel })}
            {ov?.account?.customer_id
              ? ` · ${ov.account.account_name || ov.account.customer_id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger
              className="w-[180px] border-slate-200"
              aria-label={t("pages.dpilot.google.cm.periodAria")}
            >
              <SelectValue placeholder={t("pages.dpilot.google.cm.periodAria")} />
            </SelectTrigger>
            <SelectContent>
              {GOOGLE_MANAGER_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(PRESET_KEYS[p])}
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
            <Link to={`/tracking/dpilot/p/${projectId}/google/conversoes`}>
              {t("pages.dpilot.google.cm.visao.conversions")}
            </Link>
          </Button>
          <Button size="sm" className="bg-[#1a73e8] hover:bg-[#1557b0]" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>
              {t("pages.dpilot.google.cm.visao.newCampaign")}
            </Link>
          </Button>
        </div>
      </div>

      {!connected ? (
        <Card className="border-amber-200 bg-amber-50/50 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-amber-950">{t("pages.dpilot.google.cm.visao.syncPrompt")}</p>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google`}>
                {t("pages.dpilot.google.cm.visao.settingsSync")}
              </Link>
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
                  {fill(t("pages.dpilot.google.cm.visao.funnelRisk"), { n: funnelRisk })}
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
                    {t("pages.dpilot.google.cm.visao.viewCampaigns")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {urlTotals && urlTotals.critical + urlTotals.warn > 0 ? (
            <Card className="border-amber-200/80 bg-amber-50/40 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                <p className="text-xs leading-relaxed text-amber-950">
                  {fill(t("pages.dpilot.google.cm.visao.finalUrlIssues"), {
                    critical: urlTotals.critical,
                    warn: urlTotals.warn,
                  })}
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
                    {t("pages.dpilot.google.cm.visao.repairInCampaigns")}
                  </Link>
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
              {localOnly
                ? t("pages.dpilot.google.cm.visao.localCounts")
                : t("pages.dpilot.google.cm.visao.googleAccountCollective")}
            </p>
            <p className="text-[11px] text-slate-400">{t("pages.dpilot.google.cm.visao.dashMeansNoData")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {localOnly ? (
              <>
                <KpiCard label={t("pages.dpilot.google.cm.visao.onGoogleRead")} value="—" />
                <KpiCard
                  label={t("pages.dpilot.google.cm.visao.draftsInProject")}
                  value={fmtNum(draftCount)}
                />
                <KpiCard
                  label={t("pages.dpilot.google.cm.visao.importedIdsUnverified")}
                  value={fmtNum(ov?.counts?.campaigns_linked)}
                />
              </>
            ) : (
              <>
                <KpiCard
                  label={t("pages.dpilot.google.cm.visao.importedCampaigns")}
                  value={fmtNum(ov?.counts?.campaigns_linked ?? ov?.counts?.campaigns_total)}
                  hint={fill(t("pages.dpilot.google.cm.visao.livePausedHint"), {
                    live: fmtNum(ov?.counts?.campaigns_live),
                    paused: fmtNum(ov?.counts?.campaigns_paused),
                  })}
                />
                <KpiCard
                  label={t("pages.dpilot.google.cm.visao.impressions")}
                  value={metrics ? fmtNum(metrics.impressions) : "—"}
                />
                <KpiCard
                  label={t("pages.dpilot.google.cm.visao.clicks")}
                  value={metrics ? fmtNum(metrics.clicks) : "—"}
                />
                <KpiCard
                  label={t("pages.dpilot.google.cm.visao.ctr")}
                  value={metrics ? fmtPct(metrics.ctr) : "—"}
                />
                <KpiCard
                  label={t("pages.dpilot.google.cm.visao.avgCpc")}
                  value={metrics ? formatUsdFromMicros(metrics.average_cpc_micros) : "—"}
                />
              </>
            )}
            <KpiCard
              label={t("pages.dpilot.google.cm.visao.spend")}
              value={metrics ? formatUsdFromMicros(metrics.cost_micros) : "—"}
            />
            <KpiCard
              label={t("pages.dpilot.google.cm.visao.conversions")}
              value={metrics ? fmtNum(metrics.conversions, 1) : "—"}
            />
            <KpiCard
              label={t("pages.dpilot.google.cm.visao.costPerConv")}
              value={metrics ? formatUsdFromMicros(metrics.cost_per_conversion_micros) : "—"}
            />
            <KpiCard
              label={t("pages.dpilot.google.cm.visao.roas")}
              value={metrics && metrics.roas > 0 ? fmtNum(metrics.roas, 2) : "—"}
            />
            <KpiCard
              label={t("pages.dpilot.google.cm.visao.capture")}
              value={captureAgg ? fmtPct(captureAgg.ratio, 0) : "—"}
              hint={
                captureAgg
                  ? fill(t("pages.dpilot.google.cm.visao.captureHint"), {
                      tracking: fmtNum(captureAgg.tracking),
                      google: fmtNum(captureAgg.google),
                    })
                  : networkOk
                    ? t("pages.dpilot.google.cm.visao.noGoogleClicks")
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
              {fill(t("pages.dpilot.google.cm.visao.importedSum"), {
                impr: fmtNum(importedRollup.impressions),
                clicks: fmtNum(importedRollup.clicks),
                cost: formatUsdFromMicros(importedRollup.cost),
                conv: fmtNum(importedRollup.conv, 1),
              })}
            </p>
          ) : null}
        </div>
      )}

      <Card className="border-slate-200/90 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">
            {t("pages.dpilot.google.cm.visao.topByCost")}
          </CardTitle>
          <span className="text-xs text-slate-500">
            {fill(t("pages.dpilot.google.cm.visao.importedSuffix"), { preset: presetLabel })}
          </span>
        </CardHeader>
        <CardContent className="h-56 pt-2">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              {t("pages.dpilot.google.cm.visao.noCostInPeriod")}
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
                      ? [`$${Number(value).toFixed(2)}`, t("pages.dpilot.google.cm.visao.chartSpend")]
                      : name === "cliques"
                        ? [fmtNum(value), t("pages.dpilot.google.cm.visao.chartClicks")]
                        : [fmtNum(value, 1), t("pages.dpilot.google.cm.visao.chartConversions")]
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
              {localOnly
                ? t("pages.dpilot.google.cm.visao.inventoryGoogle")
                : t("pages.dpilot.google.cm.visao.performanceByCampaign")}
            </CardTitle>
            {localOnly ? (
              <p className="mt-1 text-xs text-amber-800/90">
                {fill(t("pages.dpilot.google.cm.visao.inventoryOfflineHint"), {
                  account: ov?.account?.customer_id ?? "Google",
                })}
                {draftCount > 0
                  ? fill(t("pages.dpilot.google.cm.visao.draftsCount"), { n: draftCount })
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t("pages.dpilot.google.cm.visao.sortedByCost")}</p>
            )}
          </div>
          <Button variant="link" className="h-auto p-0 text-[#1a73e8]" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
              {localOnly
                ? t("pages.dpilot.google.cm.visao.importFromGoogle")
                : t("pages.dpilot.google.cm.visao.viewAll")}
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
                ? t("pages.dpilot.google.cm.visao.emptyLocalInventory")
                : t("pages.dpilot.google.cm.visao.emptyImported")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-2 font-medium">{t("pages.dpilot.google.cm.visao.colCampaign")}</th>
                    <th className="px-2 py-2 font-medium text-right">
                      {t("pages.dpilot.google.cm.visao.colImpr")}
                    </th>
                    <th className="px-2 py-2 font-medium text-right">
                      {t("pages.dpilot.google.cm.visao.colClicks")}
                    </th>
                    <th className="px-2 py-2 font-medium text-right">
                      {t("pages.dpilot.google.cm.visao.colCtr")}
                    </th>
                    <th className="px-2 py-2 font-medium text-right">
                      {t("pages.dpilot.google.cm.visao.colCost")}
                    </th>
                    <th className="px-2 py-2 font-medium text-right">
                      {t("pages.dpilot.google.cm.visao.colConv")}
                    </th>
                    <th className="px-6 py-2 font-medium text-right">
                      {t("pages.dpilot.google.cm.visao.colCapture")}
                    </th>
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
                                title={t("pages.dpilot.google.cm.visao.queuePendingTitle")}
                                aria-label={fill(t("pages.dpilot.google.cm.visao.queuePendingAria"), {
                                  n: pendingN,
                                })}
                              >
                                <Badge
                                  variant="secondary"
                                  className="h-5 font-normal text-[10px] hover:bg-secondary/80"
                                >
                                  {fill(t("pages.dpilot.google.cm.visao.queueBadge"), { n: pendingN })}
                                </Badge>
                              </Link>
                            ) : null}
                            {localDraftLinked ? (
                              <span className="text-[10px] text-amber-800">
                                {t("pages.dpilot.google.cm.visao.localDraft")}
                              </span>
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
                              {capturePct ?? t("pages.dpilot.google.cm.visao.risk")}
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
