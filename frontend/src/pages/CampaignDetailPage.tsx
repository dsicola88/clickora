import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { buildTrackedPresellUrl, campaignsService } from "@/services/campaignsService";
import { customDomainService } from "@/services/customDomainService";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";
import { rangeLast14Days } from "@/lib/dateRangePresets";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProToolbar,
  ProKpiGrid,
  ProKpiCell,
  ProPanel,
  ProStatusDot,
  ProInlineLink,
} from "@/components/enterprise/ProShell";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function statusLabel(s: string) {
  if (s === "active") return "Activa";
  if (s === "draft") return "Rascunho";
  if (s === "paused") return "Pausada";
  return s;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [spendDraft, setSpendDraft] = useState<string | null>(null);
  const initial = useMemo(() => rangeLast14Days(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const { data: campaign, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns", id, from, to],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await campaignsService.getById(id!, { from, to });
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

  if (isLoading) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message="A carregar campanha…" />
      </div>
    );
  }
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
  const profit = stats?.profit;
  const roas = stats?.roas;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={campaign.name}
        subtitle={`${campaign.traffic_source}${campaign.country ? ` · ${campaign.country}` : ""} · stats por utm_campaign slug`}
        meta={
          <>
            <ProStatusDot ok={campaign.status === "active"} label={statusLabel(campaign.status)} />
            <span className="font-mono tabular-nums">
              {from} → {to}
            </span>
            <span>UTC</span>
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/campanhas">Todas as campanhas</Link>
          </Button>
        }
      />

      <ProToolbar>
        <DateRangeFilter
          from={from}
          to={to}
          showCompare={false}
          onApply={(p) => {
            setFrom(p.from);
            setTo(p.to);
          }}
        />
        {campaign.status !== "active" ? (
          <Button size="sm" onClick={() => activate.mutate()} disabled={activate.isPending}>
            Activar
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => void copyLink()}
          disabled={!trackedUrl}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar link anúncio
        </Button>
      </ProToolbar>

      <ProKpiGrid>
        <ProKpiCell label="Cliques" value={String(stats?.clicks ?? 0)} />
        <ProKpiCell label="Conversões" value={String(stats?.conversions ?? 0)} />
        <ProKpiCell label="Receita" value={money(stats?.revenue)} />
        <ProKpiCell
          label="CVR"
          value={`${(stats?.conversion_rate ?? 0).toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`}
        />
        <ProKpiCell label="Gasto manual" value={money(campaign.spend_amount)} hint="Lifetime / ficha" />
        <ProKpiCell
          label="Lucro"
          value={money(profit)}
          tone={profit != null && profit < 0 ? "negative" : profit != null && profit > 0 ? "positive" : undefined}
        />
        <ProKpiCell
          label="ROAS"
          value={roas != null ? `${roas.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}x` : "—"}
          hint="Com gasto manual"
        />
        <ProKpiCell label="EPC" value={money(stats?.epc)} />
      </ProKpiGrid>

      <Tabs defaultValue="operacao">
        <TabsList className="h-auto flex-wrap gap-1 bg-card border border-border/70 p-1">
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="presell">Presell</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ProPanel title="Link do anúncio" description="Presell pública + UTMs da campanha.">
              <div className="space-y-3 px-4 py-4">
                {campaign.offer_url ? (
                  <p className="text-xs break-all">
                    <span className="text-muted-foreground">Oferta: </span>
                    <span className="font-mono">{campaign.offer_url}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">Sem URL de oferta na ficha.</p>
                )}
                {trackedUrl ? (
                  <p className="text-[11px] font-mono text-muted-foreground break-all rounded-md border border-border/50 bg-muted/30 p-3">
                    {trackedUrl}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Associe uma presell publicada para gerar o link rastreável.
                  </p>
                )}
              </div>
            </ProPanel>

            <ProPanel
              title="Gasto manual"
              description="Meta/TikTok/Google sem sync: indique o gasto do período para lucro/ROAS nesta ficha. O P&L da conta usa custo sincronizado."
            >
              <div className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="spend" className="text-xs">
                      EUR
                    </Label>
                    <Input
                      id="spend"
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-[140px] h-9"
                      value={spendValue}
                      onChange={(e) => setSpendDraft(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    size="sm"
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
                    Guardar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Preferível: sync em <ProInlineLink to="/integracoes/automizer">Automizer & custos</ProInlineLink>{" "}
                  e leitura no <ProInlineLink to="/resultados">P&L</ProInlineLink>.
                </p>
              </div>
            </ProPanel>
          </div>
        </TabsContent>

        <TabsContent value="presell" className="mt-4">
          {campaign.presell ? (
            <ProPanel title={campaign.presell.title}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                <ProStatusDot
                  ok={campaign.presell.status === "published"}
                  label={
                    campaign.presell.status === "published"
                      ? "Publicada"
                      : campaign.presell.status === "draft"
                        ? "Rascunho"
                        : campaign.presell.status === "paused"
                          ? "Pausada"
                          : campaign.presell.status
                  }
                />
                <Button size="sm" asChild>
                  <Link to="/presells">Gerir Presells</Link>
                </Button>
                {campaign.presell.status === "published" ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/p/${campaign.presell.id}`} target="_blank" rel="noreferrer">
                      Abrir pública
                    </a>
                  </Button>
                ) : null}
              </div>
            </ProPanel>
          ) : (
            <ProPanel title="Presell">
              <div className="flex flex-col items-start gap-3 px-4 py-8">
                <p className="text-sm text-muted-foreground">Ainda sem presell ligada.</p>
                <Button size="sm" onClick={() => navigate("/presells/nova")}>
                  Criar presell
                </Button>
              </div>
            </ProPanel>
          )}
        </TabsContent>

        <TabsContent value="tracking" className="mt-4">
          <ProPanel title="Pipeline" description="Clique → redirect → postback → conversão.">
            <ul className="divide-y divide-border/50 text-sm">
              {[
                ["Estado", "Activo (automático no clique)"],
                ["Parâmetros do anúncio", "Aplicados ao copiar o link"],
                ["Click ID", "Inserido no redirect para a oferta"],
                ["Vendas da rede", "Via Integrações → Postback"],
              ].map(([k, v]) => (
                <li key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-medium text-right">{v}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/integracoes/postback">Postback</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/tracking/url-builder">
                  URL Builder <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
              <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    Avançado
                    <ChevronDown className={`h-4 w-4 transition-transform ${advOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/integracoes">Hub integrações</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/configuracoes?avancado=1">Diagnóstico</Link>
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ProPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
