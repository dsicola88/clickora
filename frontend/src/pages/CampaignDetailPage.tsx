import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { buildTrackedPresellUrl, campaignsService } from "@/services/campaignsService";
import { customDomainService } from "@/services/customDomainService";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";
import { ChevronDown } from "lucide-react";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

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
              Estado: <span className="font-medium text-foreground">{campaign.status}</span>
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
        </TabsContent>

        <TabsContent value="presell" className="mt-4 space-y-3">
          {campaign.presell ? (
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <p className="font-medium">{campaign.presell.title}</p>
              <p className="text-sm text-muted-foreground">Estado: {campaign.presell.status}</p>
              <Button asChild>
                <Link to="/presells">Gerir em Presells</Link>
              </Button>
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
            <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-0">
                  Configurações avançadas
                  <ChevronDown className={`h-4 w-4 transition-transform ${advOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2 text-sm">
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                  <Link to="/integracoes">Postback e redes</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto ml-0 sm:ml-2">
                  <Link to="/configuracoes?avancado=1">Diagnóstico e protecções</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto ml-0 sm:ml-2">
                  <Link to={`/tracking/url-builder`}>
                    Opções manuais de URL <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>

        <TabsContent value="resultados" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Veja cliques, conversões e receita desta conta em Resultados.
            </p>
            <Button asChild>
              <Link to="/resultados">Abrir Resultados</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
