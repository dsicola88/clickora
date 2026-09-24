import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { buildTrackedPresellUrl, campaignsService } from "@/services/campaignsService";
import { customDomainService } from "@/services/customDomainService";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [spendDraft, setSpendDraft] = useState<string | null>(null);

  const { data: campaign, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await campaignsService.getById(id!);
      if (error) throw new Error(error);
      return data!;
    },
  });

  const { data: customDomains = [] } = useQuery({
    queryKey: ["custom-domain"],
    queryFn: async () => {
      const { data, error } = await customDomainService.list();
      if (error) return [];
      return data ?? [];
    },
  });

  const activate = useMutation({
    mutationFn: async () => {
      const { error } = await campaignsService.update(id!, { status: "active" });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns", id] });
      toast.success("Campanha activa");
    },
  });

  const saveSpend = useMutation({
    mutationFn: async (amount: number | null) => {
      const { error } = await campaignsService.update(id!, {
        spend_amount: amount,
        spend_currency: "EUR",
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
      setSpendDraft(null);
      toast.success("Gasto actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingState message="A carregar campanha…" />;
  if (isError || !campaign) {
    return <ErrorState message="Campanha não encontrada." onRetry={() => refetch()} />;
  }

  const publicBase = campaign.presell_id
    ? getPublicPresellFullUrl(customDomains, null, { id: campaign.presell_id })
    : null;
  const trackedUrl =
    publicBase && campaign.name
      ? buildTrackedPresellUrl(publicBase, campaign.name, campaign.traffic_source)
      : null;

  const copyLink = async () => {
    if (!trackedUrl) {
      toast.error("Associe uma presell publicada para copiar o link.");
      return;
    }
    await navigator.clipboard.writeText(trackedUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const spendValue =
    spendDraft !== null
      ? spendDraft
      : campaign.spend_amount != null
        ? String(campaign.spend_amount)
        : "";
  const stats = campaign.stats;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title={campaign.name}
        description={`${campaign.traffic_source}${campaign.country ? ` · ${campaign.country}` : ""}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/campanhas">Voltar</Link>
          </Button>
        }
      />

      <Tabs defaultValue="resumo">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="presell">Presell</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Estado:{" "}
              <span className="font-medium text-foreground">
                {campaign.status === "active"
                  ? "Activa"
                  : campaign.status === "draft"
                    ? "Rascunho"
                    : campaign.status === "paused"
                      ? "Pausada"
                      : campaign.status}
              </span>
            </p>
            {campaign.offer_url ? (
              <p className="text-sm break-all">
                <span className="text-muted-foreground">Oferta: </span>
                {campaign.offer_url}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {campaign.status !== "active" ? (
                <Button onClick={() => activate.mutate()} disabled={activate.isPending}>
                  Activar campanha
                </Button>
              ) : null}
              <Button variant="secondary" className="gap-2" onClick={() => void copyLink()} disabled={!trackedUrl}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copiar link do anúncio
              </Button>
            </div>
            {trackedUrl ? (
              <p className="text-xs font-mono text-muted-foreground break-all border-t border-border/40 pt-3">
                {trackedUrl}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Associe uma presell publicada para gerar o link rastreável automaticamente.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <Label htmlFor="spend">Gasto de ads (período que está a analisar)</Label>
            <p className="text-xs text-muted-foreground">
              Meta/TikTok/Google sem API: indique aqui o gasto do mesmo período dos Resultados para ver lucro, ROAS e CPA.
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <Input
                id="spend"
                type="number"
                min={0}
                step="0.01"
                className="max-w-[160px]"
                value={spendValue}
                onChange={(e) => setSpendDraft(e.target.value)}
                placeholder="0.00"
              />
              <Button
                disabled={saveSpend.isPending}
                onClick={() => {
                  const raw = spendValue.trim();
                  if (!raw) {
                    saveSpend.mutate(null);
                    return;
                  }
                  const n = Number(raw.replace(",", "."));
                  if (!Number.isFinite(n) || n < 0) {
                    toast.error("Gasto inválido");
                    return;
                  }
                  saveSpend.mutate(n);
                }}
              >
                Guardar gasto
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="presell" className="mt-4 space-y-3">
          {campaign.presell ? (
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <p className="font-medium">{campaign.presell.title}</p>
              <p className="text-sm text-muted-foreground">
                Estado:{" "}
                {campaign.presell.status === "published"
                  ? "Publicada"
                  : campaign.presell.status === "draft"
                    ? "Rascunho"
                    : campaign.presell.status === "paused"
                      ? "Pausada"
                      : campaign.presell.status}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/presells">Gerir em Presells</Link>
                </Button>
                {campaign.presell.status === "published" ? (
                  <Button variant="outline" asChild>
                    <a
                      href={`/p/${campaign.presell.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir página pública
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Ainda sem presell ligada.</p>
              <Button onClick={() => navigate("/presells/nova")}>Criar presell</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tracking" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <p className="text-sm font-semibold">Tracking</p>
            <ul className="space-y-2 text-sm">
              {[
                ["Estado", "Activo (automático no clique)"],
                ["Parâmetros do anúncio", "Aplicados ao copiar o link"],
                ["Click ID", "Inserido no redirect para a oferta"],
                ["Vendas da rede", "Via Integrações → Postback"],
              ].map(([k, v]) => (
                <li key={k} className="flex justify-between gap-4 border-b border-border/40 py-2 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right">{v}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link to="/integracoes/postback">Configurar postback</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/tracking/url-builder">
                  Construtor de URL <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-0">
                  Configurações avançadas
                  <ChevronDown className={`h-4 w-4 transition-transform ${advOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2 text-sm">
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                  <Link to="/integracoes">Hub de integrações</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto ml-0 sm:ml-2">
                  <Link to="/configuracoes?avancado=1">Diagnóstico e protecções</Link>
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>

        <TabsContent value="resultados" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Cliques", value: String(stats?.clicks ?? 0) },
              { label: "Conversões", value: String(stats?.conversions ?? 0) },
              { label: "Receita", value: money(stats?.revenue) },
              { label: "CVR", value: `${(stats?.conversion_rate ?? 0).toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%` },
              { label: "Gasto", value: money(campaign.spend_amount) },
              { label: "Lucro", value: money(stats?.profit) },
              {
                label: "ROAS",
                value: stats?.roas != null ? `${stats.roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—",
              },
              { label: "EPC", value: money(stats?.epc) },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-border/60 bg-card px-4 py-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Métricas dos últimos 14 dias, atribuídas pelo nome / utm_campaign desta campanha.
          </p>
          <Button asChild variant="outline">
            <Link to="/resultados">Ver conta completa</Link>
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
