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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  campaignStatusLabel,
  changeRequestStatusLabel,
  changeRequestTypeLabel,
  formatUsdFromMicros,
  summarizeChangeRequestPayload,
} from "@/lib/paidAdsUi";
import { integrationsService } from "@/services/integrationsService";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { Gate } from "./DpilotPaidPages";
import { DpilotPaidOauthGrid } from "./DpilotPaidOauthGrid";
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

export function DpilotGoogleOverviewPage() {
  const { projectId, reload, campaigns, changeRequests } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsManagerOverview>>["data"]>(null);
  const [err, setErr] = useState<string | null>(null);
  const [convReady, setConvReady] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [{ data: d, error }, conv] = await Promise.all([
      paidAdsService.getGoogleAdsManagerOverview(projectId, { preset }),
      integrationsService.getGoogleAdsSettings(),
    ]);
    if (error) setErr(error);
    else setData(d ?? null);
    setConvReady(conv.error ? null : Boolean(conv.data?.can_upload));
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const m = data?.metrics;
  const googleLive = campaigns.filter((c) => c.platform === "google_ads" && c.status === "live").length;
  const pendingCr = changeRequests.filter((c) => c.status === "pending").length;

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Centro de operações"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            Hub do afiliado: métricas reais, campanhas, termos de pesquisa, conversões e aprovações — para raramente
            precisar de abrir ads.google.com.
          </p>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google`}>Conta e ligações</Link>
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#1a73e8]/25 bg-[#1a73e8]/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist afiliado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <p>{data?.connected ? "✓ Conta Paid ligada" : "○ Ligar OAuth Paid"}</p>
            <p>{convReady ? "✓ Upload conversões pronto" : "○ Configurar conversões (tracking)"}</p>
            <p>{googleLive > 0 ? `✓ ${googleLive} campanha(s) live` : "○ Publicar primeira campanha"}</p>
            <p>{pendingCr > 0 ? `○ ${pendingCr} aprovação(ões) pendente(s)` : "✓ Sem aprovações pendentes"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button size="sm" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Campanhas & termos</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/conversoes`}>Conversões</Link>
            </Button>
            {pendingCr > 0 ? (
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/aprovacoes`}>Aprovações ({pendingCr})</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fluxo diário recomendado</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-1">
            <p>1. Importar Search da conta (se criou fora) → depois operar tudo aqui.</p>
            <p>2. Campanhas & termos → negar desperdício; orçamento/pausa inline.</p>
            <p>3. Confirmar Aprovações (Copilot) e aprovação RSA no estúdio.</p>
            <p>4. Conversões (gclid) para fechar o ciclo afiliado.</p>
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
              <AlertTitle>Conta Google Ads não ligada</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{data?.connection_error || "Ligue OAuth para ver métricas reais da rede."}</p>
                <DpilotPaidOauthGrid only="google" />
              </AlertDescription>
            </Alert>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Conta {data.account?.account_name || data.account?.customer_id} · {data.range.from} → {data.range.to} · fonte{" "}
              <span className="font-medium text-foreground/90">{data.source}</span>
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
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Campanhas & termos</Link>
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
  const { projectId, reload } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [q, setQ] = useState("");
  const [st, setSt] = useState("excluding_archived");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsCampaignsMetrics>>["data"]>["campaigns"]
  >([]);
  const [source, setSource] = useState<string>("");
  const [connErr, setConnErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [termsCampaignId, setTermsCampaignId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await paidAdsService.getGoogleAdsCampaignsMetrics(projectId, { preset });
    if (error) toast.error(error);
    else {
      setRows(data?.campaigns ?? []);
      setSource(data?.source ?? "");
      setConnErr(data?.connection_error ?? null);
    }
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let xs = rows;
    if (st === "excluding_archived") xs = xs.filter((c) => c.local_status !== "archived");
    else if (st !== "all") xs = xs.filter((c) => c.local_status === st);
    const needle = q.trim().toLowerCase();
    if (needle) {
      xs = xs.filter(
        (c) => c.name.toLowerCase().includes(needle) || (c.external_campaign_id ?? "").includes(needle),
      );
    }
    return xs;
  }, [rows, q, st]);

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
      toast.error(error);
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

  const onBudget = async (campaignId: string, currentMicros: number | null) => {
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
    if (error) toast.error(error);
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
    if (error) toast.error(error);
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
        title="Google Ads · Campanhas & termos"
        description={
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Operação diária do afiliado: métricas reais, orçamento inline, pausar/ativar, duplicar (com publicação) e
            termos de pesquisa com negativas — sem sair da Dclickora.
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
            <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Nova campanha Google</Link>
            </Button>
          </div>
        }
      />

      {connErr ? (
        <Alert className="mt-4">
          <AlertTitle>Métricas de rede indisponíveis</AlertTitle>
          <AlertDescription>{connErr}</AlertDescription>
        </Alert>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Fonte: {source || "—"}</p>
      )}

      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Pesquisar</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="w-[240px] pl-8"
                  placeholder="Nome ou ID Google"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Estado local</p>
              <Select value={st} onValueChange={setSt}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excluding_archived">Em trabalho</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="pending_publish">Pendente publicação</SelectItem>
                  <SelectItem value="live">Publicada / activa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="error">Erro sync</SelectItem>
                  <SelectItem value="archived">Arquivada (local)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          {loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha Google neste filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>ID Google</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Orçamento/dia</TableHead>
                    <TableHead>Impr.</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>CPC</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Conv.</TableHead>
                    <TableHead>CPA</TableHead>
                    <TableHead>ROAS</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const m = c.metrics;
                    const busy = busyId === c.id;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-[14rem] font-medium">
                          <span className="line-clamp-2">{c.name}</span>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{c.bidding_strategy || "—"}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{c.external_campaign_id || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {campaignStatusLabel(c.local_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.daily_budget_micros != null ? formatUsdFromMicros(c.daily_budget_micros) : "—"}
                        </TableCell>
                        <TableCell>{m ? fmtNum(m.impressions) : "—"}</TableCell>
                        <TableCell>{m ? fmtNum(m.clicks) : "—"}</TableCell>
                        <TableCell>{m ? fmtPct(m.ctr) : "—"}</TableCell>
                        <TableCell>{m ? formatUsdFromMicros(m.average_cpc_micros) : "—"}</TableCell>
                        <TableCell>{m ? formatUsdFromMicros(m.cost_micros) : "—"}</TableCell>
                        <TableCell>{m ? fmtNum(m.conversions, 1) : "—"}</TableCell>
                        <TableCell>{m ? formatUsdFromMicros(m.cost_per_conversion_micros) : "—"}</TableCell>
                        <TableCell>{m ? fmtNum(m.roas, 2) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button variant="secondary" size="sm" className="h-8" asChild>
                              <Link to={`/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`}>Gestão</Link>
                            </Button>
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
                            {c.external_campaign_id ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={busy}
                                title="Alterar orçamento"
                                onClick={() => void onBudget(c.id, c.daily_budget_micros)}
                              >
                                <Wallet className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            {c.external_campaign_id && c.local_status === "live" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={busy}
                                onClick={() => void studioAction(c.id, "pause_campaign")}
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            {c.external_campaign_id && c.local_status === "paused" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={busy}
                                onClick={() => void studioAction(c.id, "resume_campaign")}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={busy || c.local_status === "archived"}
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
  return (
    <InventoryTablePage
      title="Google Ads · Anúncios (RSA)"
      description="Responsive Search Ads geridos neste projecto. Estado de aprovação Google é consultado no estúdio após publicação."
      kind="ads"
    />
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

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await paidAdsService.getGoogleAdsKeywordMetrics(projectId, { preset });
    if (error) toast.error(error);
    else {
      setRows(data?.keywords ?? []);
      setConnErr(data?.connection_error ?? null);
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
            Métricas reais por keyword (GAQL). Pause perdedoras aqui; edite/adicione no estúdio da campanha.
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

  const onBudget = async (campaignId: string, currentMicros: number | null) => {
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
            Ajuste diário com protecção de orçamento partilhado (API). Compara orçamento vs custo dos últimos 7 dias.
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
                      {c.daily_budget_micros != null ? formatUsdFromMicros(c.daily_budget_micros) : "—"}
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
                            disabled={busyId === c.id}
                            onClick={() => void onBudget(c.id, c.daily_budget_micros)}
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
  const { projectId, overview } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof integrationsService.getGoogleAdsSettings>>["data"]>(
    null,
  );
  const paidCustomer = overview?.connection?.google_customer_id ?? null;

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await integrationsService.getGoogleAdsSettings();
      setSettings(data ?? null);
      setLoading(false);
    })();
  }, []);

  const sameCustomer =
    paidCustomer &&
    settings?.google_ads_customer_id &&
    paidCustomer.replace(/\D/g, "") === settings.google_ads_customer_id.replace(/\D/g, "");

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Conversões (tracking)"
        description={
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Feche o ciclo afiliado aqui: estado do upload de conversões (gclid/gbraid/wbraid) ao lado da conta Paid deste
            projecto. Sem eventos fictícios nem PII proibida.
          </p>
        }
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload de conversões (Stack afiliado)</CardTitle>
            <CardDescription>OAuth do utilizador · Integrações Google Ads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <ul className="space-y-1.5 text-xs">
                <li>Conta Google: {settings?.has_refresh_token ? "ligada" : "não ligada"}</li>
                <li>Customer ID: {settings?.google_ads_customer_id || "—"}</li>
                <li>Conversion action: {settings?.google_ads_conversion_action_id || "—"}</li>
                <li>Upload pronto: {settings?.can_upload ? "sim" : "não"}</li>
                <li>API env: {settings?.api_env_configured ? "ok" : "em falta"}</li>
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/integracoes/google-ads">Configurar / bootstrap</Link>
              </Button>
              {!settings?.can_upload ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const { data, error } = await integrationsService.bootstrapGoogleAds();
                    if (error) toast.error(error);
                    else {
                      toast.success(data?.detail || "Bootstrap concluído");
                      const again = await integrationsService.getGoogleAdsSettings();
                      setSettings(again.data ?? null);
                    }
                  }}
                >
                  Correr bootstrap
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conta Paid (este projecto)</CardTitle>
            <CardDescription>OAuth do Dpilot · gestão de campanhas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-1.5 text-xs">
              <li>Customer ID Paid: {paidCustomer || "—"}</li>
              <li>
                Alinhamento com upload:{" "}
                {sameCustomer === true
                  ? "mesmo customer — ideal"
                  : sameCustomer === false
                    ? "customers diferentes — confirme se é intencional (MCC / contas distintas)"
                    : "—"}
              </li>
            </ul>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Ver conversões por campanha</Link>
            </Button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              As duas ligações OAuth são intencionais (stacks separados). O afiliado configura ambas uma vez e opera
              campanhas + vendas sem saltar para a consola Google no dia a dia.
            </p>
          </CardContent>
        </Card>
      </div>
    </Gate>
  );
}

export function DpilotGoogleReportsPage() {
  const { projectId } = useDpilotPaid();
  const [preset, setPreset] = useState("last_7");
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<
    NonNullable<Awaited<ReturnType<typeof paidAdsService.getGoogleAdsDevicePerformance>>["data"]>["devices"]
  >([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsDevicePerformance(projectId, { preset });
    if (error) setErr(error);
    else setDevices(data?.devices ?? []);
    setLoading(false);
  }, [projectId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Gate>
      <PageHeader
        title="Google Ads · Relatórios"
        description={
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            Desempenho real por dispositivo (GAQL). Campanha/CSV e série diária no hub e no estúdio.
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <PeriodSelect value={preset} onChange={setPreset} />
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>Por campanha</Link>
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
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Por dispositivo</CardTitle>
          <CardDescription>Mobile / desktop / tablet — custo, cliques e conversões no período.</CardDescription>
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
