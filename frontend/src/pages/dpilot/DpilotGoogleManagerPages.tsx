/**
 * Hub de gestão Google Ads (Paid) — overview, inventário, orçamentos, recomendações, IA, histórico.
 * Dados via API oficial; sem métricas inventadas.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Bot,
  Copy,
  Download,
  Loader2,
  Pause,
  Play,
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
import { cn } from "@/lib/utils";
import {
  campaignStatusLabel,
  changeRequestStatusLabel,
  changeRequestTypeLabel,
  formatUsdFromMicros,
  friendlyGoogleAdsNetworkError,
  googleAdsNeedsReauth,
  summarizeChangeRequestPayload,
  toastGoogleAdsError,
} from "@/lib/paidAdsUi";
import {
  alignGoogleCustomers,
  conversionFunnelStatus,
  googleAdsSyncShortLabel,
  summarizeGoogleAdsSyncHealth,
  type ConversionFunnelStatus,
  type GoogleAdsSyncHealthSummary,
} from "@/lib/googleAdsConversionHealth";
import { analyticsService } from "@/services/analyticsService";
import { integrationsService } from "@/services/integrationsService";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { Gate } from "./DpilotPaidPages";
import { DpilotGoogleSearchTermsPanel } from "./DpilotGoogleSearchTermsPanel";
import { DpilotGoogleImportPanel } from "./DpilotGoogleImportPanel";

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7", label: "Últimos 7 dias" },
  { value: "last_30", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
] as const;

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function PeriodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]" aria-label="Período">
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
  );
}

function conversionCheckCopy(status: ConversionFunnelStatus): { ok: boolean; text: string } {
  if (status === "ready") return { ok: true, text: "Upload de conversões pronto (mesmo ciclo)" };
  if (status === "customer_mismatch") {
    return { ok: false, text: "Upload activo, mas customer ≠ conta Paid" };
  }
  if (status === "settings_unknown") return { ok: false, text: "Estado do upload desconhecido" };
  return { ok: false, text: "Configurar conversões (tracking)" };
}

export function DpilotGoogleOverviewPage() {
  const { projectId, reload, campaigns, changeRequests } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsManagerOverview>>["data"]>(null);
  const [err, setErr] = useState<string | null>(null);
  const [convStatus, setConvStatus] = useState<ConversionFunnelStatus>("settings_unknown");
  const [syncHealth, setSyncHealth] = useState<GoogleAdsSyncHealthSummary | null>(null);
  const [urlIssues, setUrlIssues] = useState<{ critical: number; warn: number } | null>(null);
  const [funnelRiskCamps, setFunnelRiskCamps] = useState(0);
  const [rsaCritical, setRsaCritical] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [{ data: d, error }, conv, ledger, urlAudit, campMetrics, rsaAudit] = await Promise.all([
      paidAdsService.getGoogleAdsManagerOverview(projectId, { preset }),
      integrationsService.getGoogleAdsSettings(),
      analyticsService.getConversions({ limit: 40 }),
      paidAdsService.getGoogleAdsFinalUrlAudit(projectId),
      paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset }),
      paidAdsService.getGoogleAdsRsaPolicyAudit(projectId),
    ]);
    if (error) setErr(error);
    else setData(d ?? null);

    const paidCustomer = d?.account?.customer_id ?? null;
    const canUpload = conv.error ? null : Boolean(conv.data?.can_upload);
    const uploadCustomer = conv.error ? null : conv.data?.google_ads_customer_id ?? null;
    setConvStatus(
      conversionFunnelStatus({
        canUpload,
        paidCustomerId: paidCustomer,
        uploadCustomerId: uploadCustomer,
      }),
    );
    setSyncHealth(ledger.error ? null : summarizeGoogleAdsSyncHealth(ledger.data ?? []));
    setUrlIssues(
      urlAudit.error || !urlAudit.data
        ? null
        : { critical: urlAudit.data.totals.critical, warn: urlAudit.data.totals.warn },
    );
    setFunnelRiskCamps(campMetrics.error ? 0 : campMetrics.data?.totals?.funnel_risk ?? 0);
    setRsaCritical(rsaAudit.error ? 0 : rsaAudit.data?.totals?.critical_campaigns ?? 0);
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const m = data?.metrics;
  const googleLive = campaigns.filter((c) => c.platform === "google_ads" && c.status === "live").length;
  const pendingCr = changeRequests.filter((c) => c.status === "pending").length;
  const convCopy = conversionCheckCopy(convStatus);

  const check = (ok: boolean, yes: string, no: string) => (
    <li className="flex items-start gap-2">
      <span
        className={
          ok
            ? "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
            : "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground"
        }
        aria-hidden
      >
        {ok ? "✓" : "·"}
      </span>
      <span className={ok ? "text-foreground/90" : "text-muted-foreground"}>{ok ? yes : no}</span>
    </li>
  );

  return (
    <Gate>
      <div className="relative overflow-hidden rounded-xl border border-[#1a73e8]/25 bg-gradient-to-br from-[#1a73e8]/12 via-background to-background">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#1a73e8]/10 blur-3xl"
          aria-hidden
        />
        <div className="relative p-5 sm:p-6">
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-2.5">
                Ads Studio
                <Badge className="border border-[#1a73e8]/30 bg-[#1a73e8]/15 font-normal text-[#1a73e8] hover:bg-[#1a73e8]/15">
                  Google Search
                </Badge>
              </span>
            }
            description={
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Operações do afiliado num só sítio: métricas da rede, termos de pesquisa, orçamento e conversões —
                sem depender do ads.google.com no dia-a-dia.
              </p>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <PeriodSelect value={preset} onChange={setPreset} />
                <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Atualizar
                </Button>
                <Button type="button" size="sm" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha</Link>
                </Button>
              </div>
            }
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-12">
        <Card className="border-[#1a73e8]/20 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estado do funil</CardTitle>
            <CardDescription className="text-xs">Pronto para tráfego pago?</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              {check(Boolean(data?.connected), "Gestão de campanhas ligada", "Ligar gestão (Conta)")}
              {check(convCopy.ok, convCopy.text, convCopy.text)}
              {check(googleLive > 0, `${googleLive} campanha(s) live`, "Publicar primeira campanha")}
              {check(
                funnelRiskCamps === 0,
                "Cliques Google → Clickora OK",
                `${funnelRiskCamps} campanha(s) com fuga de cliques`,
              )}
              {check(
                rsaCritical === 0,
                "RSA sem reprovações",
                `${rsaCritical} campanha(s) com RSA DISAPPROVED`,
              )}
              {check(pendingCr === 0, "Sem aprovações pendentes", `${pendingCr} aprovação(ões) à espera`)}
            </ul>
            {syncHealth && syncHealth.total > 0 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Últimas {syncHealth.total} vendas: {syncHealth.ok} sync OK
                {syncHealth.failed ? ` · ${syncHealth.failed} falha(s)` : ""}
                {syncHealth.no_gclid ? ` · ${syncHealth.no_gclid} sem gclid` : ""}
                {" · "}
                <Link
                  className="text-[#1a73e8] hover:underline"
                  to={`/tracking/dpilot/p/${projectId}/google/conversoes`}
                >
                  Ver detalhe
                </Link>
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">
                <Link
                  className="text-[#1a73e8] hover:underline"
                  to={`/tracking/dpilot/p/${projectId}/google/conversoes`}
                >
                  Saúde do upload de conversões
                </Link>
              </p>
            )}
            {urlIssues && urlIssues.critical + urlIssues.warn > 0 ? (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                Final URL: {urlIssues.critical} crítica(s), {urlIssues.warn} aviso(s).{" "}
                <Link
                  className="underline hover:no-underline"
                  to={`/tracking/dpilot/p/${projectId}/google/campanhas`}
                >
                  Ver campanhas
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!data?.connected ? (
              <Button size="sm" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/google`}>Ligar conta</Link>
              </Button>
            ) : null}
            <Button size="sm" variant={data?.connected ? "default" : "outline"} asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/termos-pesquisa`}>Termos de pesquisa</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Campanhas</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha</Link>
            </Button>
            {pendingCr > 0 ? (
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/aprovacoes`}>Aprovações ({pendingCr})</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rotina diária</CardTitle>
            <CardDescription className="text-xs">Ordem que o media buyer profissional usa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">1 · Importar</span> — Search criada na consola Google entra
              aqui para operar.
            </p>
            <p>
              <span className="font-medium text-foreground">2 · Cortar desperdício</span> —{" "}
              <Link className="text-[#1a73e8] hover:underline" to={`/tracking/dpilot/p/${projectId}/google/termos-pesquisa`}>
                Termos de pesquisa
              </Link>
              , pausas e orçamento inline.
            </p>
            <p>
              <span className="font-medium text-foreground">3 · Aprovar</span> — Copilot / RSA no estúdio antes de
              publicar.
            </p>
            <p>
              <span className="font-medium text-foreground">4 · Fechar o ciclo</span> — conversões com gclid de volta à
              rede.
            </p>
          </CardContent>
        </Card>
      </div>

      {err ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Não foi possível carregar</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !data ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          {!data?.connected ? (
            <Alert className="mt-4">
              <AlertTitle>Sincronizar conta Google</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {data?.connection_error ||
                    "Ligue uma vez em Integrações → Google; no Studio use Conta → sincronizar (importa as campanhas)."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link to={`/tracking/dpilot/p/${projectId}/google`}>Sincronizar em Conta</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Campanhas</Link>
                  </Button>
                  {!convCopy.ok ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/integracoes/google-ads">Integrações → Google</Link>
                    </Button>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Conta {data.account?.account_name || data.account?.customer_id} · {data.range.from} → {data.range.to} · fonte{" "}
              <span className="font-medium text-foreground/90">{data.source}</span>
              {" · "}
              <Link className="text-[#1a73e8] hover:underline" to={`/tracking/dpilot/p/${projectId}/google`}>
                Conta
              </Link>
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Campanhas (local)" value={fmtNum(data?.counts?.campaigns_total)} />
            <MetricCard label="Activas (live)" value={fmtNum(data?.counts?.campaigns_live)} />
            <MetricCard label="Pausadas" value={fmtNum(data?.counts?.campaigns_paused)} />
            <MetricCard label="Rascunhos / pendentes" value={fmtNum(data?.counts?.campaigns_draft)} />
            <MetricCard label="Impressões" value={m ? fmtNum(m.impressions) : "—"} hint={m ? undefined : "Requer OAuth"} />
            <MetricCard label="Cliques" value={m ? fmtNum(m.clicks) : "—"} />
            <MetricCard label="CTR" value={m ? fmtPct(m.ctr) : "—"} />
            <MetricCard label="CPC médio" value={m ? formatUsdFromMicros(m.average_cpc_micros) : "—"} />
            <MetricCard label="Investimento" value={m ? formatUsdFromMicros(m.cost_micros) : "—"} />
            <MetricCard label="Conversões" value={m ? fmtNum(m.conversions, 1) : "—"} />
            <MetricCard label="Custo / conversão" value={m ? formatUsdFromMicros(m.cost_per_conversion_micros) : "—"} />
            <MetricCard label="ROAS" value={m ? fmtNum(m.roas, 2) : "—"} hint="Valor conv. / custo" />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/termos-pesquisa`}>Termos de pesquisa</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Campanhas</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha Google</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const { data: r, error } = await paidAdsService.reconcileCampaigns(projectId);
                if (error) toast.error(error);
                else {
                  toast.success(`Sincronizado: ${r?.updated?.length ?? 0} actualizações`);
                  reload();
                  void load();
                }
              }}
            >
              Sincronizar estados com Google
            </Button>
          </div>

          {data?.connected ? (
            <Card className="mt-6 border-[#1a73e8]/25">
              <CardHeader>
                <CardTitle className="text-base">Trazer campanhas da conta Google</CardTitle>
                <CardDescription>
                  Se criou Search na consola Google, importe para gerir tudo aqui (orçamento, pausas, termos).
                </CardDescription>
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
          ) : null}
        </>
      )}
    </Gate>
  );
}

export function DpilotGoogleCampaignsManagerPage() {
  const { projectId, reload, overview, isConnConnected } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"on_google" | "local_drafts" | "excluding_archived" | "live" | "paused">(
    "on_google",
  );
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
  const [termsCampaignId, setTermsCampaignId] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    const [metricsRes, auditRes] = await Promise.all([
      paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset }),
      paidAdsService.getGoogleAdsFinalUrlAudit(projectId),
    ]);
    if (metricsRes.error) toast.error(metricsRes.error);
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
    if (localOnlyInventory && (st === "on_google" || st === "live" || st === "paused")) {
      setSt("local_drafts");
    }
  }, [localOnlyInventory, st]);

  const filtered = useMemo(() => {
    let xs = rows;
    /** Rede falhou: não listar IDs locais como inventário Google verificado. */
    if (localOnlyInventory && (st === "on_google" || st === "live" || st === "paused")) {
      xs = [];
    } else if (st === "on_google") {
      xs = xs.filter((c) => Boolean(c.external_campaign_id) && c.local_status !== "archived");
    } else if (st === "local_drafts") {
      xs = xs.filter((c) => !c.external_campaign_id && c.local_status !== "archived");
    } else if (st === "excluding_archived") xs = xs.filter((c) => c.local_status !== "archived");
    else if (st === "live") {
      xs = xs.filter((c) => c.local_status === "live" && Boolean(c.external_campaign_id));
    } else if (st === "paused") {
      xs = xs.filter((c) => c.local_status === "paused" && Boolean(c.external_campaign_id));
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
      live: onGoogle.filter((c) => c.local_status === "live").length,
      paused: onGoogle.filter((c) => c.local_status === "paused").length,
    };
  }, [rows, localOnlyInventory]);

  const paidConnected = isConnConnected(overview?.connection);
  const connMeta = overview?.connection as
    | { account_name?: string | null; google_customer_id?: string | null }
    | undefined;
  const accountLabel = connMeta?.account_name || connMeta?.google_customer_id || null;

  const syncAccount = async () => {
    setLinking(true);
    try {
      const { data, error } = await paidAdsService.googleLinkFromIntegrations(projectId, {
        import_campaigns: true,
      });
      if (error || !data) {
        toast.error(error || "Sincronize em Conta ou ligue em Integrações → Google.");
        return;
      }
      toast.success(
        data.import
          ? `Conta sincronizada · ${data.import.imported} campanha(s)`
          : "Conta sincronizada",
      );
      reload();
      void load();
    } finally {
      setLinking(false);
    }
  };

  const onDuplicate = async (id: string, name: string, currentBudgetMicros: number | null) => {
    const nextName = window.prompt("Novo nome da cópia (sem métricas da original):", `${name} (cópia)`);
    if (nextName == null) return;
    const budgetHint =
      currentBudgetMicros != null ? (currentBudgetMicros / 1e6).toFixed(2) : "";
    const budgetRaw = window.prompt("Orçamento diário USD (vazio = igual à original):", budgetHint);
    if (budgetRaw == null) return;
    const daily_budget_usd =
      budgetRaw.trim() === "" ? undefined : Number(budgetRaw.replace(",", "."));
    if (daily_budget_usd != null && (!Number.isFinite(daily_budget_usd) || daily_budget_usd <= 0)) {
      toast.error("Orçamento inválido.");
      return;
    }
    const publish = window.confirm(
      "Enfileirar publicação na Google?\n\nOK = sim (Copilot → Aprovações / Autopilot aplica)\nCancelar = só rascunho local",
    );
    setBusyId(id);
    const { data, error } = await paidAdsService.duplicateGoogleCampaign(projectId, id, {
      name: nextName.trim() || undefined,
      daily_budget_usd,
      publish,
    });
    setBusyId(null);
    if (error) {
      toast.error(toastGoogleAdsError(error));
      return;
    }
    toast.success(`Cópia criada: ${data?.name}`);
    data?.warnings?.forEach((w) => toast.message(w));
    reload();
    void load();
    if (data?.campaign_id) {
      window.location.assign(
        publish
          ? `/tracking/dpilot/p/${projectId}/aprovacoes`
          : `/tracking/dpilot/p/${projectId}/campanhas/${data.campaign_id}/google`,
      );
    }
  };

  const onBudget = async (
    campaignId: string,
    currentMicros: number | null,
    meta?: { budget_editable?: boolean; budget_reference_count?: number },
  ) => {
    if (meta?.budget_editable === false) {
      toast.error(
        `Orçamento partilhado por ${meta.budget_reference_count ?? "várias"} campanhas na Google. Separe o orçamento na consola antes de ajustar aqui.`,
      );
      return;
    }
    const current = currentMicros != null ? (currentMicros / 1e6).toFixed(2) : "";
    const raw = window.prompt("Novo orçamento diário (USD). Confirmação obrigatória para alterações reais na Google:", current);
    if (raw == null) return;
    const usd = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(usd) || usd <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    if (currentMicros != null) {
      const prev = currentMicros / 1e6;
      const ratio = usd / prev;
      if (ratio >= 2 || ratio <= 0.5) {
        if (!window.confirm(`Alteração elevada: ${prev.toFixed(2)} → ${usd.toFixed(2)} USD/dia. Confirmar?`)) return;
      }
    }
    setBusyId(campaignId);
    const { error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, {
      action: "update_budget_usd",
      daily_budget_usd: usd,
    });
    setBusyId(null);
    if (error) toast.error(toastGoogleAdsError(error));
    else {
      toast.success(`Orçamento ${usd.toFixed(2)} USD/dia — pedido enviado`);
      reload();
      void load();
    }
  };

  const studioAction = async (campaignId: string, action: "pause_campaign" | "resume_campaign") => {
    const label = action === "pause_campaign" ? "Pausar" : "Ativar";
    if (!window.confirm(`${label} esta campanha na Google Ads? A alteração segue Copilot/Autopilot.`)) return;
    setBusyId(campaignId);
    const { error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, { action });
    setBusyId(null);
    if (error) toast.error(toastGoogleAdsError(error));
    else {
      toast.success(`${label}: pedido enviado`);
      reload();
      void load();
    }
  };

  const exportCsv = () => {
    const header = [
      "name",
      "id",
      "external_id",
      "status",
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

  return (
    <Gate>
      <PageHeader
        title="Campanhas"
        description={
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Clique no nome para configurar. Pause, orçamento e duplicar sem abrir o Google Ads.
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
              CSV
            </Button>
            <Button asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>
                <Plus className="mr-1.5 h-4 w-4" />
                Criar campanha
              </Link>
            </Button>
          </div>
        }
      />

      {!paidConnected ? (
        <Alert className="mt-4 border-[#1a73e8]/30">
          <AlertTitle>Conta por sincronizar</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Ligue uma vez em Integrações → Google; depois sincronize aqui para ver as campanhas da conta.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
                {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Usar conta de Integrações
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/integracoes/google-ads">Abrir Integrações</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {connErr && paidConnected && !googleAdsNeedsReauth(connErr) ? (
        <Alert className="mt-4 border-amber-500/40 bg-amber-500/5">
          <AlertTitle>Lista local ≠ conta Google</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{friendlyGoogleAdsNetworkError(connErr) ?? connErr}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Campanhas sem ID Google são rascunhos deste projecto — não o inventário de ads.google.com
              {accountCustomerId
                ? ` (conta ${accountCustomerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")})`
                : ""}
              . Use «Re-sincronizar e importar» para trazer as campanhas reais da conta.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
                {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Re-sincronizar e importar
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/integracoes/google-ads">Verificar Integrações → Google</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : paidConnected && localOnlyInventory && chipCounts.on_google === 0 ? (
        <Alert className="mt-4 border-amber-500/40 bg-amber-500/5">
          <AlertTitle>Ainda sem campanhas importadas da Google</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-xs leading-relaxed">
              A vista «Na Google» está vazia. Os rascunhos do projecto estão em «Só neste projecto» — não confundir com
              ads.google.com.
            </p>
            <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
              {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Re-sincronizar e importar
            </Button>
          </AlertDescription>
        </Alert>
      ) : paidConnected && !connErr ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Fonte: {source || "—"}
          {accountCustomerId
            ? ` · conta ${accountCustomerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`
            : ""}
        </p>
      ) : null}

      {(() => {
        const work = rows.filter((c) => c.local_status !== "archived" && Boolean(c.external_campaign_id));
        let clicks = 0;
        let cost = 0;
        let conv = 0;
        let value = 0;
        let withM = 0;
        for (const c of work) {
          if (!c.metrics) continue;
          withM += 1;
          clicks += c.metrics.clicks;
          cost += c.metrics.cost_micros;
          conv += c.metrics.conversions;
          value += c.metrics.conversions_value;
        }
        const costUsd = cost / 1e6;
        const roas = costUsd > 0 ? value / costUsd : null;
        const tile = (label: string, val: string) => (
          <Card key={label} className="border-border/70 shadow-none">
            <CardContent className="px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{val}</p>
            </CardContent>
          </Card>
        );
        return (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {tile("Na Google", fmtNum(chipCounts.on_google))}
            {tile("Rascunhos", fmtNum(chipCounts.local_drafts))}
            {tile("Ativas", fmtNum(chipCounts.live))}
            {tile("Pausadas", fmtNum(chipCounts.paused))}
            {tile("Investimento", withM ? formatUsdFromMicros(cost) : "—")}
            {tile("Cliques", withM ? fmtNum(clicks) : "—")}
            {tile("Conversões", withM ? fmtNum(conv, 1) : "—")}
            {tile(
              "Receita · ROAS",
              withM && (value > 0 || roas != null)
                ? `${value > 0 ? value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—"} · ${roas != null ? roas.toFixed(2) : "—"}`
                : "—",
            )}
          </div>
        );
      })()}

      {urlAuditTotals && urlAuditTotals.critical + urlAuditTotals.warn > 0 ? (
        <Alert variant={urlAuditTotals.critical > 0 ? "destructive" : "default"} className="mt-4">
          <AlertTitle className="text-sm">Final URL — atenção no funil</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            {urlAuditTotals.critical} crítica(s) · {urlAuditTotals.warn} aviso(s) · {urlAuditTotals.ok} OK. gclid
            manual ou ValueTrack na Final URL fazem cliques Ads não baterem na Clickora — use auto-tagging e lander
            limpa.
          </AlertDescription>
        </Alert>
      ) : null}

      {funnelRiskCount > 0 ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle className="text-sm">
            {funnelRiskCount} campanha(s) com cliques Google que quase não chegam à Clickora
          </AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            Captura &lt; 50% com ≥10 cliques na rede. Confirme Final URL (presell limpa), auto-tagging e que o anúncio
            aponta para a lander — não cloaking.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "on_google" as const, label: `Na Google ${chipCounts.on_google}` },
                { id: "local_drafts" as const, label: `Só neste projecto ${chipCounts.local_drafts}` },
                { id: "live" as const, label: `Ativas ${chipCounts.live}` },
                { id: "paused" as const, label: `Pausadas ${chipCounts.paused}` },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSt(chip.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  st === chip.id
                    ? "bg-[#1a73e8] text-white"
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
                placeholder="Buscar campanha pelo nome"
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
                  ? "Sincronize a conta para listar campanhas."
                  : st === "on_google" || st === "live" || st === "paused"
                    ? "Nenhuma campanha da conta Google neste filtro. Importe com «Re-sincronizar e importar» — os rascunhos locais estão em «Só neste projecto»."
                    : st === "local_drafts"
                      ? "Sem rascunhos locais neste projecto."
                      : "Nenhuma campanha neste filtro."}
              </p>
              {paidConnected && (st === "on_google" || st === "live") && chipCounts.on_google === 0 ? (
                <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
                  {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Re-sincronizar e importar
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Ativo</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Estratégia</TableHead>
                    <TableHead>Orçamento/dia</TableHead>
                    <TableHead>CPA</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Conv.</TableHead>
                    <TableHead>Captura</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const m = c.metrics;
                    const busy = busyId === c.id;
                    const urlAudit = urlAuditById.get(c.id);
                    const canToggle = Boolean(c.external_campaign_id) && (c.local_status === "live" || c.local_status === "paused");
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          {canToggle ? (
                            <Switch
                              checked={c.local_status === "live"}
                              disabled={busy}
                              aria-label={c.local_status === "live" ? "Pausar campanha" : "Ativar campanha"}
                              onCheckedChange={(on) =>
                                void studioAction(c.id, on ? "resume_campaign" : "pause_campaign")
                              }
                            />
                          ) : (
                            <Badge variant="outline" className="font-normal text-[10px]">
                              {campaignStatusLabel(c.local_status)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[18rem]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              to={`/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`}
                              className="font-medium text-[#1a73e8] hover:underline line-clamp-2"
                            >
                              {c.name}
                            </Link>
                            {!c.external_campaign_id ? (
                              <Badge variant="secondary" className="font-normal text-[10px]">
                                Só local
                              </Badge>
                            ) : null}
                          </div>
                          {urlAudit && urlAudit.severity !== "ok" ? (
                            <p className="mt-0.5 text-[10px] text-amber-800 dark:text-amber-200">
                              Final URL: {urlAudit.severity === "critical" ? "crítica" : "aviso"}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.bidding_strategy || "—"}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left hover:underline disabled:no-underline"
                            disabled={busy || !c.external_campaign_id || c.budget_editable === false}
                            title={
                              c.budget_editable === false
                                ? `Orçamento partilhado (${c.budget_reference_count})`
                                : "Alterar orçamento"
                            }
                            onClick={() =>
                              void onBudget(c.id, c.daily_budget_micros, {
                                budget_editable: c.budget_editable,
                                budget_reference_count: c.budget_reference_count,
                              })
                            }
                          >
                            {c.daily_budget_micros != null ? formatUsdFromMicros(c.daily_budget_micros) : "—"}
                            {c.budget_shared ? (
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                Partilhado ({c.budget_reference_count})
                              </span>
                            ) : null}
                          </button>
                        </TableCell>
                        <TableCell>{m ? formatUsdFromMicros(m.cost_per_conversion_micros) : "—"}</TableCell>
                        <TableCell>{m ? formatUsdFromMicros(m.cost_micros) : "—"}</TableCell>
                        <TableCell>{m ? fmtNum(m.conversions, 1) : "—"}</TableCell>
                        <TableCell>
                          {c.funnel_risk ? (
                            <Badge
                              variant="outline"
                              className="border-destructive/50 font-normal text-destructive"
                              title={
                                c.click_delta != null
                                  ? `Δ ${c.click_delta} cliques · captura ${((c.click_capture_ratio ?? 0) * 100).toFixed(0)}%`
                                  : "Captura baixa"
                              }
                            >
                              {c.click_capture_ratio != null
                                ? `${(c.click_capture_ratio * 100).toFixed(0)}%`
                                : "Risco"}
                            </Badge>
                          ) : c.click_capture_ratio != null ? (
                            <span className="text-xs text-muted-foreground">
                              {(c.click_capture_ratio * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {c.external_campaign_id ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={busy}
                                title="Termos de pesquisa"
                                onClick={() => setTermsCampaignId(c.id)}
                              >
                                <Search className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={busy || c.local_status === "archived"}
                              title="Duplicar"
                              onClick={() => void onDuplicate(c.id, c.name, c.daily_budget_micros)}
                            >
                              <Copy className="h-3.5 w-3.5" />
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
        <Card className="mt-4 border-[#1a73e8]/30">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Termos de pesquisa</CardTitle>
              <CardDescription>
                {rows.find((r) => r.id === termsCampaignId)?.name || "Campanha seleccionada"}
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTermsCampaignId(null)}>
              Fechar
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
        <p className="mt-3 text-xs text-muted-foreground">
          Dica: no ícone de pesquisa de uma campanha publicada abre os search terms e pode negar desperdício aqui.
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Importar Search da conta Google</CardTitle>
          <CardDescription>
            Campanhas criadas fora da Dclickora passam a ser geríveis aqui após importação.
          </CardDescription>
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
  const { projectId } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [inv, setInv] = useState<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsInventory>>["data"]>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error } = await paidAdsService.getGoogleAdsInventory(projectId);
      if (error) toast.error(error);
      else setInv(data ?? null);
      setLoading(false);
    })();
  }, [projectId]);

  const rows = useMemo(() => {
    const list = (inv?.[kind] as Array<Record<string, unknown>> | undefined) ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
  }, [inv, kind, q]);

  return (
    <Gate>
      <PageHeader
        title={title}
        description={<p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">{description}</p>}
        actions={
          <Button asChild variant="outline">
            <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Ver campanhas</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <Input placeholder="Filtrar…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registos. Crie ou sincronize campanhas Google.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {kind === "ad_groups" && (
                      <>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>KW</TableHead>
                        <TableHead>Anúncios</TableHead>
                        <TableHead />
                      </>
                    )}
                    {kind === "ads" && (
                      <>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Títulos</TableHead>
                        <TableHead />
                      </>
                    )}
                    {kind === "keywords" && (
                      <>
                        <TableHead>Palavra-chave</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead />
                      </>
                    )}
                    {kind === "budgets" && (
                      <>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Orçamento/dia</TableHead>
                        <TableHead>ID Google</TableHead>
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
                        <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${cid}/google`}>Gestão</Link>
                      </Button>
                    );
                    if (kind === "ad_groups") {
                      return (
                        <TableRow key={String(r.id)}>
                          <TableCell className="font-medium">{String(r.name)}</TableCell>
                          <TableCell>{String(r.campaign_name)}</TableCell>
                          <TableCell>{campaignStatusLabel(String(r.status))}</TableCell>
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
                          <TableCell>{campaignStatusLabel(String(r.status))}</TableCell>
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
                          <TableCell>{campaignStatusLabel(String(r.status))}</TableCell>
                          <TableCell className="text-right">{manage}</TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={cid}>
                        <TableCell className="font-medium">{String(r.campaign_name)}</TableCell>
                        <TableCell>{campaignStatusLabel(String(r.local_status))}</TableCell>
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
              <p className="text-sm font-medium">Negativas (campanha)</p>
              <p className="text-xs text-muted-foreground">
                {inv.negative_keywords.campaign_level.length} ao nível da campanha ·{" "}
                {inv.negative_keywords.ad_group_level.length} ao nível do grupo. Edite no estúdio da campanha.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotGoogleAdGroupsPage() {
  return (
    <InventoryTablePage
      title="Google Ads · Grupos de anúncios"
      description="Inventário local sincronizado com a estrutura publicada. Pausar/ativar/editar no estúdio da campanha (API real)."
      kind="ad_groups"
    />
  );
}

export function DpilotGoogleAdsCreativesPage() {
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
      <PageHeader
        title="Google Ads · Anúncios (RSA)"
        description={
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Política real da Google (DISAPPROVED / APPROVED_LIMITED) nas Search deste projecto — sem inventar
            «aprovado».
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
              <CardTitle className="text-sm text-muted-foreground">Campanhas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{totals.campaigns}</p>
            </CardContent>
          </Card>
          <Card className={totals.disapproved_ads > 0 ? "border-destructive/30" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">RSA reprovados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{totals.disapproved_ads}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Limitados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{totals.limited_ads}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {err ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>API</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
      {note ? (
        <Alert className="mt-4">
          <AlertTitle className="text-sm">Sem dados de rede</AlertTitle>
          <AlertDescription className="text-xs">{note}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Por campanha</CardTitle>
          <CardDescription>Abra o estúdio para editar RSA; aqui só diagnóstico de policy.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem campanhas para auditar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>RSAs</TableHead>
                  <TableHead>Reprovados</TableHead>
                  <TableHead>Limitados</TableHead>
                  <TableHead>Tópicos</TableHead>
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
                          Estúdio
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
        Detalhe de headlines/descrições: abra o{" "}
        <Link className="text-[#1a73e8] hover:underline" to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>
          estúdio da campanha
        </Link>
        .
      </p>
    </Gate>
  );
}

export function DpilotGoogleKeywordsPage() {
  const { projectId, reload } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsKeywordMetrics>>["data"]>["keywords"]
  >([]);
  const [q, setQ] = useState("");
  const [connErr, setConnErr] = useState<string | null>(null);
  const [kwSource, setKwSource] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await paidAdsService.getGoogleAdsKeywordMetrics(projectId, { preset });
    if (error) toast.error(error);
    else {
      setRows(data?.keywords ?? []);
      setConnErr(data?.connection_error ?? null);
      setKwSource(data?.source ?? "");
    }
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!window.confirm("Pausar esta palavra-chave na Google Ads?")) return;
    setBusyId(keywordId);
    const { error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, {
      action: "pause_keyword",
      keyword_id: keywordId,
    });
    setBusyId(null);
    if (error) toast.error(error);
    else {
      toast.success("Pausa enfileirada");
      reload();
      void load();
    }
  };

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Palavras-chave"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {kwSource === "google_ads_api"
              ? "Métricas por keyword via GAQL da conta ligada. Pause perdedoras aqui; edite no estúdio."
              : "Lista local do projecto — métricas Google só aparecem após import/publicação com criterion ID na rede."}
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        }
      />
      {connErr ? (
        <Alert className="mt-4">
          <AlertTitle>Métricas de rede indisponíveis</AlertTitle>
          <AlertDescription>{connErr}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <Input className="max-w-sm" placeholder="Filtrar keyword / campanha…" value={q} onChange={(e) => setQ(e.target.value)} />
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem palavras-chave neste projecto.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>Conv.</TableHead>
                    <TableHead>CPA</TableHead>
                    <TableHead>Estado</TableHead>
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
                            {campaignStatusLabel(k.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="sm" variant="secondary" className="h-8" asChild>
                              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${k.campaign_id}/google`}>Gestão</Link>
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
    </Gate>
  );
}

export function DpilotGoogleBudgetsPage() {
  const { projectId, reload } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsCampaignsMetrics>>["data"]>["campaigns"]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset: "last_7" });
    if (error) toast.error(error);
    else setRows((data?.campaigns ?? []).filter((c) => c.local_status !== "archived"));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onBudget = async (
    campaignId: string,
    currentMicros: number | null,
    meta?: { budget_editable?: boolean; budget_reference_count?: number },
  ) => {
    if (meta?.budget_editable === false) {
      toast.error(
        `Orçamento partilhado por ${meta.budget_reference_count ?? "várias"} campanhas. Separe na consola Google antes de ajustar aqui.`,
      );
      return;
    }
    const current = currentMicros != null ? (currentMicros / 1e6).toFixed(2) : "";
    const raw = window.prompt(
      "Novo orçamento diário USD.\nSe o orçamento estiver partilhado na Google, a API bloqueia a alteração por segurança.",
      current,
    );
    if (raw == null) return;
    const usd = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(usd) || usd <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    setBusyId(campaignId);
    const { error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, {
      action: "update_budget_usd",
      daily_budget_usd: usd,
    });
    setBusyId(null);
    if (error) toast.error(error);
    else {
      toast.success(`Orçamento ${usd.toFixed(2)} USD/dia enfileirado`);
      reload();
      void load();
    }
  };

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Orçamentos"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            Pré-voo de orçamento partilhado: se várias campanhas partilham o mesmo budget, o ajuste fica bloqueado
            aqui (e na API). Compara orçamento vs custo dos últimos 7 dias.
          </p>
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem campanhas Google.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Orçamento/dia</TableHead>
                  <TableHead>Custo 7d</TableHead>
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
                      <Badge variant="outline">{campaignStatusLabel(c.local_status)}</Badge>
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
                            Partilhado ({c.budget_reference_count})
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
                          <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`}>Gestão</Link>
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
                                ? `Orçamento partilhado (${c.budget_reference_count})`
                                : "Alterar orçamento"
                            }
                            onClick={() =>
                              void onBudget(c.id, c.daily_budget_micros, {
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
    </Gate>
  );
}

export function DpilotGoogleConversionsPage() {
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
          title: "Ciclo afiliado pronto",
          detail: "Upload activo e customer alinhado com a conta Paid deste projecto.",
          variant: "default" as const,
        }
      : funnel === "customer_mismatch"
        ? {
            title: "Customers diferentes",
            detail:
              "O upload de conversões aponta para outra conta Google do que o Ads Studio. Confirme se é MCC/intencional — senão as vendas não optimizam as campanhas que gere aqui.",
            variant: "destructive" as const,
          }
        : funnel === "settings_unknown"
          ? {
              title: "Não foi possível ler o upload",
              detail: "Recarregue ou abra Integrações → Google Ads.",
              variant: "destructive" as const,
            }
          : {
              title: "Upload de conversões incompleto",
              detail: "Ligue OAuth, customer e conversion action (bootstrap) para fechar gclid → rede.",
              variant: "default" as const,
            };

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Conversões (tracking)"
        description={
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Saúde real do upload afiliado (gclid) ao lado da conta Paid — sem misturar OAuth nem inventar eventos.
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="sm" asChild>
              <Link to="/integracoes/google-ads">Integrações</Link>
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
            <CardTitle className="text-sm text-muted-foreground">Upload pronto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {settingsErr ? "?" : settings?.can_upload ? "Sim" : "Não"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Alinhamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {align === "match" ? "OK" : align === "mismatch" ? "≠" : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {align === "match"
                ? "Mesmo customer"
                : align === "mismatch"
                  ? "Paid ≠ upload"
                  : "Falta um dos IDs"}
            </p>
          </CardContent>
        </Card>
        <Card className={health.failed > 0 ? "border-destructive/30" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sync recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {health.total ? `${health.ok}/${health.total}` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {health.failed ? `${health.failed} falha(s)` : health.total ? "sem falhas na amostra" : "sem vendas"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sem gclid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{health.total ? health.no_gclid : "—"}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Na amostra recente</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload (stack afiliado)</CardTitle>
            <CardDescription>OAuth do utilizador · Integrações Google Ads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : settingsErr ? (
              <Alert variant="destructive">
                <AlertTitle className="text-sm">Falha ao ler settings</AlertTitle>
                <AlertDescription className="text-xs">Tente novamente ou abra Integrações.</AlertDescription>
              </Alert>
            ) : (
              <ul className="space-y-1.5 text-xs">
                <li>Conta Google: {settings?.has_refresh_token ? "ligada" : "não ligada"}</li>
                <li>Customer ID: {settings?.google_ads_customer_id || "—"}</li>
                <li>Conversion action: {settings?.google_ads_conversion_action_id || "—"}</li>
                <li>API env: {settings?.api_env_configured ? "ok" : "em falta"}</li>
                <li>Enabled: {settings?.google_ads_enabled ? "sim" : "não"}</li>
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/integracoes/google-ads">Configurar / bootstrap</Link>
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
                      toast.success(data?.detail || "Bootstrap concluído");
                      void reload();
                    }
                  }}
                >
                  {bootBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Correr bootstrap
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conta Paid (este projecto)</CardTitle>
            <CardDescription>OAuth do Ads Studio · gestão de campanhas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-1.5 text-xs">
              <li>Customer ID Paid: {paidCustomer || "—"}</li>
              <li>
                Alinhamento:{" "}
                {align === "match"
                  ? "mesmo customer — ideal"
                  : align === "mismatch"
                    ? "diferentes — confirme MCC / intenção"
                    : "ligue ambas as contas para comparar"}
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/google`}>Ligações Paid</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Métricas por campanha</Link>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Dois OAuth são intencionais (stacks separados). Configure uma vez; no dia-a-dia opere campanhas e vendas
              aqui sem a consola Google.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-base">Ledger recente (upload)</CardTitle>
              <CardDescription>
                Estado `google_ads_sync`.{" "}
                {scopedApplied
                  ? "Filtrado às campanhas Paid deste projecto."
                  : "Sem UUID Paid nas vendas recentes — a mostrar amostra da conta."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={projectOnly} onCheckedChange={(v) => setProjectOnly(v === true)} />
                Só este projecto
              </label>
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <Link to="/resultados/relatorios/conversoes">Relatórios → Conversões</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ledgerErr ? (
            <Alert variant="destructive">
              <AlertTitle className="text-sm">Não foi possível carregar vendas</AlertTitle>
              <AlertDescription className="text-xs">{ledgerErr}</AlertDescription>
            </Alert>
          ) : loading ? (
            <Skeleton className="h-32 w-full" />
          ) : scopedLedger.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem conversões registadas.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>gclid</TableHead>
                    <TableHead>Sync Google</TableHead>
                    <TableHead>Erro</TableHead>
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
                        {row.has_gclid ? (row.gclid ? `${row.gclid.slice(0, 12)}…` : "sim") : "não"}
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
                          {googleAdsSyncShortLabel(row.google_ads_sync)}
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
    </Gate>
  );
}

export function DpilotGoogleReportsPage() {
  const { projectId, campaigns } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
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
      campaign_id: campaignFilter !== "all" ? campaignFilter : undefined,
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

  const mobileShare = useMemo(() => {
    const mobile = devices.find((d) => /MOBILE/i.test(d.device));
    const totalCost = devices.reduce((s, d) => s + d.metrics.cost_micros, 0);
    if (!mobile || totalCost <= 0) return null;
    return mobile.metrics.cost_micros / totalCost;
  }, [devices]);

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Relatórios"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            Dispositivo na conta e por campanha Search importada — para decidir bids mobile vs desktop sem a consola
            Google.
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[220px]" aria-label="Campanha">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas (conta / importadas)</SelectItem>
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
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Campanhas</Link>
            </Button>
          </div>
        }
      />
      {err ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>API</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {mobileShare != null && mobileShare >= 0.55 ? (
        <Alert className="mt-4">
          <AlertTitle className="text-sm">Mobile concentra {(mobileShare * 100).toFixed(0)}% do custo</AlertTitle>
          <AlertDescription className="text-xs">
            Revise CPA/ROAS mobile na tabela por campanha antes de subir orçamento desktop.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Por dispositivo</CardTitle>
          <CardDescription>
            {campaignFilter === "all"
              ? "Rollup da conta Google no período."
              : "Rollup da campanha seleccionada."}
            {scoped ? ` · ${scoped} Search importada(s) no breakdown.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados neste período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Impr.</TableHead>
                  <TableHead>Cliques</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Conv.</TableHead>
                  <TableHead>ROAS</TableHead>
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
          <CardTitle className="text-base">Campanha × dispositivo</CardTitle>
          <CardDescription>
            Só campanhas Search publicadas/importadas neste projecto. Use o filtro acima para isolar uma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : byCampaign.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem breakdown — importe ou publique Search para ver dispositivo por campanha.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Conv.</TableHead>
                    <TableHead>CPA</TableHead>
                    <TableHead>ROAS</TableHead>
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
                      <TableCell>{fmtNum(r.metrics.clicks)}</TableCell>
                      <TableCell>{formatUsdFromMicros(r.metrics.cost_micros)}</TableCell>
                      <TableCell>{fmtNum(r.metrics.conversions, 1)}</TableCell>
                      <TableCell>{formatUsdFromMicros(r.metrics.cost_per_conversion_micros)}</TableCell>
                      <TableCell>{fmtNum(r.metrics.roas, 2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotGoogleRecommendationsPage() {
  const { projectId } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [recs, setRecs] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsRecommendations>>["data"]>["recommendations"]
  >([]);
  const [err, setErr] = useState<string | null>(null);

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
    const label = action === "apply" ? "Aplicar" : "Rejeitar";
    if (
      !window.confirm(
        `${label} esta recomendação na conta Google Ads?\n\nSó continue se compreende o impacto. A alteração é na API oficial.`,
      )
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
      toast.success(`${label} concluído`);
      void load();
    }
  };

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Recomendações"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            RecommendationService real. Aplicar só tipos suportados; rejeitar (dismiss) sempre disponível. Nunca em
            silêncio.
          </p>
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        }
      />
      {err ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>API</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="mt-4">
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem recomendações activas ou conta sem acesso a este recurso.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recs.map((r, i) => (
                  <TableRow key={r.resource_name ?? String(i)}>
                    <TableCell className="font-medium">{r.type}</TableCell>
                    <TableCell className="font-mono text-xs">{r.campaign_resource || "—"}</TableCell>
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
                              Aplicar
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
                            Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Gate>
  );
}

export function DpilotGoogleAutomationsPage() {
  const { projectId } = useDpilotPaid();
  return (
    <Gate>
      <PageHeader
        title="Google Ads · Automações"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            Regras do motor Paid (pausa por gasto sem conversão, escala ROAS, redistribuição) com modos Copilot /
            Autopilot e guardrails. Histórico em Auditoria.
          </p>
        }
        actions={
          <Button asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/auditoria`}>Abrir auditoria & motor</Link>
          </Button>
        }
      />
      <Alert className="mt-4">
        <AlertTitle>Proteções activas</AlertTitle>
        <AlertDescription>
          Limites de orçamento diário/mensal, confirmação acima elevada e dry-run configurável no servidor (
          <code className="text-xs">PAID_OPTIMIZER_DRY_RUN</code>).
        </AlertDescription>
      </Alert>
    </Gate>
  );
}

export function DpilotGoogleAiAssistantPage() {
  const { projectId, reload } = useDpilotPaid();
  const [question, setQuestion] = useState("Qual campanha está a gastar mais?");
  const [preset, setPreset] = useState("last_7");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
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
    if (!window.confirm(`${s.action}\n\nConfirmar envio via Copilot/Autopilot?`)) return;
    setBusy(s.campaign_id);
    if (s.suggested_op === "pause_campaign") {
      const { error } = await paidAdsService.postGoogleStudioActions(projectId, s.campaign_id, {
        action: "pause_campaign",
      });
      setBusy(null);
      if (error) toast.error(error);
      else {
        toast.success("Pausa enfileirada");
        reload();
      }
      return;
    }
    const base = s.daily_budget_micros != null ? Number(s.daily_budget_micros) / 1e6 : 0;
    if (!(base > 0)) {
      setBusy(null);
      toast.error("Sem orçamento actual para calcular +20%.");
      return;
    }
    const next = Math.round(base * 1.2 * 100) / 100;
    const { error } = await paidAdsService.postGoogleStudioActions(projectId, s.campaign_id, {
      action: "update_budget_usd",
      daily_budget_usd: next,
    });
    setBusy(null);
    if (error) toast.error(error);
    else {
      toast.success(`Orçamento → ${next.toFixed(2)} USD/dia enfileirado`);
      reload();
    }
  };

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Assistente IA"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            Analisa métricas reais. Sugestões com botão de confirmação — nunca aplica sozinho.
          </p>
        }
      />
      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
          </div>
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
          <div className="flex flex-wrap gap-2">
            {[
              "Qual campanha está a gastar mais?",
              "Qual campanha está a converter melhor?",
              "Quais campanhas devo pausar?",
              "Qual campanha merece mais orçamento?",
            ].map((s) => (
              <Button key={s} type="button" size="sm" variant="outline" onClick={() => setQuestion(s)}>
                {s}
              </Button>
            ))}
          </div>
          <Button type="button" onClick={() => void ask()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Analisar
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
                        <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${e.campaign_id}/google`}>Gestão</Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {out.suggestions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sugestões (confirmação obrigatória)</p>
                  {out.suggestions.map((s, i) => (
                    <Alert key={i}>
                      <AlertTitle className="text-sm">{s.action}</AlertTitle>
                      <AlertDescription className="space-y-2 text-xs">
                        <p>
                          Risco: {s.risk}. Evidência: {s.evidence}
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
                            Confirmar e enviar
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
    </Gate>
  );
}

export function DpilotGoogleHistoryPage() {
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
      <PageHeader
        title="Google Ads · Histórico"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            Operações pedidas pela Dclickora (change requests). Sem tokens nem segredos nos logs.
          </p>
        }
        actions={
          <Button variant="outline" asChild>
            <Link to={`/tracking/dpilot/p/${projectId}/aprovacoes`}>Aprovações</Link>
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent className="pt-6">
          {googleRelated.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há operações registadas neste projecto.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {googleRelated.slice(0, 80).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{changeRequestTypeLabel(c.type)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{changeRequestStatusLabel(c.status)}</Badge>
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
    </Gate>
  );
}
