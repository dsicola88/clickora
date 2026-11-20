/**
 * Hub de gestão Google Ads (Paid) — overview, inventário, orçamentos, recomendações, IA, histórico.
 * Dados via API oficial; sem métricas inventadas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Bot,
  Copy,
  Download,
  Loader2,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { paidModeCanonicalLine, paidModeShortChip } from "@/lib/paidModeCopy";
import { cn } from "@/lib/utils";
import {
  campaignStatusBadgeClass,
  campaignStatusLabel,
  changeRequestCampaignIdFromPayload,
  changeRequestStatusLabel,
  changeRequestTypeLabel,
  effectiveCampaignServingStatus,
  formatUsdFromMicros,
  friendlyGoogleAdsNetworkError,
  googleAdsNeedsReauth,
  googleBiddingStrategyLabel,
  describeStudioChangeRequestStatus,
  summarizeChangeRequestPayload,
  toastGoogleAdsError,
} from "@/lib/paidAdsUi";
import { syncGoogleAdsFromIntegrations } from "@/lib/googleAdsSync";
import { useGoogleManagerPrefs, GOOGLE_MANAGER_ALL_CAMPAIGNS } from "@/hooks/useGoogleManagerPrefs";
import {
  GOOGLE_MANAGER_PRESETS,
  googleManagerPresetLabel,
  googleManagerPresetLabelKey,
} from "@/lib/googleManagerPrefs";
import { GoogleAdsBudgetDialog } from "@/components/dpilot/GoogleAdsBudgetDialog";
import { GoogleAdsDuplicateDialog } from "@/components/dpilot/GoogleAdsDuplicateDialog";
import {
  alignGoogleCustomers,
  conversionFunnelStatus,
  googleAdsSyncShortLabel,
  summarizeGoogleAdsSyncHealth,
} from "@/lib/googleAdsConversionHealth";
import { analyticsService } from "@/services/analyticsService";
import { integrationsService } from "@/services/integrationsService";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { Gate } from "./DpilotPaidPages";
import { DpilotGoogleSearchTermsPanel } from "./DpilotGoogleSearchTermsPanel";
import { DpilotGoogleImportPanel } from "./DpilotGoogleImportPanel";

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function PeriodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useAppLocale();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]" aria-label={t("pages.dpilot.google.cm.periodAria")}>
        <SelectValue placeholder={t("pages.dpilot.google.cm.periodAria")} />
      </SelectTrigger>
      <SelectContent>
        {GOOGLE_MANAGER_PRESETS.map((p) => {
          const key = googleManagerPresetLabelKey(p);
          return (
            <SelectItem key={p} value={p}>
              {key ? t(key) : p}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}


export function DpilotGoogleCampaignsManagerPage() {
  const { t } = useAppLocale();
  const { projectId, reload, overview, isConnConnected, changeRequests } = useDpilotPaid();
  const { preset, setPreset } = useGoogleManagerPrefs(projectId);
  const [q, setQ] = useState("");
  const [st, setSt] = useState<
    "on_google" | "local_drafts" | "excluding_archived" | "live" | "paused" | "funnel_risk"
  >("on_google");
  const [linking, setLinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsCampaignsMetrics>>["data"]>["campaigns"]
  >([]);
  const [source, setSource] = useState<string>("");
  const [inventoryScope, setInventoryScope] = useState<string>("");
  const [accountCustomerId, setAccountCustomerId] = useState<string | null>(null);
  const [connErr, setConnErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [budgetDialog, setBudgetDialog] = useState<{
    campaignId: string;
    currentUsd: number | null;
  } | null>(null);
  const [dupDialog, setDupDialog] = useState<{
    campaignId: string;
    name: string;
    currentUsd: number | null;
  } | null>(null);
  const [termsCampaignId, setTermsCampaignId] = useState<string | null>(null);
  const termsPanelRef = useRef<HTMLDivElement | null>(null);
  const [urlAuditById, setUrlAuditById] = useState<
    Map<
      string,
      NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsFinalUrlAudit>>["data"]>["campaigns"][number]
    >
  >(new Map());
  const [urlAuditTotals, setUrlAuditTotals] = useState<{
    campaigns: number;
    ok: number;
    warn: number;
    critical: number;
  } | null>(null);
  const [funnelRiskCount, setFunnelRiskCount] = useState(0);
  const [repairingUrls, setRepairingUrls] = useState(false);

  const scrollTermsPanelIntoView = useCallback(() => {
    window.requestAnimationFrame(() => {
      termsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const openSearchTerms = useCallback(
    (campaignId: string, campaignName: string) => {
      setTermsCampaignId(campaignId);
      toast.message(fill(t("pages.dpilot.google.cm.campaigns.termsToast"), { name: campaignName }));
      // Re-clique na mesma campanha: estado igual → force scroll
      scrollTermsPanelIntoView();
    },
    [scrollTermsPanelIntoView, t],
  );

  useEffect(() => {
    if (!termsCampaignId) return;
    scrollTermsPanelIntoView();
  }, [termsCampaignId, scrollTermsPanelIntoView]);

  const load = useCallback(async () => {
    setLoading(true);
    const [metricsRes, auditRes] = await Promise.all([
      paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset }),
      paidAdsService.getGoogleAdsFinalUrlAudit(projectId),
    ]);
    if (metricsRes.error) toast.error(toastGoogleAdsError(metricsRes.error));
    else {
      const data = metricsRes.data;
      setRows(data?.campaigns ?? []);
      setSource(data?.source ?? "");
      setInventoryScope(data?.inventory_scope ?? "");
      setAccountCustomerId(data?.account?.customer_id ?? null);
      setConnErr(data?.connection_error ?? null);
      setFunnelRiskCount(data?.totals?.funnel_risk ?? 0);
    }
    if (!auditRes.error && auditRes.data) {
      const map = new Map<string, (typeof auditRes.data.campaigns)[number]>();
      for (const c of auditRes.data.campaigns) map.set(c.campaign_id, c);
      setUrlAuditById(map);
      setUrlAuditTotals(auditRes.data.totals);
    } else {
      setUrlAuditById(new Map());
      setUrlAuditTotals(null);
      if (auditRes.error) {
        toast.message(
          toastGoogleAdsError(t("pages.dpilot.google.cm.campaigns.urlAuditUnavailable")),
        );
      }
    }
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const localOnlyInventory =
    source === "local_only" || inventoryScope === "local_drafts" || Boolean(connErr);

  /** Rede falhou: abrir «Só neste projecto» em vez de «Na Google» com IDs não verificados. */
  useEffect(() => {
    if (
      localOnlyInventory &&
      (st === "on_google" || st === "live" || st === "paused" || st === "funnel_risk")
    ) {
      setSt("local_drafts");
    }
  }, [localOnlyInventory, st]);

  const filtered = useMemo(() => {
    let xs = rows;
    /** Rede falhou: não listar IDs locais como inventário Google verificado. */
    if (
      localOnlyInventory &&
      (st === "on_google" || st === "live" || st === "paused" || st === "funnel_risk")
    ) {
      xs = [];
    } else if (st === "on_google") {
      xs = xs.filter((c) => Boolean(c.external_campaign_id) && c.local_status !== "archived");
    } else if (st === "local_drafts") {
      xs = xs.filter((c) => !c.external_campaign_id && c.local_status !== "archived");
    } else if (st === "excluding_archived") xs = xs.filter((c) => c.local_status !== "archived");
    else if (st === "live") {
      xs = xs.filter(
        (c) => Boolean(c.external_campaign_id) && effectiveCampaignServingStatus(c) === "live",
      );
    } else if (st === "paused") {
      xs = xs.filter(
        (c) => Boolean(c.external_campaign_id) && effectiveCampaignServingStatus(c) === "paused",
      );
    } else if (st === "funnel_risk") {
      xs = xs.filter(
        (c) => Boolean(c.external_campaign_id) && c.local_status !== "archived" && c.funnel_risk,
      );
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      xs = xs.filter(
        (c) => c.name.toLowerCase().includes(needle) || (c.external_campaign_id ?? "").includes(needle),
      );
    }
    return xs;
  }, [rows, q, st, localOnlyInventory]);

  const chipCounts = useMemo(() => {
    const work = rows.filter((c) => c.local_status !== "archived");
    const onGoogle = localOnlyInventory
      ? []
      : work.filter((c) => Boolean(c.external_campaign_id));
    return {
      on_google: onGoogle.length,
      local_drafts: work.filter((c) => !c.external_campaign_id).length,
      live: onGoogle.filter((c) => effectiveCampaignServingStatus(c) === "live").length,
      paused: onGoogle.filter((c) => effectiveCampaignServingStatus(c) === "paused").length,
    };
  }, [rows, localOnlyInventory]);

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

  const paidConnected = isConnConnected(overview?.connection);
  const connMeta = overview?.connection as
    | { account_name?: string | null; google_customer_id?: string | null }
    | undefined;
  const accountLabel = connMeta?.account_name || connMeta?.google_customer_id || null;

  const syncAccount = async () => {
    setLinking(true);
    try {
      const result = await syncGoogleAdsFromIntegrations(projectId);
      if (!result.ok) return;
      reload();
      void load();
    } finally {
      setLinking(false);
    }
  };

  const onDuplicate = (id: string, name: string, currentBudgetMicros: number | null) => {
    setDupDialog({
      campaignId: id,
      name,
      currentUsd: currentBudgetMicros != null ? currentBudgetMicros / 1e6 : null,
    });
  };

  const confirmDuplicate = async (values: {
    name: string;
    daily_budget_usd?: number;
    publish: boolean;
  }) => {
    if (!dupDialog) return;
    const id = dupDialog.campaignId;
    setBusyId(id);
    const { data, error } = await paidAdsService.duplicateGoogleCampaign(projectId, id, {
      name: values.name,
      daily_budget_usd: values.daily_budget_usd,
      publish: values.publish,
    });
    setBusyId(null);
    if (error) {
      toast.error(toastGoogleAdsError(error));
      return;
    }
    toast.success(fill(t("pages.dpilot.google.cm.campaigns.copyCreated"), { name: data?.name ?? "" }));
    data?.warnings?.forEach((w) => toast.message(w));
    setDupDialog(null);
    reload();
    void load();
    if (data?.campaign_id) {
      const needsApprovals = values.publish && data.published_applied === false;
      window.location.assign(
        needsApprovals
          ? `/tracking/dpilot/p/${projectId}/google/aprovacoes`
          : `/tracking/dpilot/p/${projectId}/campanhas/${data.campaign_id}/google`,
      );
    }
  };

  const onBudget = (
    campaignId: string,
    currentMicros: number | null,
    meta?: { budget_editable?: boolean; budget_reference_count?: number },
  ) => {
    if (meta?.budget_editable === false) {
      toast.error(
        fill(t("pages.dpilot.google.cm.common.sharedBudgetBlocked"), {
          n: meta.budget_reference_count ?? t("pages.dpilot.google.cm.common.sharedBudgetSeveral"),
        }),
      );
      return;
    }
    setBudgetDialog({
      campaignId,
      currentUsd: currentMicros != null ? currentMicros / 1e6 : null,
    });
  };

  const confirmBudget = async (usd: number) => {
    if (!budgetDialog) return;
    const campaignId = budgetDialog.campaignId;
    setBusyId(campaignId);
    const { data, error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, {
      action: "update_budget_usd",
      daily_budget_usd: usd,
    });
    setBusyId(null);
    if (error) toast.error(toastGoogleAdsError(error));
    else {
      const info = describeStudioChangeRequestStatus(data?.change_request?.status, t);
      const msg =
        info.kind === "applied"
          ? fill(t("pages.dpilot.google.cm.common.budgetApplied"), { usd: usd.toFixed(2) })
          : fill(t("pages.dpilot.google.cm.common.budgetQueued"), { usd: usd.toFixed(2), msg: info.message });
      if (info.kind === "failed") toast.error(msg);
      else if (info.kind === "applied") toast.success(msg);
      else toast.message(msg);
      setBudgetDialog(null);
      reload();
      void load();
    }
  };

  const studioAction = async (campaignId: string, action: "pause_campaign" | "resume_campaign") => {
    const label =
      action === "pause_campaign"
        ? t("pages.dpilot.google.cm.common.pause")
        : t("pages.dpilot.google.cm.common.resume");
    const confirmMsg =
      action === "pause_campaign"
        ? t("pages.dpilot.google.cm.common.pauseCampaignConfirm")
        : t("pages.dpilot.google.cm.common.resumeCampaignConfirm");
    if (!window.confirm(confirmMsg)) return;
    setBusyId(campaignId);
    const { data, error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, { action });
    setBusyId(null);
    if (error) toast.error(toastGoogleAdsError(error));
    else {
      const info = describeStudioChangeRequestStatus(data?.change_request?.status, t);
      if (info.kind === "failed") toast.error(fill(t("pages.dpilot.google.cm.common.actionWithMsg"), { label, msg: info.message }));
      else if (info.kind === "applied")
        toast.success(
          action === "pause_campaign"
            ? t("pages.dpilot.google.cm.common.pauseApplied")
            : t("pages.dpilot.google.cm.common.resumeApplied"),
        );
      else toast.message(fill(t("pages.dpilot.google.cm.common.actionWithMsg"), { label, msg: info.message }));
      reload();
      void load();
    }
  };

  const exportCsv = () => {
    const header = [
      "name",
      "id",
      "external_id",
      "local_status",
      "serving_status",
      "google_status",
      "budget_usd",
      "impressions",
      "clicks",
      "ctr",
      "cpc",
      "cost",
      "conversions",
      "cpa",
      "roas",
    ];
    const lines = filtered.map((c) => {
      const m = c.metrics;
      return [
        JSON.stringify(c.name),
        c.id,
        c.external_campaign_id ?? "",
        c.local_status,
        effectiveCampaignServingStatus(c),
        c.google_status ?? "",
        c.daily_budget_micros != null ? (c.daily_budget_micros / 1e6).toFixed(2) : "",
        m?.impressions ?? "",
        m?.clicks ?? "",
        m ? (m.ctr * 100).toFixed(2) : "",
        m ? (m.average_cpc_micros / 1e6).toFixed(4) : "",
        m ? (m.cost_micros / 1e6).toFixed(2) : "",
        m?.conversions ?? "",
        m ? (m.cost_per_conversion_micros / 1e6).toFixed(2) : "",
        m?.roas?.toFixed(2) ?? "",
      ].join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `google-campaigns-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const accountSuffix = accountCustomerId
    ? fill(t("pages.dpilot.google.cm.campaigns.accountParen"), {
        id: accountCustomerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3"),
      })
    : "";

  return (
    <Gate>
      <div className="space-y-0" data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.campaigns.title")}
        description={
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("pages.dpilot.google.cm.campaigns.description")}
          </p>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {paidConnected && accountLabel ? (
              <Badge variant="outline" className="font-mono text-[11px] font-normal">
                {accountLabel}
              </Badge>
            ) : null}
            <PeriodSelect value={preset} onChange={setPreset} />
            <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" />
              {t("pages.dpilot.google.cm.common.csv")}
            </Button>
            <Button asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("pages.dpilot.google.cm.campaigns.createCampaign")}
              </Link>
            </Button>
          </div>
        }
      />

      {!paidConnected ? (
        <Alert className="mt-4 border-[#1a73e8]/30">
          <AlertTitle>{t("pages.dpilot.google.cm.campaigns.accountUnsyncedTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t("pages.dpilot.google.cm.campaigns.accountUnsyncedBody")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
                {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("pages.dpilot.google.cm.common.useIntegrationsAccount")}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/integracoes/google-ads">{t("pages.dpilot.google.cm.common.openIntegrations")}</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {connErr && paidConnected && !googleAdsNeedsReauth(connErr) ? (
        <Alert className="mt-4 border-amber-500/40 bg-amber-500/5">
          <AlertTitle>{t("pages.dpilot.google.cm.campaigns.localMismatchTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{friendlyGoogleAdsNetworkError(connErr) ?? connErr}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {fill(t("pages.dpilot.google.cm.campaigns.localMismatchHint"), { accountSuffix })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
                {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("pages.dpilot.google.cm.common.resyncImport")}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/integracoes/google-ads">{t("pages.dpilot.google.cm.campaigns.checkIntegrations")}</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : paidConnected && localOnlyInventory && chipCounts.on_google === 0 ? (
        <Alert className="mt-4 border-amber-500/40 bg-amber-500/5">
          <AlertTitle>{t("pages.dpilot.google.cm.campaigns.noImportedTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-xs leading-relaxed">{t("pages.dpilot.google.cm.campaigns.noImportedBody")}</p>
            <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
              {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("pages.dpilot.google.cm.common.resyncImport")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : paidConnected && !connErr ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {fill(t("pages.dpilot.google.cm.common.sourceLabel"), { source: source || "—" })}
          {accountCustomerId
            ? fill(t("pages.dpilot.google.cm.common.accountSuffix"), {
                id: accountCustomerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3"),
              })
            : ""}
        </p>
      ) : null}

      {paidConnected ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-1 text-emerald-900">
            <span className="font-semibold">{t("pages.dpilot.google.cm.common.onGoogle")}</span>
            {fill(t("pages.dpilot.google.cm.campaigns.legendOnGoogle"), { n: chipCounts.on_google })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/80 bg-white px-2 py-1 text-emerald-900">
            <span className="font-semibold">{t("pages.dpilot.google.cm.common.active")}</span>
            {fill(t("pages.dpilot.google.cm.campaigns.legendActive"), { n: chipCounts.live })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1 text-amber-950">
            <span className="font-semibold">{t("pages.dpilot.google.cm.common.paused")}</span>
            {fill(t("pages.dpilot.google.cm.campaigns.legendPaused"), { n: chipCounts.paused })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
            <span className="font-semibold">{t("pages.dpilot.google.cm.common.onlyInProject")}</span>
            {fill(t("pages.dpilot.google.cm.campaigns.legendLocal"), { n: chipCounts.local_drafts })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
            <span className="font-semibold tabular-nums">—</span>
            {t("pages.dpilot.google.cm.common.dashNoDataHint")}
          </span>
        </div>
      ) : null}

      {(() => {
        const work = rows.filter((c) => c.local_status !== "archived" && Boolean(c.external_campaign_id));
        let clicks = 0;
        let impressions = 0;
        let cost = 0;
        let conv = 0;
        let value = 0;
        let withM = 0;
        let gClicks = 0;
        let tClicks = 0;
        let withCapture = 0;
        for (const c of work) {
          if (c.metrics) {
            withM += 1;
            clicks += c.metrics.clicks;
            impressions += c.metrics.impressions;
            cost += c.metrics.cost_micros;
            conv += c.metrics.conversions;
            value += c.metrics.conversions_value;
          }
          if (c.google_clicks != null && c.google_clicks > 0) {
            withCapture += 1;
            gClicks += c.google_clicks;
            tClicks += c.tracking_clicks ?? 0;
          }
        }
        const costUsd = cost / 1e6;
        const roas = costUsd > 0 ? value / costUsd : null;
        const avgCpc = clicks > 0 ? Math.round(cost / clicks) : null;
        const capturePct = withCapture > 0 && gClicks > 0 ? tClicks / gClicks : null;
        const tile = (label: string, val: string, hint?: string) => (
          <Card key={label} className="border-border/70 shadow-none">
            <CardContent className="px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{val}</p>
              {hint ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
            </CardContent>
          </Card>
        );
        return (
          <div className="mt-4 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">{t("pages.dpilot.google.cm.campaigns.metricsHint")}</p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
              {tile(t("pages.dpilot.google.cm.common.onGoogle"), fmtNum(chipCounts.on_google))}
              {tile(t("pages.dpilot.google.cm.common.drafts"), fmtNum(chipCounts.local_drafts))}
              {tile(t("pages.dpilot.google.cm.common.activePlural"), fmtNum(chipCounts.live))}
              {tile(t("pages.dpilot.google.cm.common.impressionsShort"), withM ? fmtNum(impressions) : "—")}
              {tile(t("pages.dpilot.google.cm.common.clicks"), withM ? fmtNum(clicks) : "—")}
              {tile(t("pages.dpilot.google.cm.common.avgCpc"), withM && avgCpc != null ? formatUsdFromMicros(avgCpc) : "—")}
              {tile(t("pages.dpilot.google.cm.common.spend"), withM ? formatUsdFromMicros(cost) : "—")}
              {tile(t("pages.dpilot.google.cm.common.conversions"), withM ? fmtNum(conv, 1) : "—")}
              {tile(
                t("pages.dpilot.google.cm.common.roas"),
                withM && roas != null ? roas.toFixed(2) : "—",
                withM && value > 0
                  ? value.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    })
                  : undefined,
              )}
              {tile(
                t("pages.dpilot.google.cm.common.capture"),
                capturePct != null ? `${(capturePct * 100).toFixed(0)}%` : "—",
                capturePct != null
                  ? fill(t("pages.dpilot.google.cm.campaigns.captureClickoraGoogle"), {
                      tracking: fmtNum(tClicks),
                      google: fmtNum(gClicks),
                    })
                  : funnelRiskCount > 0
                    ? fill(t("pages.dpilot.google.cm.campaigns.withRiskCount"), { n: funnelRiskCount })
                    : undefined,
              )}
            </div>
          </div>
        );
      })()}

      {urlAuditTotals && urlAuditTotals.critical + urlAuditTotals.warn > 0 ? (
        <Alert variant={urlAuditTotals.critical > 0 ? "destructive" : "default"} className="mt-4">
          <AlertTitle className="text-sm">{t("pages.dpilot.google.cm.campaigns.finalUrlAlertTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 text-xs leading-relaxed sm:flex-row sm:items-center sm:justify-between">
            <span>
              {fill(t("pages.dpilot.google.cm.campaigns.finalUrlAlertBody"), {
                critical: urlAuditTotals.critical,
                warn: urlAuditTotals.warn,
                ok: urlAuditTotals.ok,
              })}
            </span>
            {urlAuditTotals.critical > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={repairingUrls}
                onClick={() => {
                  void (async () => {
                    setRepairingUrls(true);
                    try {
                      const { data, error } = await paidAdsService.repairGoogleAdsFinalUrls(projectId);
                      if (error || !data) {
                        const raw = (error || "").trim();
                        const looks404 =
                          /\b404\b/i.test(raw) ||
                          /não encontrad/i.test(raw) ||
                          /not found/i.test(raw) ||
                          /method_not_allowed/i.test(raw);
                        toast.error(
                          toastGoogleAdsError(
                            looks404
                              ? t("pages.dpilot.google.cm.campaigns.repairUnavailable")
                              : raw || t("pages.dpilot.google.cm.campaigns.repairFailed"),
                          ),
                        );
                        return;
                      }
                      const applied =
                        typeof data.applied_to_google_count === "number"
                          ? data.applied_to_google_count
                          : data.repaired.filter((r) => r.applied_to_google).length;
                      const sampleErr = data.errors[0]?.error;
                      if (applied > 0 && data.error_count > 0) {
                        toast.message(
                          fill(t("pages.dpilot.google.cm.campaigns.repairPartial"), {
                            applied,
                            failed: data.error_count,
                            detail: sampleErr ? ` — ${sampleErr}` : "",
                          }),
                        );
                      } else if (applied > 0) {
                        toast.success(fill(t("pages.dpilot.google.cm.campaigns.repairSuccess"), { n: applied }));
                      } else if (data.error_count > 0) {
                        toast.error(
                          toastGoogleAdsError(sampleErr || t("pages.dpilot.google.cm.campaigns.repairCouldNotApply")),
                        );
                      } else if (data.repaired_count === 0) {
                        toast.message(t("pages.dpilot.google.cm.campaigns.repairNothingNeeded"));
                      } else {
                        toast.error(t("pages.dpilot.google.cm.campaigns.repairLocalOnly"));
                      }
                      await load();
                    } finally {
                      setRepairingUrls(false);
                    }
                  })();
                }}
              >
                {repairingUrls ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                {t("pages.dpilot.google.cm.campaigns.repairFinalUrls")}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {funnelRiskCount > 0 ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle className="text-sm">
            {fill(t("pages.dpilot.google.cm.campaigns.funnelRiskTitle"), { n: funnelRiskCount })}
          </AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            {t("pages.dpilot.google.cm.campaigns.funnelRiskBody")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: "on_google" as const,
                  label: fill(t("pages.dpilot.google.cm.campaigns.chipOnGoogle"), { n: chipCounts.on_google }),
                },
                {
                  id: "local_drafts" as const,
                  label: fill(t("pages.dpilot.google.cm.campaigns.chipLocal"), { n: chipCounts.local_drafts }),
                },
                {
                  id: "live" as const,
                  label: fill(t("pages.dpilot.google.cm.campaigns.chipActive"), { n: chipCounts.live }),
                },
                {
                  id: "paused" as const,
                  label: fill(t("pages.dpilot.google.cm.campaigns.chipPaused"), { n: chipCounts.paused }),
                },
                ...(funnelRiskCount > 0
                  ? [
                      {
                        id: "funnel_risk" as const,
                        label: fill(t("pages.dpilot.google.cm.campaigns.chipFunnelRisk"), { n: funnelRiskCount }),
                      },
                    ]
                  : []),
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSt(chip.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  st === chip.id
                    ? chip.id === "funnel_risk"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-[#1a73e8] text-white"
                    : chip.id === "funnel_risk"
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-[220px] pl-8"
                placeholder={t("pages.dpilot.google.cm.campaigns.searchPlaceholder")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          {loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : filtered.length === 0 ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {!paidConnected
                  ? t("pages.dpilot.google.cm.campaigns.emptySyncFirst")
                  : st === "funnel_risk"
                    ? t("pages.dpilot.google.cm.campaigns.emptyFunnelRisk")
                    : st === "on_google" || st === "live" || st === "paused"
                      ? t("pages.dpilot.google.cm.campaigns.emptyOnGoogleFilter")
                      : st === "local_drafts"
                        ? t("pages.dpilot.google.cm.campaigns.emptyLocalDrafts")
                        : t("pages.dpilot.google.cm.campaigns.emptyFilter")}
              </p>
              {paidConnected && (st === "on_google" || st === "live") && chipCounts.on_google === 0 ? (
                <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
                  {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("pages.dpilot.google.cm.common.resyncImport")}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">{t("pages.dpilot.google.cm.campaigns.colActive")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.impressionsShort")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.clicks")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.ctr")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.cpc")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.cost")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.conversionsShort")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.cpa")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.capture")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.budgetPerDayShort")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const m = c.metrics;
                    const busy = busyId === c.id;
                    const urlAudit = urlAuditById.get(c.id);
                    const serving = effectiveCampaignServingStatus(c);
                    const pendingN = pendingByCampaign.get(c.id) ?? 0;
                    const localDraftLinked =
                      Boolean(c.external_campaign_id) &&
                      (c.local_status === "draft" || c.local_status === "pending_publish") &&
                      (serving === "live" || serving === "paused");
                    const canToggle =
                      Boolean(c.external_campaign_id) &&
                      (serving === "live" || serving === "paused");
                    const captureTitle =
                      c.google_clicks != null
                        ? fill(t("pages.dpilot.google.cm.campaigns.captureTitle"), {
                            tracking: fmtNum(c.tracking_clicks),
                            google: fmtNum(c.google_clicks),
                            delta: c.click_delta != null ? ` · Δ ${c.click_delta}` : "",
                          })
                        : t("pages.dpilot.google.cm.campaigns.noGoogleClicksPeriod");
                    return (
                      <TableRow key={c.id} className={c.funnel_risk ? "bg-destructive/[0.03]" : undefined}>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            {canToggle ? (
                              <Switch
                                checked={serving === "live"}
                                disabled={busy}
                                aria-label={
                                  serving === "live"
                                    ? t("pages.dpilot.google.cm.campaigns.pauseCampaignAria")
                                    : t("pages.dpilot.google.cm.campaigns.resumeCampaignAria")
                                }
                                onCheckedChange={(on) =>
                                  void studioAction(c.id, on ? "resume_campaign" : "pause_campaign")
                                }
                              />
                            ) : null}
                            <Badge
                              variant="outline"
                              className={cn("font-normal text-[10px]", campaignStatusBadgeClass(serving))}
                              title={
                                c.google_status
                                  ? fill(t("pages.dpilot.google.cm.common.googleStatusTitle"), {
                                      status: c.google_status,
                                    })
                                  : c.external_campaign_id
                                    ? t("pages.dpilot.google.cm.common.localStatusNoNetwork")
                                    : t("pages.dpilot.google.cm.common.onlyInProject")
                              }
                            >
                              {campaignStatusLabel(serving, t)}
                            </Badge>
                            {localDraftLinked ? (
                              <span className="text-[10px] leading-tight text-amber-800">
                                {t("pages.dpilot.google.cm.common.localDraft")}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[16rem]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              to={`/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`}
                              className="font-medium text-[#1a73e8] hover:underline line-clamp-2"
                            >
                              {c.name}
                            </Link>
                            {!c.external_campaign_id ? (
                              <Badge variant="secondary" className="font-normal text-[10px]">
                                {t("pages.dpilot.google.cm.common.localOnly")}
                              </Badge>
                            ) : null}
                            {pendingN > 0 ? (
                              <Link
                                to={`/tracking/dpilot/p/${projectId}/google/aprovacoes?campaign=${c.id}`}
                                className="inline-flex"
                                title={t("pages.dpilot.google.cm.common.queuePendingTitle")}
                                aria-label={fill(t("pages.dpilot.google.cm.common.queuePendingAria"), { n: pendingN })}
                              >
                                <Badge variant="secondary" className="h-5 font-normal text-[10px] hover:bg-secondary/80">
                                  {fill(t("pages.dpilot.google.cm.common.queueBadge"), { n: pendingN })}
                                </Badge>
                              </Link>
                            ) : null}
                          </div>
                          {c.bidding_strategy ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {googleBiddingStrategyLabel(c.bidding_strategy, t)}
                            </p>
                          ) : null}
                          {urlAudit && urlAudit.severity !== "ok" ? (
                            <p
                              className="mt-0.5 line-clamp-2 text-[10px] text-amber-800 dark:text-amber-200"
                              title={[
                                ...(urlAudit.issue_labels ?? []),
                                urlAudit.sample_url ? `URL: ${urlAudit.sample_url}` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            >
                              Final URL{" "}
                              {urlAudit.severity === "critical"
                                ? t("pages.dpilot.google.cm.campaigns.finalUrlCritical")
                                : t("pages.dpilot.google.cm.campaigns.finalUrlWarn")}
                              {urlAudit.issue_labels?.[0] ? ` · ${urlAudit.issue_labels[0]}` : ""}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m ? fmtNum(m.impressions) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m ? fmtNum(m.clicks) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m ? fmtPct(m.ctr) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m ? formatUsdFromMicros(m.average_cpc_micros) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m ? formatUsdFromMicros(m.cost_micros) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m ? fmtNum(m.conversions, 1) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m ? formatUsdFromMicros(m.cost_per_conversion_micros) : "—"}
                        </TableCell>
                        <TableCell>
                          {c.funnel_risk ? (
                            <div title={captureTitle}>
                              <Badge
                                variant="outline"
                                className="border-destructive/50 font-normal text-destructive"
                              >
                                {c.click_capture_ratio != null
                                  ? `${(c.click_capture_ratio * 100).toFixed(0)}%`
                                  : t("pages.dpilot.google.cm.common.risk")}
                              </Badge>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {fmtNum(c.tracking_clicks)}/{fmtNum(c.google_clicks)}
                              </p>
                            </div>
                          ) : c.click_capture_ratio != null ? (
                            <div title={captureTitle}>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {(c.click_capture_ratio * 100).toFixed(0)}%
                              </span>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {fmtNum(c.tracking_clicks)}/{fmtNum(c.google_clicks)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            className="text-right hover:underline disabled:no-underline"
                            disabled={busy || !c.external_campaign_id || c.budget_editable === false}
                            title={
                              !c.external_campaign_id
                                ? t("pages.dpilot.google.cm.campaigns.draftBudgetLocked")
                                : c.budget_editable === false
                                  ? fill(t("pages.dpilot.google.cm.campaigns.sharedBudgetConsole"), {
                                      n: c.budget_reference_count ?? 0,
                                    })
                                  : t("pages.dpilot.google.cm.common.changeDailyBudgetGoogle")
                            }
                            onClick={() =>
                              onBudget(c.id, c.daily_budget_micros, {
                                budget_editable: c.budget_editable,
                                budget_reference_count: c.budget_reference_count,
                              })
                            }
                          >
                            <span className="tabular-nums">
                              {c.daily_budget_micros != null
                                ? formatUsdFromMicros(c.daily_budget_micros)
                                : "—"}
                            </span>
                            {c.budget_shared ? (
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                {fill(t("pages.dpilot.google.cm.common.sharedBudgetCount"), {
                                  n: c.budget_reference_count ?? 0,
                                })}
                              </span>
                            ) : null}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-nowrap items-center justify-end gap-1">
                            {c.external_campaign_id ? (
                              <Button
                                type="button"
                                variant={termsCampaignId === c.id ? "default" : "outline"}
                                size="sm"
                                className="h-8 gap-1 px-2"
                                disabled={busy}
                                aria-label={fill(t("pages.dpilot.google.cm.campaigns.termsToast"), { name: c.name })}
                                title={t("pages.dpilot.google.cm.campaigns.termsTitle")}
                                onClick={() => openSearchTerms(c.id, c.name)}
                              >
                                <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span className="hidden sm:inline text-xs">{t("pages.dpilot.google.cm.campaigns.termsBtn")}</span>
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2"
                              disabled={busy || c.local_status === "archived"}
                              aria-label={`Duplicar · ${c.name}`}
                              title={t("pages.dpilot.google.cm.campaigns.duplicateTitle")}
                              onClick={() => onDuplicate(c.id, c.name, c.daily_budget_micros)}
                            >
                              <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="hidden sm:inline text-xs">{t("pages.dpilot.google.cm.campaigns.duplicate")}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {termsCampaignId ? (
        <Card
          ref={termsPanelRef}
          id="campanhas-termos-painel"
          tabIndex={-1}
          className="mt-4 scroll-mt-4 border-[#1a73e8]/40 shadow-sm outline-none ring-2 ring-[#1a73e8]/25"
        >
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">{t("pages.dpilot.google.cm.campaigns.termsTitle")}</CardTitle>
              <CardDescription>
                {rows.find((r) => r.id === termsCampaignId)?.name ||
                  t("pages.dpilot.google.cm.campaigns.termsPanelSelected")}
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTermsCampaignId(null)}>
              {t("pages.dpilot.google.cm.common.close")}
            </Button>
          </CardHeader>
          <CardContent>
            <DpilotGoogleSearchTermsPanel
              projectId={projectId}
              campaignId={termsCampaignId}
              campaignName={rows.find((r) => r.id === termsCampaignId)?.name}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t("pages.dpilot.google.cm.campaigns.termsTip")}</p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t("pages.dpilot.google.cm.campaigns.importTitle")}</CardTitle>
          <CardDescription>{t("pages.dpilot.google.cm.campaigns.importDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DpilotGoogleImportPanel
            projectId={projectId}
            onImported={() => {
              reload();
              void load();
            }}
          />
        </CardContent>
      </Card>

      <GoogleAdsBudgetDialog
        open={budgetDialog != null}
        onOpenChange={(open) => {
          if (!open) setBudgetDialog(null);
        }}
        currentUsd={budgetDialog?.currentUsd ?? null}
        busy={budgetDialog != null && busyId === budgetDialog.campaignId}
        onConfirm={confirmBudget}
      />
      <GoogleAdsDuplicateDialog
        open={dupDialog != null}
        onOpenChange={(open) => {
          if (!open) setDupDialog(null);
        }}
        sourceName={dupDialog?.name ?? ""}
        currentBudgetUsd={dupDialog?.currentUsd ?? null}
        busy={dupDialog != null && busyId === dupDialog.campaignId}
        onConfirm={confirmDuplicate}
      />
      </div>
    </Gate>
  );
}


function InventoryTablePage({
  title,
  description,
  kind,
}: {
  title: string;
  description: string;
  kind: "ad_groups" | "ads" | "keywords" | "budgets";
}) {
  const { t } = useAppLocale();
  const { projectId } = useDpilotPaid();
  const { campaignFilter, setCampaignFilter, ensureCampaignFilterValid } = useGoogleManagerPrefs(projectId);
  const [loading, setLoading] = useState(true);
  const [inv, setInv] = useState<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsInventory>>["data"]>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error } = await paidAdsService.getGoogleAdsInventory(projectId);
      if (error) toast.error(toastGoogleAdsError(error));
      else setInv(data ?? null);
      setLoading(false);
    })();
  }, [projectId]);

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    const list = (inv?.[kind] as Array<Record<string, unknown>> | undefined) ?? [];
    for (const r of list) {
      const id = String(r.campaign_id ?? "").trim();
      const name = String(r.campaign_name ?? "").trim();
      if (id) map.set(id, name || id);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inv, kind]);

  useEffect(() => {
    if (campaignOptions.length === 0) return;
    ensureCampaignFilterValid(campaignOptions.map((c) => c.id));
  }, [campaignOptions, ensureCampaignFilterValid]);

  const rows = useMemo(() => {
    let list = (inv?.[kind] as Array<Record<string, unknown>> | undefined) ?? [];
    if (campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS) {
      list = list.filter((r) => String(r.campaign_id ?? "") === campaignFilter);
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
  }, [inv, kind, q, campaignFilter]);

  const emptySuffix =
    campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS
      ? t("pages.dpilot.google.cm.common.emptyInCampaignSuffix")
      : "";

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={title}
        description={<p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">{description}</p>}
        actions={
          <Button asChild variant="outline">
            <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
              {t("pages.dpilot.google.cm.common.viewCampaigns")}
            </Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[220px]" aria-label={t("pages.dpilot.google.cm.common.filterByCampaignAria")}>
                <SelectValue placeholder={t("pages.dpilot.google.cm.common.campaign")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GOOGLE_MANAGER_ALL_CAMPAIGNS}>
                  {t("pages.dpilot.google.cm.common.allCampaigns")}
                </SelectItem>
                {campaignOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t("pages.dpilot.google.cm.common.filterPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {fill(t("pages.dpilot.google.cm.adGroups.empty"), { scope: emptySuffix })}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {kind === "ad_groups" && (
                      <>
                        <TableHead>{t("pages.dpilot.google.cm.adGroups.colGroup")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.adGroups.colKw")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.adGroups.colAds")}</TableHead>
                        <TableHead />
                      </>
                    )}
                    {kind === "ads" && (
                      <>
                        <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.adGroup")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.ads.colRsas")}</TableHead>
                        <TableHead />
                      </>
                    )}
                    {kind === "keywords" && (
                      <>
                        <TableHead>{t("pages.dpilot.google.cm.common.keyword")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.match")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.adGroup")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                        <TableHead />
                      </>
                    )}
                    {kind === "budgets" && (
                      <>
                        <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                        <TableHead>{t("pages.dpilot.google.cm.common.budgetPerDay")}</TableHead>
                        <TableHead>Google ID</TableHead>
                        <TableHead />
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const cid = String(r.campaign_id ?? "");
                    const manage = (
                      <Button size="sm" variant="secondary" className="h-8" asChild>
                        <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${cid}/google`}>
                          {t("pages.dpilot.google.cm.common.manage")}
                        </Link>
                      </Button>
                    );
                    if (kind === "ad_groups") {
                      return (
                        <TableRow key={String(r.id)}>
                          <TableCell className="font-medium">{String(r.name)}</TableCell>
                          <TableCell>{String(r.campaign_name)}</TableCell>
                          <TableCell>{campaignStatusLabel(String(r.status), t)}</TableCell>
                          <TableCell>{String(r.keywords_count)}</TableCell>
                          <TableCell>{String(r.ads_count)}</TableCell>
                          <TableCell className="text-right">{manage}</TableCell>
                        </TableRow>
                      );
                    }
                    if (kind === "ads") {
                      const heads = Array.isArray(r.headlines) ? (r.headlines as string[]).slice(0, 3).join(" · ") : "—";
                      return (
                        <TableRow key={String(r.id)}>
                          <TableCell>{String(r.campaign_name)}</TableCell>
                          <TableCell>{String(r.ad_group_name)}</TableCell>
                          <TableCell>{campaignStatusLabel(String(r.status), t)}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{heads}</TableCell>
                          <TableCell className="text-right">{manage}</TableCell>
                        </TableRow>
                      );
                    }
                    if (kind === "keywords") {
                      return (
                        <TableRow key={String(r.id)}>
                          <TableCell className="font-medium">{String(r.text)}</TableCell>
                          <TableCell>{String(r.match_type)}</TableCell>
                          <TableCell>{String(r.campaign_name)}</TableCell>
                          <TableCell>{String(r.ad_group_name)}</TableCell>
                          <TableCell>{campaignStatusLabel(String(r.status), t)}</TableCell>
                          <TableCell className="text-right">{manage}</TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={cid}>
                        <TableCell className="font-medium">{String(r.campaign_name)}</TableCell>
                        <TableCell>{campaignStatusLabel(String(r.local_status), t)}</TableCell>
                        <TableCell>
                          {r.daily_budget_micros != null
                            ? formatUsdFromMicros(Number(r.daily_budget_micros))
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{String(r.external_campaign_id ?? "—")}</TableCell>
                        <TableCell className="text-right">{manage}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {kind === "keywords" && inv?.negative_keywords ? (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">{t("pages.dpilot.google.cm.keywords.negativesTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {fill(t("pages.dpilot.google.cm.keywords.negativesHint"), {
                  campaign: inv.negative_keywords.campaign_level.length,
                  adGroup: inv.negative_keywords.ad_group_level.length,
                })}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}

export function DpilotGoogleAdGroupsPage() {
  const { t } = useAppLocale();
  return (
    <InventoryTablePage
      title={t("pages.dpilot.google.cm.adGroups.title")}
      description={t("pages.dpilot.google.cm.adGroups.description")}
      kind="ad_groups"
    />
  );
}

export function DpilotGoogleAdsCreativesPage() {
  const { t } = useAppLocale();
  const { projectId } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsRsaPolicyAudit>>["data"]>["campaigns"]
  >([]);
  const [totals, setTotals] = useState<{
    campaigns: number;
    disapproved_ads: number;
    limited_ads: number;
    critical_campaigns: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsRsaPolicyAudit(projectId);
    if (error) {
      setErr(error);
      setRows([]);
      setTotals(null);
      setNote(null);
    } else {
      setRows(data?.campaigns ?? []);
      setTotals(data?.totals ?? null);
      setNote(data?.note ?? null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.ads.title")}
        description={
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("pages.dpilot.google.cm.ads.description")}
          </p>
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        }
      />

      {totals ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.ads.kpiCampaigns")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{totals.campaigns}</p>
            </CardContent>
          </Card>
          <Card className={totals.disapproved_ads > 0 ? "border-destructive/30" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.ads.kpiDisapproved")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{totals.disapproved_ads}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.ads.kpiLimited")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{totals.limited_ads}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {err ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>{t("pages.dpilot.google.cm.common.apiErrorTitle")}</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
      {note ? (
        <Alert className="mt-4">
          <AlertTitle className="text-sm">{t("pages.dpilot.google.cm.ads.noNetworkTitle")}</AlertTitle>
          <AlertDescription className="text-xs">{note}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t("pages.dpilot.google.cm.ads.byCampaignTitle")}</CardTitle>
          <CardDescription>{t("pages.dpilot.google.cm.ads.byCampaignDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.ads.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.ads.colRsas")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.ads.colDisapproved")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.ads.colLimited")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.ads.colTopics")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.campaign_id}>
                    <TableCell className="max-w-[14rem] font-medium">
                      <span className="line-clamp-2">{r.campaign_name}</span>
                    </TableCell>
                    <TableCell>{r.ads_checked}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.disapproved_count > 0
                            ? "border-destructive/50 font-normal text-destructive"
                            : "font-normal"
                        }
                      >
                        {r.disapproved_count}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.limited_count}</TableCell>
                    <TableCell className="max-w-[12rem] text-[11px] text-muted-foreground">
                      <span className="line-clamp-2">{r.topics.join(" · ") || "—"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" className="h-8" asChild>
                        <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${r.campaign_id}/google`}>
                          {t("pages.dpilot.google.cm.common.studio")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("pages.dpilot.google.cm.ads.footerHint")}{" "}
        <Link className="text-[#1a73e8] hover:underline" to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
          {t("pages.dpilot.google.cm.ads.studioLink")}
        </Link>
        .
      </p>
      </div>
    </Gate>
  );
}

export function DpilotGoogleKeywordsPage() {
  const { t } = useAppLocale();
  const { projectId, reload } = useDpilotPaid();
  const { preset, setPreset, campaignFilter, setCampaignFilter, ensureCampaignFilterValid } =
    useGoogleManagerPrefs(projectId);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsKeywordMetrics>>["data"]>["keywords"]
  >([]);
  const [campaignOptions, setCampaignOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [q, setQ] = useState("");
  const [connErr, setConnErr] = useState<string | null>(null);
  const [kwSource, setKwSource] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await paidAdsService.getGoogleAdsKeywordMetrics(projectId, {
      preset,
      ...(campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS ? { campaign_id: campaignFilter } : {}),
    });
    if (error) {
      toast.error(toastGoogleAdsError(error));
      setConnErr(toastGoogleAdsError(error));
    } else {
      const kws = data?.keywords ?? [];
      setRows(kws);
      setConnErr(data?.connection_error ?? null);
      setKwSource(data?.source ?? "");
      const fromApi = (data as { campaigns?: Array<{ id: string; name: string }> } | undefined)?.campaigns;
      if (fromApi && fromApi.length > 0) {
        setCampaignOptions(
          [...fromApi].sort((a, b) => a.name.localeCompare(b.name)),
        );
      } else {
        const map = new Map<string, string>();
        for (const k of kws) {
          if (k.campaign_id) map.set(k.campaign_id, k.campaign_name || k.campaign_id);
        }
        setCampaignOptions((prev) => {
          if (campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS && prev.length > 0) return prev;
          return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
        });
      }
    }
    setLoading(false);
  }, [projectId, preset, campaignFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (campaignOptions.length === 0) return;
    ensureCampaignFilterValid(campaignOptions.map((c) => c.id));
  }, [campaignOptions, ensureCampaignFilterValid]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (k) =>
        k.text.toLowerCase().includes(needle) ||
        k.campaign_name.toLowerCase().includes(needle) ||
        k.ad_group_name.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const pauseKw = async (campaignId: string, keywordId: string) => {
    if (!window.confirm(t("pages.dpilot.google.cm.keywords.pauseConfirm"))) return;
    setBusyId(keywordId);
    const { data, error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, {
      action: "pause_keyword",
      keyword_id: keywordId,
    });
    setBusyId(null);
    if (error) toast.error(error);
    else {
      const info = describeStudioChangeRequestStatus(data?.change_request?.status, t);
      if (info.kind === "failed") toast.error(info.message);
      else if (info.kind === "applied") toast.success(t("pages.dpilot.google.cm.keywords.pauseSuccess"));
      else toast.message(info.message);
      reload();
      void load();
    }
  };

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.keywords.title")}
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {kwSource === "google_ads_api"
              ? t("pages.dpilot.google.cm.keywords.descNetwork")
              : t("pages.dpilot.google.cm.keywords.descLocal")}
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[220px]" aria-label={t("pages.dpilot.google.cm.common.filterByCampaignAria")}>
                <SelectValue placeholder={t("pages.dpilot.google.cm.common.campaign")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GOOGLE_MANAGER_ALL_CAMPAIGNS}>
                  {t("pages.dpilot.google.cm.common.allCampaigns")}
                </SelectItem>
                {campaignOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PeriodSelect value={preset} onChange={setPreset} />
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        }
      />
      {connErr ? (
        <Alert className="mt-4">
          <AlertTitle>{t("pages.dpilot.google.cm.keywords.networkUnavailable")}</AlertTitle>
          <AlertDescription>{connErr}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <Input
            className="max-w-sm"
            placeholder={t("pages.dpilot.google.cm.keywords.filterPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : filtered.length === 0 ? (
            <div className="space-y-2 py-1">
              <p className="text-sm text-muted-foreground">
                {q.trim()
                  ? t("pages.dpilot.google.cm.keywords.emptyFilter")
                  : campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS
                    ? t("pages.dpilot.google.cm.keywords.emptyCampaign")
                    : t("pages.dpilot.google.cm.keywords.emptyProject")}
              </p>
              {!q.trim() ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("pages.dpilot.google.cm.keywords.emptyHint")}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pages.dpilot.google.cm.common.keywordPt")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.match")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.cost")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.clicks")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.conversionsShort")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.cpa")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((k) => {
                    const m = k.metrics;
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium max-w-[12rem]">
                          <span className="line-clamp-2">{k.text}</span>
                        </TableCell>
                        <TableCell>{k.match_type}</TableCell>
                        <TableCell className="text-xs">{k.campaign_name}</TableCell>
                        <TableCell>{m ? formatUsdFromMicros(m.cost_micros) : "—"}</TableCell>
                        <TableCell>{m ? fmtNum(m.clicks) : "—"}</TableCell>
                        <TableCell>{m ? fmtNum(m.conversions, 1) : "—"}</TableCell>
                        <TableCell>{m ? formatUsdFromMicros(m.cost_per_conversion_micros) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {campaignStatusLabel(k.status, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="sm" variant="secondary" className="h-8" asChild>
                              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${k.campaign_id}/google`}>
                                {t("pages.dpilot.google.cm.common.manage")}
                              </Link>
                            </Button>
                            {k.external_criterion_id && k.status !== "paused" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={busyId === k.id}
                                onClick={() => void pauseKw(k.campaign_id, k.id)}
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}

export function DpilotGoogleBudgetsPage() {
  const { t } = useAppLocale();
  const { projectId, reload } = useDpilotPaid();
  const { preset, setPreset } = useGoogleManagerPrefs(projectId);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [budgetDialog, setBudgetDialog] = useState<{
    campaignId: string;
    currentUsd: number | null;
  } | null>(null);
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsCampaignsMetrics>>["data"]>["campaigns"]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset });
    if (error) toast.error(error);
    else setRows((data?.campaigns ?? []).filter((c) => c.local_status !== "archived"));
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const onBudget = (
    campaignId: string,
    currentMicros: number | null,
    meta?: { budget_editable?: boolean; budget_reference_count?: number },
  ) => {
    if (meta?.budget_editable === false) {
      toast.error(
        fill(t("pages.dpilot.google.cm.common.sharedBudgetBlockedShort"), {
          n: meta.budget_reference_count ?? t("pages.dpilot.google.cm.common.sharedBudgetSeveral"),
        }),
      );
      return;
    }
    setBudgetDialog({
      campaignId,
      currentUsd: currentMicros != null ? currentMicros / 1e6 : null,
    });
  };

  const confirmBudget = async (usd: number) => {
    if (!budgetDialog) return;
    const campaignId = budgetDialog.campaignId;
    setBusyId(campaignId);
    const { data, error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, {
      action: "update_budget_usd",
      daily_budget_usd: usd,
    });
    setBusyId(null);
    if (error) toast.error(error);
    else {
      const info = describeStudioChangeRequestStatus(data?.change_request?.status, t);
      if (info.kind === "failed") toast.error(info.message);
      else if (info.kind === "applied") {
        toast.success(fill(t("pages.dpilot.google.cm.common.budgetApplied"), { usd: usd.toFixed(2) }));
      } else toast.message(fill(t("pages.dpilot.google.cm.common.budgetQueued"), { usd: usd.toFixed(2), msg: info.message }));
      setBudgetDialog(null);
      reload();
      void load();
    }
  };

  const periodLabel = googleManagerPresetLabel(preset, t);

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.budgets.title")}
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {t("pages.dpilot.google.cm.budgets.description")}
          </p>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.budgets.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.budgetPerDay")}</TableHead>
                  <TableHead>{fill(t("pages.dpilot.google.cm.budgets.colCostPeriod"), { period: periodLabel })}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium max-w-[14rem]">
                      <span className="line-clamp-2">{c.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          campaignStatusBadgeClass(effectiveCampaignServingStatus(c)),
                        )}
                        title={
                          c.google_status
                            ? fill(t("pages.dpilot.google.cm.common.googleStatusTitle"), { status: c.google_status })
                            : c.external_campaign_id
                              ? t("pages.dpilot.google.cm.common.localStatusNoNetwork")
                              : t("pages.dpilot.google.cm.common.onlyInProject")
                        }
                      >
                        {campaignStatusLabel(effectiveCampaignServingStatus(c), t)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span>
                          {c.daily_budget_micros != null ? formatUsdFromMicros(c.daily_budget_micros) : "—"}
                        </span>
                        {c.budget_shared ? (
                          <Badge
                            variant="outline"
                            className={
                              c.budget_editable
                                ? "block w-fit font-normal text-[10px]"
                                : "block w-fit border-amber-500/50 font-normal text-[10px] text-amber-800 dark:text-amber-200"
                            }
                          >
                            {fill(t("pages.dpilot.google.cm.budgets.sharedTitle"), {
                              n: c.budget_reference_count ?? 0,
                            })}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.metrics ? formatUsdFromMicros(c.metrics.cost_micros) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" className="h-8" asChild>
                          <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`}>
                            {t("pages.dpilot.google.cm.common.manage")}
                          </Link>
                        </Button>
                        {c.external_campaign_id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={busyId === c.id || c.budget_editable === false}
                            title={
                              c.budget_editable === false
                                ? fill(t("pages.dpilot.google.cm.budgets.sharedTitle"), {
                                    n: c.budget_reference_count ?? 0,
                                  })
                                : t("pages.dpilot.google.cm.common.changeBudget")
                            }
                            onClick={() =>
                              onBudget(c.id, c.daily_budget_micros, {
                                budget_editable: c.budget_editable,
                                budget_reference_count: c.budget_reference_count,
                              })
                            }
                          >
                            <Wallet className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <GoogleAdsBudgetDialog
        open={budgetDialog != null}
        onOpenChange={(open) => {
          if (!open) setBudgetDialog(null);
        }}
        currentUsd={budgetDialog?.currentUsd ?? null}
        busy={budgetDialog != null && busyId === budgetDialog.campaignId}
        onConfirm={confirmBudget}
      />
      </div>
    </Gate>
  );
}

export function DpilotGoogleConversionsPage() {
  const { t } = useAppLocale();
  const { projectId, overview, campaigns } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [bootBusy, setBootBusy] = useState(false);
  const [projectOnly, setProjectOnly] = useState(true);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof integrationsService.getGoogleAdsSettings>>["data"]>(
    null,
  );
  const [settingsErr, setSettingsErr] = useState(false);
  const [ledger, setLedger] = useState<
    NonNullable<Awaited<ReturnType<typeof analyticsService.getConversions>>["data"]>
  >([]);
  const [ledgerErr, setLedgerErr] = useState<string | null>(null);

  const paidCustomer = overview?.connection?.google_customer_id ?? null;
  const projectCampaignIds = useMemo(
    () => new Set(campaigns.filter((c) => c.platform === "google_ads").map((c) => c.id)),
    [campaigns],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setSettingsErr(false);
    setLedgerErr(null);
    const [settingsRes, ledgerRes] = await Promise.all([
      integrationsService.getGoogleAdsSettings(),
      analyticsService.getConversions({ limit: 40 }),
    ]);
    if (settingsRes.error) {
      setSettingsErr(true);
      setSettings(null);
    } else {
      setSettings(settingsRes.data ?? null);
    }
    if (ledgerRes.error) {
      setLedgerErr(ledgerRes.error);
      setLedger([]);
    } else {
      setLedger(ledgerRes.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const scopedLedger = useMemo(() => {
    if (!projectOnly) return ledger;
    const linked = ledger.filter(
      (r) => r.paid_ads_campaign_id && projectCampaignIds.has(r.paid_ads_campaign_id),
    );
    // Se nenhuma venda traz o UUID Paid, mostra a amostra completa (evita ledger vazio enganador).
    return linked.length > 0 ? linked : ledger;
  }, [ledger, projectOnly, projectCampaignIds]);

  const align = alignGoogleCustomers(paidCustomer, settings?.google_ads_customer_id);
  const funnel = conversionFunnelStatus({
    canUpload: settingsErr ? null : settings ? Boolean(settings.can_upload) : null,
    paidCustomerId: paidCustomer,
    uploadCustomerId: settings?.google_ads_customer_id,
  });
  const health = summarizeGoogleAdsSyncHealth(scopedLedger);
  const scopedApplied =
    projectOnly &&
    ledger.some((r) => r.paid_ads_campaign_id && projectCampaignIds.has(r.paid_ads_campaign_id));

  const statusBanner =
    funnel === "ready"
      ? {
          title: t("pages.dpilot.google.cm.conversions.readyTitle"),
          detail: t("pages.dpilot.google.cm.conversions.readyDetail"),
          variant: "default" as const,
        }
      : funnel === "customer_mismatch"
        ? {
            title: t("pages.dpilot.google.cm.conversions.mismatchTitle"),
            detail: t("pages.dpilot.google.cm.conversions.mismatchDetail"),
            variant: "destructive" as const,
          }
        : funnel === "settings_unknown"
          ? {
              title: t("pages.dpilot.google.cm.conversions.settingsUnknownTitle"),
              detail: t("pages.dpilot.google.cm.conversions.settingsUnknownDetail"),
              variant: "destructive" as const,
            }
          : {
              title: t("pages.dpilot.google.cm.conversions.incompleteTitle"),
              detail: t("pages.dpilot.google.cm.conversions.incompleteDetail"),
              variant: "default" as const,
            };

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.conversions.title")}
        description={
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("pages.dpilot.google.cm.conversions.description")}
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="sm" asChild>
              <Link to="/integracoes/google-ads">{t("pages.dpilot.google.cm.common.integrations")}</Link>
            </Button>
          </div>
        }
      />

      <Alert variant={statusBanner.variant} className="mt-4">
        <AlertTitle className="text-sm">{statusBanner.title}</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">{statusBanner.detail}</AlertDescription>
      </Alert>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.conversions.kpiUploadReady")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {settingsErr ? "?" : settings?.can_upload ? t("pages.dpilot.google.cm.common.yes") : t("pages.dpilot.google.cm.common.no")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.conversions.kpiAlignment")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {align === "match" ? t("pages.dpilot.google.cm.common.ok") : align === "mismatch" ? "≠" : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {align === "match"
                ? t("pages.dpilot.google.cm.conversions.alignSame")
                : align === "mismatch"
                  ? t("pages.dpilot.google.cm.conversions.alignMismatch")
                  : t("pages.dpilot.google.cm.conversions.alignMissing")}
            </p>
          </CardContent>
        </Card>
        <Card className={health.failed > 0 ? "border-destructive/30" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.conversions.kpiRecentSync")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {health.total ? `${health.ok}/${health.total}` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {health.failed
                ? fill(t("pages.dpilot.google.cm.conversions.syncFails"), { n: health.failed })
                : health.total
                  ? t("pages.dpilot.google.cm.conversions.syncNoFails")
                  : t("pages.dpilot.google.cm.conversions.syncNoSales")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.conversions.kpiNoGclid")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{health.total ? health.no_gclid : "—"}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("pages.dpilot.google.cm.conversions.kpiNoGclidHint")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("pages.dpilot.google.cm.conversions.uploadCardTitle")}</CardTitle>
            <CardDescription>{t("pages.dpilot.google.cm.conversions.uploadCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : settingsErr ? (
              <Alert variant="destructive">
                <AlertTitle className="text-sm">{t("pages.dpilot.google.cm.conversions.settingsReadFail")}</AlertTitle>
                <AlertDescription className="text-xs">{t("pages.dpilot.google.cm.conversions.settingsReadFailHint")}</AlertDescription>
              </Alert>
            ) : (
              <ul className="space-y-1.5 text-xs">
                <li>
                  {fill(t("pages.dpilot.google.cm.conversions.rowGoogleAccount"), {
                    state: settings?.has_refresh_token ? t("pages.dpilot.google.cm.conversions.linked") : t("pages.dpilot.google.cm.conversions.notLinked"),
                  })}
                </li>
                <li>{fill(t("pages.dpilot.google.cm.conversions.rowCustomerId"), { id: settings?.google_ads_customer_id || "—" })}</li>
                <li>
                  {fill(t("pages.dpilot.google.cm.conversions.rowConversionAction"), {
                    id: settings?.google_ads_conversion_action_id || "—",
                  })}
                </li>
                <li>
                  {fill(t("pages.dpilot.google.cm.conversions.rowApiEnv"), {
                    state: settings?.api_env_configured ? t("pages.dpilot.google.cm.conversions.apiEnvOk") : t("pages.dpilot.google.cm.conversions.apiEnvMissing"),
                  })}
                </li>
                <li>
                  {fill(t("pages.dpilot.google.cm.conversions.rowEnabled"), {
                    state: settings?.google_ads_enabled ? t("pages.dpilot.google.cm.conversions.enabledYes") : t("pages.dpilot.google.cm.conversions.enabledNo"),
                  })}
                </li>
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/integracoes/google-ads">{t("pages.dpilot.google.cm.conversions.configureBootstrap")}</Link>
              </Button>
              {!settings?.can_upload && !settingsErr ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={bootBusy}
                  onClick={async () => {
                    setBootBusy(true);
                    const { data, error } = await integrationsService.bootstrapGoogleAds();
                    setBootBusy(false);
                    if (error) toast.error(error);
                    else {
                      toast.success(data?.detail || t("pages.dpilot.google.cm.conversions.bootstrapDone"));
                      void reload();
                    }
                  }}
                >
                  {bootBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {t("pages.dpilot.google.cm.conversions.runBootstrap")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("pages.dpilot.google.cm.conversions.paidCardTitle")}</CardTitle>
            <CardDescription>{t("pages.dpilot.google.cm.conversions.paidCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-1.5 text-xs">
              <li>{fill(t("pages.dpilot.google.cm.conversions.paidCustomerId"), { id: paidCustomer || "—" })}</li>
              <li>
                {align === "match"
                  ? t("pages.dpilot.google.cm.conversions.alignIdeal")
                  : align === "mismatch"
                    ? t("pages.dpilot.google.cm.conversions.alignDifferent")
                    : t("pages.dpilot.google.cm.conversions.alignLinkBoth")}
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/google`}>{t("pages.dpilot.google.cm.conversions.paidLinks")}</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
                  {t("pages.dpilot.google.cm.conversions.metricsByCampaign")}
                </Link>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("pages.dpilot.google.cm.conversions.twoOauthNote")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-base">{t("pages.dpilot.google.cm.conversions.ledgerTitle")}</CardTitle>
              <CardDescription>
                {scopedApplied
                  ? t("pages.dpilot.google.cm.conversions.ledgerFiltered")
                  : t("pages.dpilot.google.cm.conversions.ledgerSample")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={projectOnly} onCheckedChange={(v) => setProjectOnly(v === true)} />
                {t("pages.dpilot.google.cm.conversions.projectOnly")}
              </label>
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <Link to="/resultados/relatorios/conversoes">{t("pages.dpilot.google.cm.conversions.reportsLink")}</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ledgerErr ? (
            <Alert variant="destructive">
              <AlertTitle className="text-sm">{t("pages.dpilot.google.cm.conversions.ledgerLoadFail")}</AlertTitle>
              <AlertDescription className="text-xs">{ledgerErr}</AlertDescription>
            </Alert>
          ) : loading ? (
            <Skeleton className="h-32 w-full" />
          ) : scopedLedger.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.conversions.ledgerEmpty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pages.dpilot.google.cm.common.when")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.conversions.colOrigin")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.conversions.colGclid")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.conversions.colSyncGoogle")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.error")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopedLedger.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-xs">
                        {row.origin || row.platform || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {row.has_gclid
                          ? row.gclid
                            ? `${row.gclid.slice(0, 12)}…`
                            : t("pages.dpilot.google.cm.conversions.gclidYes")
                          : t("pages.dpilot.google.cm.conversions.gclidNo")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.google_ads_sync === "failed" || row.google_ads_sync === "skipped_no_gclid"
                              ? "border-amber-500/50 font-normal text-amber-800 dark:text-amber-200"
                              : "font-normal"
                          }
                        >
                          {googleAdsSyncShortLabel(row.google_ads_sync, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate text-[11px] text-muted-foreground">
                        {row.google_ads_sync_error || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}

export function DpilotGoogleReportsPage() {
  const { t } = useAppLocale();
  const { projectId, campaigns } = useDpilotPaid();
  const { preset, setPreset, campaignFilter, setCampaignFilter, ensureCampaignFilterValid } =
    useGoogleManagerPrefs(projectId);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsDevicePerformance>>["data"]>["devices"]
  >([]);
  const [byCampaign, setByCampaign] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsDevicePerformance>>["data"]>["by_campaign"]
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const [scoped, setScoped] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsDevicePerformance(projectId, {
      preset,
      campaign_id: campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS ? campaignFilter : undefined,
    });
    if (error) {
      setErr(error);
      setDevices([]);
      setByCampaign([]);
    } else {
      setDevices(data?.devices ?? []);
      setByCampaign(data?.by_campaign ?? []);
      setScoped(data?.campaigns_scoped ?? 0);
    }
    setLoading(false);
  }, [projectId, preset, campaignFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const campaignOptions = useMemo(
    () =>
      campaigns
        .filter((c) => c.platform === "google_ads" && c.status !== "archived")
        .map((c) => [c.id, c.name] as const)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [campaigns],
  );

  useEffect(() => {
    if (campaignOptions.length === 0) return;
    ensureCampaignFilterValid(campaignOptions.map(([id]) => id));
  }, [campaignOptions, ensureCampaignFilterValid]);

  const mobileShare = useMemo(() => {
    const mobile = devices.find((d) => /MOBILE/i.test(d.device));
    const totalCost = devices.reduce((s, d) => s + d.metrics.cost_micros, 0);
    if (!mobile || totalCost <= 0) return null;
    return mobile.metrics.cost_micros / totalCost;
  }, [devices]);

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.reports.title")}
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {t("pages.dpilot.google.cm.reports.description")}
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[220px]" aria-label={t("pages.dpilot.google.cm.reports.campaignAria")}>
                <SelectValue placeholder={t("pages.dpilot.google.cm.common.campaign")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GOOGLE_MANAGER_ALL_CAMPAIGNS}>{t("pages.dpilot.google.cm.reports.allImported")}</SelectItem>
                {campaignOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>{t("pages.dpilot.google.cm.common.campaignsNav")}</Link>
            </Button>
          </div>
        }
      />
      {err ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>{t("pages.dpilot.google.cm.common.apiErrorTitle")}</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {mobileShare != null && mobileShare >= 0.55 ? (
        <Alert className="mt-4">
          <AlertTitle className="text-sm">
            {fill(t("pages.dpilot.google.cm.reports.mobileAlertTitle"), { pct: (mobileShare * 100).toFixed(0) })}
          </AlertTitle>
          <AlertDescription className="text-xs">{t("pages.dpilot.google.cm.reports.mobileAlertBody")}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t("pages.dpilot.google.cm.reports.byDeviceTitle")}</CardTitle>
          <CardDescription>
            {campaignFilter === GOOGLE_MANAGER_ALL_CAMPAIGNS
              ? t("pages.dpilot.google.cm.reports.byDeviceAll")
              : t("pages.dpilot.google.cm.reports.byDeviceOne")}
            {scoped ? fill(t("pages.dpilot.google.cm.reports.scopedSuffix"), { n: scoped }) : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.reports.emptyPeriod")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.dpilot.google.cm.reports.colDevice")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.impressionsShort")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.clicks")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.ctr")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.cost")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.conversionsShort")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.roas")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.device}>
                    <TableCell className="font-medium">{d.device.replace(/_/g, " ")}</TableCell>
                    <TableCell>{fmtNum(d.metrics.impressions)}</TableCell>
                    <TableCell>{fmtNum(d.metrics.clicks)}</TableCell>
                    <TableCell>{fmtPct(d.metrics.ctr)}</TableCell>
                    <TableCell>{formatUsdFromMicros(d.metrics.cost_micros)}</TableCell>
                    <TableCell>{fmtNum(d.metrics.conversions, 1)}</TableCell>
                    <TableCell>{fmtNum(d.metrics.roas, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t("pages.dpilot.google.cm.reports.byCampaignTitle")}</CardTitle>
          <CardDescription>{t("pages.dpilot.google.cm.reports.byCampaignDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : byCampaign.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.reports.emptyBreakdown")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.reports.colDevice")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.impressionsShort")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.clicks")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.ctr")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.cost")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.conversionsShort")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.cpa")}</TableHead>
                    <TableHead className="text-right">{t("pages.dpilot.google.cm.common.roas")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCampaign.map((r) => (
                    <TableRow key={`${r.campaign_id}-${r.device}`}>
                      <TableCell className="max-w-[14rem]">
                        <Link
                          className="line-clamp-2 text-sm font-medium text-[#1a73e8] hover:underline"
                          to={`/tracking/dpilot/p/${projectId}/campanhas/${r.campaign_id}/google`}
                        >
                          {r.campaign_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{r.device.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.metrics.impressions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.metrics.clicks)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(r.metrics.ctr)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUsdFromMicros(r.metrics.cost_micros)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(r.metrics.conversions, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUsdFromMicros(r.metrics.cost_per_conversion_micros)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.metrics.roas, 2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}

function googleCampaignIdFromResource(resource: string | null | undefined): string | null {
  if (!resource) return null;
  const m = /\/campaigns\/(\d+)\s*$/.exec(resource.trim());
  return m?.[1] ?? null;
}

export function DpilotGoogleRecommendationsPage() {
  const { t } = useAppLocale();
  const { projectId, campaigns } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [recs, setRecs] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsRecommendations>>["data"]>["recommendations"]
  >([]);
  const [err, setErr] = useState<string | null>(null);

  const nameByExternalId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) {
      const ext = c.external_campaign_id?.trim();
      if (ext) map.set(ext, c.name);
    }
    return map;
  }, [campaigns]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsRecommendations(projectId);
    if (error) setErr(error);
    else setRecs(data?.recommendations ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (resource_name: string, action: "apply" | "dismiss") => {
    const label =
      action === "apply"
        ? t("pages.dpilot.google.cm.recommendations.applyAction")
        : t("pages.dpilot.google.cm.recommendations.dismissAction");
    if (
      !window.confirm(fill(t("pages.dpilot.google.cm.recommendations.confirm"), { action: label }))
    ) {
      return;
    }
    setBusy(resource_name);
    const { error } = await paidAdsService.postGoogleAdsRecommendationAction(projectId, {
      resource_name,
      action,
    });
    setBusy(null);
    if (error) toast.error(error);
    else {
      toast.success(fill(t("pages.dpilot.google.cm.recommendations.done"), { action: label }));
      void load();
    }
  };

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.recommendations.title")}
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {t("pages.dpilot.google.cm.recommendations.description")}
          </p>
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t("pages.dpilot.google.cm.common.refresh")}
          </Button>
        }
      />
      {err ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>{t("pages.dpilot.google.cm.common.apiErrorTitle")}</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="mt-4">
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.recommendations.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.dpilot.google.cm.common.type")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.note")}</TableHead>
                  <TableHead className="text-right">{t("pages.dpilot.google.cm.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recs.map((r, i) => {
                  const extId = googleCampaignIdFromResource(r.campaign_resource);
                  const campName = extId ? nameByExternalId.get(extId) : null;
                  return (
                  <TableRow key={r.resource_name ?? String(i)}>
                    <TableCell className="font-medium">{r.type}</TableCell>
                    <TableCell className="max-w-[14rem]">
                      {campName ? (
                        <div className="space-y-0.5">
                          <p className="line-clamp-2 text-sm font-medium leading-snug">{campName}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{extId}</p>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                          {extId || r.campaign_resource || "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">{r.note}</TableCell>
                    <TableCell className="text-right">
                      {r.resource_name ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.apply_supported ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8"
                              disabled={busy === r.resource_name}
                              onClick={() => void act(r.resource_name!, "apply")}
                            >
                              {t("pages.dpilot.google.cm.recommendations.applyAction")}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={busy === r.resource_name}
                            onClick={() => void act(r.resource_name!, "dismiss")}
                          >
                            {t("pages.dpilot.google.cm.common.reject")}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}

export function DpilotGoogleAutomationsPage() {
  const { t } = useAppLocale();
  const { projectId, overview } = useDpilotPaid();
  const paidMode = overview?.project?.paid_mode ?? "copilot";
  const modeLabel = paidModeShortChip(paidMode, t);
  const gr = overview?.guardrails ?? {};
  const maxDailyMicros =
    typeof gr.max_daily_budget_micros === "number" && Number.isFinite(gr.max_daily_budget_micros)
      ? gr.max_daily_budget_micros
      : null;
  const maxMonthlyMicros =
    typeof gr.max_monthly_budget_micros === "number" && Number.isFinite(gr.max_monthly_budget_micros)
      ? gr.max_monthly_budget_micros
      : null;
  const countries = Array.isArray(gr.allowed_countries)
    ? gr.allowed_countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
    : [];

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.automations.title")}
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {fill(t("pages.dpilot.google.cm.automations.description"), { cmTitle: t("pages.dpilot.google.cm.title") })}
          </p>
        }
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/auditoria`}>{t("pages.dpilot.google.cm.automations.openAudit")}</Link>
          </Button>
        }
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("pages.dpilot.google.cm.automations.mode")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tracking-tight">{modeLabel}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {paidMode === "autopilot"
                ? t("pages.dpilot.google.cm.automations.modeAutopilotHint")
                : t("pages.dpilot.google.cm.automations.modeCopilotHint")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("pages.dpilot.google.cm.automations.dailyCap")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tracking-tight">
              {maxDailyMicros != null ? formatUsdFromMicros(maxDailyMicros) : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("pages.dpilot.google.cm.automations.dailyCapHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("pages.dpilot.google.cm.automations.monthlyCap")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tracking-tight">
              {maxMonthlyMicros != null ? formatUsdFromMicros(maxMonthlyMicros) : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("pages.dpilot.google.cm.automations.monthlyCapHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("pages.dpilot.google.cm.automations.countries")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tracking-tight">
              {countries.length > 0 ? countries.slice(0, 8).join(", ") : "—"}
              {countries.length > 8 ? ` +${countries.length - 8}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {fill(t("pages.dpilot.google.cm.automations.queuePending"), { n: overview?.pending_approvals ?? 0 })}
            </p>
          </CardContent>
        </Card>
      </div>
      <Alert className="mt-4">
        <AlertTitle>{t("pages.dpilot.google.cm.automations.noSecondMotorTitle")}</AlertTitle>
        <AlertDescription>{t("pages.dpilot.google.cm.automations.noSecondMotorBody")}</AlertDescription>
      </Alert>
      </div>
    </Gate>
  );
}

export function DpilotGoogleAiAssistantPage() {
  const { t } = useAppLocale();
  const { projectId, reload, overview } = useDpilotPaid();
  const { preset, setPreset } = useGoogleManagerPrefs(projectId);
  const paidMode = overview?.project?.paid_mode ?? "copilot";
  const modeChip = paidModeShortChip(paidMode, t);
  const [question, setQuestion] = useState(() => t("pages.dpilot.google.cm.assistant.qSpendMost"));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);
  const [out, setOut] = useState<Awaited<ReturnType<typeof paidAdsService.postGoogleAdsAiInsights>>["data"]>(null);

  const ask = async () => {
    setLoading(true);
    const { data, error } = await paidAdsService.postGoogleAdsAiInsights(projectId, { question, preset });
    setLoading(false);
    if (error) toast.error(error);
    else setOut(data ?? null);
  };

  const runSuggestion = async (s: {
    campaign_id?: string;
    suggested_op?: "pause_campaign" | "increase_budget_20";
    daily_budget_micros?: number | null;
    action: string;
  }) => {
    if (!s.campaign_id || !s.suggested_op) return;
    const modeHint = paidModeCanonicalLine(paidMode, t);
    if (
      !window.confirm(
        fill(t("pages.dpilot.google.cm.assistant.confirmContinue"), { action: s.action, modeHint }),
      )
    ) {
      return;
    }
    setBusy(s.campaign_id);
    if (s.suggested_op === "pause_campaign") {
      const { data, error } = await paidAdsService.postGoogleStudioActions(projectId, s.campaign_id, {
        action: "pause_campaign",
      });
      setBusy(null);
      if (error) toast.error(error);
      else {
        const info = describeStudioChangeRequestStatus(data?.change_request?.status, t);
        if (info.kind === "failed") toast.error(info.message);
        else if (info.kind === "applied") {
          setPendingCampaignId(null);
          toast.success(t("pages.dpilot.google.cm.common.campaignPausedToast"));
        } else {
          setPendingCampaignId(s.campaign_id);
          toast.message(info.message);
        }
        reload();
      }
      return;
    }
    const base = s.daily_budget_micros != null ? Number(s.daily_budget_micros) / 1e6 : 0;
    if (!(base > 0)) {
      setBusy(null);
      toast.error(t("pages.dpilot.google.cm.assistant.noBudgetForBump"));
      return;
    }
    const next = Math.round(base * 1.2 * 100) / 100;
    const { data, error } = await paidAdsService.postGoogleStudioActions(projectId, s.campaign_id, {
      action: "update_budget_usd",
      daily_budget_usd: next,
    });
    setBusy(null);
    if (error) toast.error(error);
    else {
      const info = describeStudioChangeRequestStatus(data?.change_request?.status, t);
      if (info.kind === "failed") toast.error(info.message);
      else if (info.kind === "applied") {
        setPendingCampaignId(null);
        toast.success(fill(t("pages.dpilot.google.cm.assistant.budgetBumpApplied"), { usd: next.toFixed(2) }));
      } else {
        setPendingCampaignId(s.campaign_id);
        toast.message(fill(t("pages.dpilot.google.cm.assistant.budgetBumpQueued"), { usd: next.toFixed(2), msg: info.message }));
      }
      reload();
    }
  };

  const quickQuestions = [
    t("pages.dpilot.google.cm.assistant.qSpendMost"),
    t("pages.dpilot.google.cm.assistant.qConvertBest"),
    t("pages.dpilot.google.cm.assistant.qPause"),
    t("pages.dpilot.google.cm.assistant.qMoreBudget"),
  ] as const;

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.assistant.title")}
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {t("pages.dpilot.google.cm.assistant.descriptionLead")}
            <span className="font-medium text-foreground">{modeChip}</span>
            {paidMode === "autopilot"
              ? t("pages.dpilot.google.cm.assistant.descAutopilot")
              : t("pages.dpilot.google.cm.assistant.descCopilot")}
          </p>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/google/aprovacoes`}>
              {t("pages.dpilot.google.cm.common.approvalsPt")}
            </Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          {pendingCampaignId ? (
            <Alert>
              <AlertTitle className="text-sm">{t("pages.dpilot.google.cm.assistant.queuedTitle")}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
                {t("pages.dpilot.google.cm.assistant.queuedBody")}
                <Button size="sm" className="h-7" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/aprovacoes?campaign=${pendingCampaignId}`}>
                    {t("pages.dpilot.google.cm.assistant.openQueue")}
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
          </div>
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((s) => (
              <Button key={s} type="button" size="sm" variant="outline" onClick={() => setQuestion(s)}>
                {s}
              </Button>
            ))}
          </div>
          <Button type="button" onClick={() => void ask()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {t("pages.dpilot.google.cm.assistant.analyze")}
          </Button>
          {out ? (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                {out.diagnosis}
              </p>
              <ul className="space-y-2 text-sm">
                {out.evidence.map((e) => (
                  <li key={`${e.label}-${e.campaign_id ?? ""}`}>
                    <span className="font-medium">{e.label}</span>
                    <span className="text-muted-foreground"> — {e.detail}</span>
                    {e.campaign_id ? (
                      <Button variant="link" className="h-auto px-1 text-xs" asChild>
                        <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${e.campaign_id}/google`}>
                          {t("pages.dpilot.google.cm.common.manage")}
                        </Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {out.suggestions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("pages.dpilot.google.cm.assistant.suggestionsTitle")}</p>
                  {out.suggestions.map((s, i) => (
                    <Alert key={i}>
                      <AlertTitle className="text-sm">{s.action}</AlertTitle>
                      <AlertDescription className="space-y-2 text-xs">
                        <p>
                          {fill(t("pages.dpilot.google.cm.assistant.suggestionMeta"), {
                            risk: s.risk,
                            evidence: s.evidence,
                          })}
                        </p>
                        {s.campaign_id && s.suggested_op ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy === s.campaign_id}
                            onClick={() => void runSuggestion(s)}
                          >
                            {busy === s.campaign_id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {t("pages.dpilot.google.cm.assistant.confirmSend")}
                          </Button>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground">{out.note}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}

export function DpilotGoogleHistoryPage() {
  const { t } = useAppLocale();
  const { projectId, changeRequests } = useDpilotPaid();
  const googleRelated = useMemo(
    () =>
      changeRequests.filter((c) => {
        const t = c.type || "";
        if (t.startsWith("meta_") || t.startsWith("tiktok_")) return false;
        return true;
      }),
    [changeRequests],
  );

  return (
    <Gate>
      <div data-no-i18n>
      <PageHeader
        title={t("pages.dpilot.google.cm.history.title")}
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {t("pages.dpilot.google.cm.history.description")}
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/aprovacoes`}>
                {t("pages.dpilot.google.cm.common.approvalsPt")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/auditoria`}>{t("pages.dpilot.google.cm.history.viewMotorAudit")}</Link>
            </Button>
          </div>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {googleRelated.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{t("pages.dpilot.google.cm.history.empty")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/aprovacoes`}>
                    {t("pages.dpilot.google.cm.history.openApprovals")}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/auditoria`}>
                    {t("pages.dpilot.google.cm.history.viewMotorAudit")}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pages.dpilot.google.cm.common.type")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.history.colSummary")}</TableHead>
                  <TableHead>{t("pages.dpilot.google.cm.common.when")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {googleRelated.slice(0, 80).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{changeRequestTypeLabel(c.type, t)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{changeRequestStatusLabel(c.status, t)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">
                      {summarizeChangeRequestPayload(c.payload).lines.join(" · ") || "—"}
                      {c.error_message ? (
                        <span className="mt-1 block text-destructive">{c.error_message}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}
