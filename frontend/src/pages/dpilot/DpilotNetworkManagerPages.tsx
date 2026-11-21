/**
 * Páginas do Campaign Manager Meta / TikTok (visão, campanhas, import).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, RefreshCw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GoogleAdsBudgetDialog } from "@/components/dpilot/GoogleAdsBudgetDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeStudioChangeRequestStatus, formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DpilotNetworksReadinessCard } from "./DpilotNetworksReadinessCard";

type Network = "meta" | "tiktok";

function fmt(n: number | null | undefined, d = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DpilotNetworkVisaoPage({ network }: { network: Network }) {
  const { projectId } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof paidAdsService.getMetaAdsOverview>
  >["data"]>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res =
      network === "meta"
        ? await paidAdsService.getMetaAdsOverview(projectId, { preset: "last_7" })
        : await paidAdsService.getTiktokAdsOverview(projectId, { preset: "last_7" });
    setError(res.error);
    setData(res.data ?? null);
    setLoading(false);
  }, [network, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const m = data?.metrics;
  const title = network === "meta" ? "Visão · Meta" : "Visão · TikTok";

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!data?.connected ? (
        <Alert>
          <AlertTitle>Conta não ligada</AlertTitle>
          <AlertDescription>
            {data?.connection_error ?? "Ligue OAuth nas ligações do projecto."}{" "}
            <Link className="underline" to={`/tracking/dpilot/p/${projectId}/ligacoes`}>
              Abrir ligações
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <DpilotNetworksReadinessCard projectId={projectId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Campanhas ligadas" value={fmt(data?.counts?.campaigns_linked)} />
        <Kpi label="Activas" value={fmt(data?.counts?.campaigns_live)} />
        <Kpi label="Pausadas" value={fmt(data?.counts?.campaigns_paused)} />
        <Kpi
          label="Custo 7d"
          value={m ? formatUsdFromMicros(m.cost_micros) : "—"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Cliques" value={m ? fmt(m.clicks) : "—"} />
        <Kpi label="Conv." value={m ? fmt(m.conversions, 1) : "—"} />
        <Kpi label="CTR" value={m ? `${(m.ctr * 100).toFixed(2)}%` : "—"} />
        <Kpi label="ROAS" value={m ? fmt(m.roas, 2) : "—"} />
      </div>
      <p className="text-xs text-muted-foreground">
        Fonte: {data?.source ?? "—"}. Período {data?.range?.from ?? "—"} → {data?.range?.to ?? "—"}.
      </p>
    </div>
  );
}

export function DpilotNetworkCampaignsManagerPage({ network }: { network: Network }) {
  const { projectId, reload } = useDpilotPaid();
  const netLabel = network === "meta" ? "Meta" : "TikTok";
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    NonNullable<
      Awaited<ReturnType<typeof paidAdsService.getMetaAdsCampaignsMetrics>>["data"]
    >["campaigns"]
  >([]);
  const [invTotals, setInvTotals] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [budgetDialog, setBudgetDialog] = useState<{
    campaignId: string;
    currentUsd: number | null;
  } | null>(null);
  const [attachDialog, setAttachDialog] = useState<{ campaignId: string; name: string } | null>(
    null,
  );
  const [attachLanding, setAttachLanding] = useState("");
  const [attachVideoUrl, setAttachVideoUrl] = useState("");
  const [attachAdText, setAttachAdText] = useState("");
  const [missingAdIds, setMissingAdIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const metricsRes =
      network === "meta"
        ? await paidAdsService.getMetaAdsCampaignsMetrics(projectId, { preset: "last_7" })
        : await paidAdsService.getTiktokAdsCampaignsMetrics(projectId, { preset: "last_7" });
    const invRes =
      network === "meta"
        ? await paidAdsService.getMetaAdsInventory(projectId)
        : await paidAdsService.getTiktokAdsInventory(projectId);
    setError(metricsRes.error ?? metricsRes.data?.network_error ?? null);
    setRows(metricsRes.data?.campaigns ?? []);
    setInvTotals(invRes.data?.totals ?? null);
    if (network === "tiktok" && invRes.data && "campaigns" in invRes.data) {
      const miss = new Set<string>();
      for (const c of invRes.data.campaigns) {
        if (
          "tiktok_ad_group_id" in c &&
          c.external_campaign_id &&
          c.tiktok_ad_group_id &&
          !c.tiktok_ad_id
        ) {
          miss.add(c.id);
        }
      }
      setMissingAdIds(miss);
    } else {
      setMissingAdIds(new Set());
    }
    setLoading(false);
  }, [network, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postAction = (id: string, body: Record<string, unknown>) =>
    network === "meta"
      ? paidAdsService.postMetaStudioActions(projectId, id, body)
      : paidAdsService.postTiktokStudioActions(projectId, id, body);

  const action = async (id: string, actionName: "pause_campaign" | "resume_campaign") => {
    setBusyId(id);
    const res = await postAction(id, { action: actionName });
    setBusyId(null);
    if (res.error) toast.error(res.error);
    else {
      const info = describeStudioChangeRequestStatus(res.data?.change_request?.status);
      if (info.kind === "failed") toast.error(info.message);
      else if (info.kind === "applied") {
        toast.success(
          actionName === "pause_campaign"
            ? `Pausa aplicada na ${netLabel}.`
            : `Activação aplicada na ${netLabel}.`,
        );
      } else toast.message(info.message);
      reload();
      void load();
    }
  };

  const confirmBudget = async (usd: number) => {
    if (!budgetDialog) return;
    const id = budgetDialog.campaignId;
    setBusyId(id);
    const res = await postAction(id, { action: "update_budget_usd", daily_budget_usd: usd });
    setBusyId(null);
    if (res.error) toast.error(res.error);
    else {
      const info = describeStudioChangeRequestStatus(res.data?.change_request?.status);
      if (info.kind === "failed") toast.error(info.message);
      else if (info.kind === "applied") {
        toast.success(`Orçamento ${usd.toFixed(2)} USD/dia na ${netLabel}.`);
      } else toast.message(info.message);
      setBudgetDialog(null);
      reload();
      void load();
    }
  };

  const confirmAttachAd = async () => {
    if (!attachDialog) return;
    const landing = attachLanding.trim();
    const videoUrl = attachVideoUrl.trim();
    if (!landing || !/^https?:\/\//i.test(landing)) {
      toast.error("Indique a landing Clickora (https://…/p/…).");
      return;
    }
    if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
      toast.error("Indique uma URL pública de vídeo ou imagem.");
      return;
    }
    const id = attachDialog.campaignId;
    setBusyId(id);
    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(videoUrl) || videoUrl.includes("video");
    const res = await paidAdsService.postTiktokStudioActions(projectId, id, {
      action: "publish_ad",
      landing_url: landing,
      ...(isVideo ? { video_url: videoUrl } : { image_url: videoUrl }),
      ...(attachAdText.trim() ? { ad_text: attachAdText.trim().slice(0, 100) } : {}),
    });
    setBusyId(null);
    if (res.error) toast.error(res.error);
    else {
      const info = describeStudioChangeRequestStatus(res.data?.change_request?.status);
      if (info.kind === "failed") toast.error(info.message);
      else if (info.kind === "applied") toast.success("Anúncio TikTok criado.");
      else toast.message(info.message);
      setAttachDialog(null);
      setAttachLanding("");
      setAttachVideoUrl("");
      setAttachAdText("");
      reload();
      void load();
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Campanhas · ${netLabel}`}
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to={`/tracking/dpilot/p/${projectId}/${network}/nova`}>Nova</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        }
      />
      {invTotals ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label="Campanhas" value={fmt(invTotals.campaigns)} />
          <Kpi label="Ligadas à rede" value={fmt(invTotals.linked)} />
          {network === "meta" ? (
            <>
              <Kpi label="Ad sets" value={fmt(invTotals.adsets)} />
              <Kpi label="Criativos" value={fmt(invTotals.creatives)} />
              <Kpi label="Anúncios" value={fmt(invTotals.ads)} />
            </>
          ) : (
            <>
              <Kpi label="Com ad group" value={fmt(invTotals.with_ad_group)} />
              <Kpi label="Com anúncio" value={fmt(invTotals.with_ad)} />
            </>
          )}
        </div>
      ) : null}
      {error ? (
        <Alert>
          <AlertTitle>Aviso</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Orçamento</TableHead>
              <TableHead>Cliques</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Conv.</TableHead>
              <TableHead className="text-right">Acções</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-muted-foreground">
                  Sem campanhas {netLabel}. Importe da rede ou crie uma nova.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const busy = busyId === c.id;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[14rem] font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {c.external_campaign_id ? (
                        <button
                          type="button"
                          className="hover:underline disabled:opacity-50"
                          disabled={busy}
                          onClick={() =>
                            setBudgetDialog({
                              campaignId: c.id,
                              currentUsd:
                                c.daily_budget_micros != null ? c.daily_budget_micros / 1e6 : null,
                            })
                          }
                        >
                          {c.daily_budget_micros != null
                            ? formatUsdFromMicros(c.daily_budget_micros)
                            : "Definir"}
                        </button>
                      ) : c.daily_budget_micros != null ? (
                        formatUsdFromMicros(c.daily_budget_micros)
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {c.metrics ? fmt(c.metrics.clicks) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {c.metrics ? formatUsdFromMicros(c.metrics.cost_micros) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {c.metrics ? fmt(c.metrics.conversions, 1) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.external_campaign_id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            title="Orçamento"
                            onClick={() =>
                              setBudgetDialog({
                                campaignId: c.id,
                                currentUsd:
                                  c.daily_budget_micros != null ? c.daily_budget_micros / 1e6 : null,
                              })
                            }
                          >
                            <Wallet className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {c.external_campaign_id && c.status === "live" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void action(c.id, "pause_campaign")}
                          >
                            Pausar
                          </Button>
                        ) : null}
                        {c.external_campaign_id && c.status === "paused" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void action(c.id, "resume_campaign")}
                          >
                            Activar
                          </Button>
                        ) : null}
                        {network === "tiktok" && missingAdIds.has(c.id) ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setAttachDialog({ campaignId: c.id, name: c.name });
                              setAttachLanding("");
                              setAttachVideoUrl("");
                              setAttachAdText(c.name.slice(0, 100));
                            }}
                          >
                            Anexar anúncio
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <GoogleAdsBudgetDialog
        open={budgetDialog != null}
        onOpenChange={(open) => {
          if (!open) setBudgetDialog(null);
        }}
        currentUsd={budgetDialog?.currentUsd ?? null}
        busy={budgetDialog != null && busyId === budgetDialog.campaignId}
        description={`Valor em USD. Confirme antes de aplicar na ${netLabel}.`}
        onConfirm={confirmBudget}
      />
      {attachDialog ? (
        <Card className="border-rose-500/30 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Anexar anúncio TikTok · {attachDialog.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Landing Clickora https://…/p/…"
              value={attachLanding}
              onChange={(e) => setAttachLanding(e.target.value)}
            />
            <Input
              placeholder="URL pública do vídeo (.mp4) ou imagem"
              value={attachVideoUrl}
              onChange={(e) => setAttachVideoUrl(e.target.value)}
            />
            <Input
              placeholder="Texto do anúncio (máx. 100)"
              value={attachAdText}
              onChange={(e) => setAttachAdText(e.target.value)}
              maxLength={100}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={busyId === attachDialog.campaignId}
                onClick={() => void confirmAttachAd()}
              >
                {busyId === attachDialog.campaignId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Publicar anúncio
              </Button>
              <Button type="button" variant="outline" onClick={() => setAttachDialog(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function DpilotNetworkImportPage({ network }: { network: Network }) {
  const { projectId, reload } = useDpilotPaid();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [landing, setLanding] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<
    Array<{
      external_campaign_id: string;
      name: string;
      status: string;
      already_imported: boolean;
      local_campaign_id: string | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res =
      network === "meta"
        ? await paidAdsService.listRemoteMetaCampaigns(projectId)
        : await paidAdsService.listRemoteTiktokCampaigns(projectId);
    setError(res.error);
    setRows(res.data?.campaigns ?? []);
    setSelected(new Set());
    setLoading(false);
  }, [network, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runImport = async () => {
    if (selected.size === 0) {
      toast.message("Seleccione pelo menos uma campanha.");
      return;
    }
    setImporting(true);
    const body = {
      external_campaign_ids: [...selected],
      refresh_existing: true,
      landing_url: landing.trim() || null,
    };
    const res =
      network === "meta"
        ? await paidAdsService.importMetaCampaigns(projectId, body)
        : await paidAdsService.importTiktokCampaigns(projectId, body);
    setImporting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Importadas: ${res.data?.imported.length ?? 0}`);
    if (res.data?.note) toast.message(res.data.note);
    reload();
    void load();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={network === "meta" ? "Importar · Meta" : "Importar · TikTok"}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        }
      />
      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Landing Clickora (recomendado)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="https://…/p/… (Final URL da presell — sem gclid manual)"
            value={landing}
            onChange={(e) => setLanding(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Guarda a URL no projecto local. CTAs da presell devem apontar a /track/r/ para atribuição.
          </p>
        </CardContent>
      </Card>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível listar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Campanha remota</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Local</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.external_campaign_id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(r.external_campaign_id)}
                    onCheckedChange={(v) => toggle(r.external_campaign_id, Boolean(v))}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{r.external_campaign_id}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.already_imported ? "Já importada" : "Nova"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" disabled={importing || selected.size === 0} onClick={() => void runImport()}>
        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Importar seleccionadas ({selected.size})
      </Button>
    </div>
  );
}
