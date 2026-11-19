/**
 * Ads Studio · hub de campanhas — painel profissional (KPIs + tabela operacional).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  campaignPlatformLabel,
  campaignStatusLabel,
  formatUsdFromMicros,
} from "@/lib/paidAdsUi";
import { cn } from "@/lib/utils";
import { paidAdsService, type CampaignRow } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DpilotCampaignArchiveButton } from "./DpilotCampaignArchiveButton";

type GoogleMetricsRow = NonNullable<
  Awaited<ReturnType<typeof paidAdsService.getGoogleAdsCampaignsMetrics>>["data"]
>["campaigns"][number];

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function fmtNum(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function manageHref(projectId: string, c: CampaignRow) {
  if (c.platform === "google_ads") return `/tracking/dpilot/p/${projectId}/campanhas/${c.id}/google`;
  if (c.platform === "meta_ads") return `/tracking/dpilot/p/${projectId}/meta`;
  if (c.platform === "tiktok_ads") return `/tracking/dpilot/p/${projectId}/tiktok`;
  return `/tracking/dpilot/p/${projectId}/campanhas`;
}

export function DpilotCampaignsHub() {
  const { campaigns, projectId, reload, overview, isConnConnected } = useDpilotPaid();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignFocus = searchParams.get("campaign");
  const platFromUrl = searchParams.get("plat");

  const [q, setQ] = useState("");
  const [st, setSt] = useState<"all" | "live" | "paused" | "draft">("all");
  const [plat, setPlat] = useState<"all" | "google_ads" | "meta_ads" | "tiktok_ads">(() => {
    if (platFromUrl === "google_ads" || platFromUrl === "meta_ads" || platFromUrl === "tiktok_ads") {
      return platFromUrl;
    }
    return "all";
  });

  useEffect(() => {
    if (platFromUrl === "google_ads" || platFromUrl === "meta_ads" || platFromUrl === "tiktok_ads") {
      setPlat(platFromUrl);
    } else if (!platFromUrl) {
      setPlat("all");
    }
  }, [platFromUrl]);

  const setPlatFilter = (next: "all" | "google_ads" | "meta_ads" | "tiktok_ads") => {
    setPlat(next);
    const sp = new URLSearchParams(searchParams);
    if (next === "all") sp.delete("plat");
    else sp.set("plat", next);
    setSearchParams(sp, { replace: true });
  };
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [googleById, setGoogleById] = useState<Map<string, GoogleMetricsRow>>(new Map());
  const [connErr, setConnErr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    const { data, error } = await paidAdsService.getGoogleAdsCampaignsMetrics(projectId, {
      preset: "last_7",
    });
    if (error) {
      setConnErr(error);
      setConnected(false);
      setGoogleById(new Map());
    } else {
      setConnected(Boolean(data?.connected));
      setConnErr(data?.connection_error ?? null);
      const map = new Map<string, GoogleMetricsRow>();
      for (const row of data?.campaigns ?? []) map.set(row.id, row);
      setGoogleById(map);
    }
    setLoadingMetrics(false);
  }, [projectId]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (!campaignFocus) return;
    const t = window.setTimeout(() => {
      document.getElementById(`dpilot-campaign-${campaignFocus}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    return () => clearTimeout(t);
  }, [campaignFocus, campaigns]);

  const workList = useMemo(
    () => campaigns.filter((c) => c.status !== "archived"),
    [campaigns],
  );

  const kpis = useMemo(() => {
    const active = workList.filter((c) => c.status === "live").length;
    const paused = workList.filter((c) => c.status === "paused").length;
    let clicks = 0;
    let costMicros = 0;
    let conversions = 0;
    let conversionsValue = 0;
    let withMetrics = 0;
    for (const row of googleById.values()) {
      if (!row.metrics) continue;
      withMetrics += 1;
      clicks += row.metrics.clicks;
      costMicros += row.metrics.cost_micros;
      conversions += row.metrics.conversions;
      conversionsValue += row.metrics.conversions_value;
    }
    const cpaMicros = conversions > 0 ? costMicros / conversions : null;
    const costUsd = costMicros / 1e6;
    const roas = costUsd > 0 ? conversionsValue / costUsd : null;
    return {
      total: workList.length,
      active,
      paused,
      clicks,
      costMicros,
      conversions,
      cpaMicros,
      revenue: conversionsValue,
      roas,
      withMetrics,
    };
  }, [workList, googleById]);

  const filtered = useMemo(() => {
    let xs = workList;
    if (plat !== "all") xs = xs.filter((c) => c.platform === plat);
    if (st === "live") xs = xs.filter((c) => c.status === "live");
    else if (st === "paused") xs = xs.filter((c) => c.status === "paused");
    else if (st === "draft") xs = xs.filter((c) => c.status === "draft" || c.status === "pending_publish");
    const needle = q.trim().toLowerCase();
    if (needle) {
      xs = xs.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          (c.external_campaign_id ?? "").includes(needle),
      );
    }
    return xs;
  }, [workList, plat, st, q]);

  const paidOk = isConnConnected(overview?.connection);
  const accountLabel =
    (overview?.connection as { account_name?: string | null; google_customer_id?: string | null } | undefined)
      ?.account_name ||
    (overview?.connection as { google_customer_id?: string | null } | undefined)?.google_customer_id ||
    null;

  const syncAccount = async () => {
    setLinking(true);
    try {
      const { data, error } = await paidAdsService.googleLinkFromIntegrations(projectId, {
        import_campaigns: true,
      });
      if (error || !data) {
        toast.error(error || "Ligue primeiro em Integrações → Google.");
        return;
      }
      toast.success(
        data.import
          ? `Conta sincronizada · ${data.import.imported} campanha(s)`
          : "Conta sincronizada",
      );
      reload();
      void loadMetrics();
    } finally {
      setLinking(false);
    }
  };

  const studioAction = async (campaignId: string, action: "pause_campaign" | "resume_campaign") => {
    const label = action === "pause_campaign" ? "Pausar" : "Ativar";
    if (!window.confirm(`${label} esta campanha na Google Ads?`)) return;
    setBusyId(campaignId);
    const { error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, { action });
    setBusyId(null);
    if (error) toast.error(error);
    else {
      toast.success(`${label}: pedido enviado`);
      reload();
      void loadMetrics();
    }
  };

  const onBudget = async (campaignId: string, currentMicros: number | null, editable?: boolean) => {
    if (editable === false) {
      toast.error("Orçamento partilhado na Google — separe na consola antes de editar aqui.");
      return;
    }
    const current = currentMicros != null ? (currentMicros / 1e6).toFixed(2) : "";
    const raw = window.prompt("Novo orçamento diário (USD):", current);
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
      toast.success(`Orçamento ${usd.toFixed(2)} USD/dia — pedido enviado`);
      reload();
      void loadMetrics();
    }
  };

  const onDuplicate = async (id: string, name: string, currentBudgetMicros: number | null) => {
    const nextName = window.prompt("Nome da cópia:", `${name} (cópia)`);
    if (nextName == null) return;
    const budgetHint =
      currentBudgetMicros != null ? (currentBudgetMicros / 1e6).toFixed(2) : "";
    const budgetRaw = window.prompt("Orçamento diário USD (vazio = igual):", budgetHint);
    if (budgetRaw == null) return;
    const daily_budget_usd =
      budgetRaw.trim() === "" ? undefined : Number(budgetRaw.replace(",", "."));
    if (daily_budget_usd != null && (!Number.isFinite(daily_budget_usd) || daily_budget_usd <= 0)) {
      toast.error("Orçamento inválido.");
      return;
    }
    const publish = window.confirm("Enfileirar publicação na Google?\nOK = sim · Cancelar = só rascunho");
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
    reload();
    void loadMetrics();
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-[#1a73e8]/20 bg-gradient-to-br from-[#1a73e8]/[0.09] via-background to-background">
        <div className="relative p-5 sm:p-6">
          <PageHeader
            title="Ads Studio"
            description={
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Criar, editar, duplicar, pausar, ativar, alterar orçamentos, anúncios, palavras-chave e consultar
                relatórios — sem abrir o Google Ads.
              </p>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {paidOk && accountLabel ? (
                  <Badge variant="outline" className="font-mono text-[11px] font-normal">
                    {accountLabel}
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    reload();
                    void loadMetrics();
                  }}
                  disabled={loadingMetrics}
                >
                  {loadingMetrics ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/relatorios`}>Relatórios</Link>
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
        </div>
      </div>

      {!paidOk ? (
        <Alert className="mt-4 border-[#1a73e8]/30">
          <AlertTitle>Sincronizar conta Google</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Ligue uma vez em Integrações → Google; depois sincronize para métricas e campanhas live.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={linking} onClick={() => void syncAccount()}>
                {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Usar conta de Integrações
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/integracoes/google-ads">Integrações → Google</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : connErr ? (
        <Alert className="mt-4">
          <AlertTitle>Métricas Google limitadas</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-xs">{connErr}</p>
            <Button size="sm" variant="outline" disabled={linking} onClick={() => void syncAccount()}>
              Re-sincronizar token
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Campanhas" value={fmtNum(kpis.total)} />
        <Kpi label="Ativas" value={fmtNum(kpis.active)} />
        <Kpi label="Pausadas" value={fmtNum(kpis.paused)} />
        <Kpi
          label="Investimento"
          value={kpis.withMetrics ? formatUsdFromMicros(kpis.costMicros) : "—"}
          hint={connected ? "Últimos 7 dias" : "Sem sync Google"}
        />
        <Kpi label="Cliques" value={kpis.withMetrics ? fmtNum(kpis.clicks) : "—"} />
        <Kpi label="Conversões" value={kpis.withMetrics ? fmtNum(kpis.conversions, 1) : "—"} />
        <Kpi
          label="Custo / conv."
          value={kpis.cpaMicros != null ? formatUsdFromMicros(kpis.cpaMicros) : "—"}
        />
        <Kpi
          label="Receita · ROAS"
          value={
            kpis.withMetrics && (kpis.revenue > 0 || kpis.roas != null)
              ? `${
                  kpis.revenue > 0
                    ? kpis.revenue.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })
                    : "—"
                } · ${kpis.roas != null ? kpis.roas.toFixed(2) : "—"}`
              : "—"
          }
          hint="Quando a rede devolve valor"
        />
      </div>

      <Card className="mt-4 border-border/70 shadow-none">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "all" as const, label: `Todas ${workList.length}` },
                {
                  id: "live" as const,
                  label: `Ativas ${workList.filter((c) => c.status === "live").length}`,
                },
                {
                  id: "paused" as const,
                  label: `Pausadas ${workList.filter((c) => c.status === "paused").length}`,
                },
                {
                  id: "draft" as const,
                  label: `Rascunhos ${workList.filter((c) => c.status === "draft" || c.status === "pending_publish").length}`,
                },
              ]
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
            <div className="flex flex-wrap gap-1.5 sm:ml-2">
              {(
                [
                  { id: "all" as const, label: "Todas redes" },
                  { id: "google_ads" as const, label: "Google" },
                  { id: "meta_ads" as const, label: "Meta" },
                  { id: "tiktok_ads" as const, label: "TikTok" },
                ]
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setPlatFilter(chip.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                    plat === chip.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-[220px] pl-8"
                placeholder="Buscar campanha…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {loadingMetrics && googleById.size === 0 && workList.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma campanha neste filtro.</p>
              <Button className="mt-3" size="sm" asChild>
                <Link to={`/tracking/dpilot/p/${projectId}/campanhas/nova`}>Criar campanha</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Ativo</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Orçamento/dia</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Conv.</TableHead>
                    <TableHead>CPA</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const g = googleById.get(c.id);
                    const m = g?.metrics;
                    const busy = busyId === c.id;
                    const canToggle =
                      c.platform === "google_ads" &&
                      Boolean(c.external_campaign_id) &&
                      (c.status === "live" || c.status === "paused");
                    const budgetMicros = g?.daily_budget_micros ?? c.daily_budget_micros ?? null;
                    return (
                      <TableRow
                        key={c.id}
                        id={`dpilot-campaign-${c.id}`}
                        className={campaignFocus === c.id ? "bg-[#1a73e8]/5" : undefined}
                      >
                        <TableCell>
                          {canToggle ? (
                            <Switch
                              checked={c.status === "live"}
                              disabled={busy}
                              aria-label={c.status === "live" ? "Pausar" : "Ativar"}
                              onCheckedChange={(on) =>
                                void studioAction(c.id, on ? "resume_campaign" : "pause_campaign")
                              }
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[16rem]">
                          <Link
                            to={manageHref(projectId, c)}
                            className="font-medium text-[#1a73e8] hover:underline line-clamp-2"
                          >
                            {c.name}
                          </Link>
                          {g?.bidding_strategy ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{g.bidding_strategy}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {campaignPlatformLabel(c.platform)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {campaignStatusLabel(c.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.platform === "google_ads" && c.external_campaign_id ? (
                            <button
                              type="button"
                              className="text-left text-sm hover:underline disabled:opacity-50"
                              disabled={busy || g?.budget_editable === false}
                              onClick={() => void onBudget(c.id, budgetMicros, g?.budget_editable)}
                            >
                              {budgetMicros != null ? formatUsdFromMicros(budgetMicros) : "—"}
                            </button>
                          ) : (
                            <span className="text-sm">
                              {budgetMicros != null ? formatUsdFromMicros(budgetMicros) : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {m ? fmtNum(m.clicks) : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {m ? formatUsdFromMicros(m.cost_micros) : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {m ? fmtNum(m.conversions, 1) : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {m ? formatUsdFromMicros(m.cost_per_conversion_micros) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button variant="secondary" size="sm" className="h-8" asChild>
                              <Link to={manageHref(projectId, c)}>Gerir</Link>
                            </Button>
                            {c.platform === "google_ads" && c.status !== "archived" ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={busy || !c.external_campaign_id}
                                  title="Orçamento"
                                  onClick={() => void onBudget(c.id, budgetMicros, g?.budget_editable)}
                                >
                                  <Wallet className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={busy}
                                  title="Duplicar"
                                  onClick={() => void onDuplicate(c.id, c.name, budgetMicros)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : null}
                            <DpilotCampaignArchiveButton
                              projectId={projectId}
                              campaign={c}
                              reload={reload}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Clique no nome ou em <span className="font-medium text-foreground/80">Gerir</span> para anúncios,
            palavras-chave e configuração. Métricas Google: últimos 7 dias.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
