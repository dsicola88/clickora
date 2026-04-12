import { useEffect, useState } from "react";
import { Search, MapPin, Key, Copy, Check, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trackingService } from "@/services/trackingService";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

export default function Tracking() {
  const [ip, setIp] = useState("");
  const [gclidInput, setGclidInput] = useState("");
  /** Echo do IP após "Rastrear" (a geolocalização por país nos eventos é feita no servidor e aparece no dashboard). */
  const [trackedIp, setTrackedIp] = useState<string | null>(null);
  const [gclidResult, setGclidResult] = useState<null | { campaignId: string; adGroupId: string; keyword: string; network: string }>(null);
  const [loadingGclid, setLoadingGclid] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [postbackTemplates, setPostbackTemplates] = useState<null | {
    token: string;
    endpoints: { google_ads: string; microsoft_ads: string };
  }>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [postbackAudit, setPostbackAudit] = useState<Array<{
    id: string;
    platform: string;
    status: string;
    message?: string | null;
    created_at: string;
    presell_id?: string | null;
  }>>([]);

  const handleTrackIp = () => {
    const v = ip.trim();
    if (!v) {
      toast.error("Insira um IP.");
      return;
    }
    setTrackedIp(v);
    toast.info("País por IP está no painel Tracking (cliques). Cidade/ISP aqui ainda não.");
  };

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      const { data } = await trackingService.getPostbackTemplates();
      if (data) setPostbackTemplates(data);
      const audit = await trackingService.getPostbackAudit(15);
      if (audit.data) setPostbackAudit(audit.data);
      setTemplatesLoading(false);
    };
    loadTemplates();
  }, []);

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleDecodeGclid = async () => {
    if (!gclidInput) { toast.error("Insira um GCLID."); return; }
    setLoadingGclid(true);
    try {
      const { data, error } = await trackingService.lookupGclid(gclidInput);
      if (error || !data) throw new Error(error || "GCLID não encontrado");
      setGclidResult({
        campaignId: data.campaign || "N/A",
        adGroupId: data.medium || "N/A",
        keyword: data.utm_term || "N/A",
        network: data.source || "N/A",
      });
      toast.success("GCLID encontrado no tracking!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao consultar GCLID";
      toast.error(message);
      setGclidResult(null);
    } finally {
      setLoadingGclid(false);
    }
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Tracking Tools"
        description="Use ferramentas avançadas para diagnóstico, GCLID e auditoria de postbacks."
      />

      <Tabs defaultValue="ip">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="ip" className="gap-2"><MapPin className="h-4 w-4" /> Rastrear IP</TabsTrigger>
          <TabsTrigger value="gclid" className="gap-2"><Key className="h-4 w-4" /> GCLID Decoder</TabsTrigger>
          <TabsTrigger value="postbacks" className="gap-2"><Globe className="h-4 w-4" /> Postbacks</TabsTrigger>
        </TabsList>

        <TabsContent value="ip" className="mt-6">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>Endereço IP</Label>
                <Input placeholder="Ex: 192.168.1.1" value={ip} onChange={(e) => setIp(e.target.value)} />
              </div>
              <Button onClick={handleTrackIp} className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Search className="h-4 w-4" /> Rastrear
              </Button>
            </div>

            {trackedIp && (
              <div className="bg-muted/30 rounded-xl p-5 space-y-2 border border-border/50">
                <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> IP indicado
                </h3>
                <p className="font-mono text-sm font-medium text-card-foreground">{trackedIp}</p>
                <p className="text-xs text-muted-foreground">
                  O país dos visitantes é inferido no servidor e mostrado em Tracking → resumo (cliques por país). Esta aba só confirma o IP que introduziste.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gclid" className="mt-6">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>GCLID</Label>
                <Input placeholder="Cole o GCLID aqui..." value={gclidInput} onChange={(e) => setGclidInput(e.target.value)} />
              </div>
              <Button onClick={handleDecodeGclid} disabled={loadingGclid} className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Key className="h-4 w-4" /> {loadingGclid ? "Consultando..." : "Decodificar"}
              </Button>
            </div>

            {gclidResult && (
              <div className="bg-muted/30 rounded-xl p-5 space-y-3 border border-border/50">
                <h3 className="font-semibold text-card-foreground">Informações Decodificadas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Campaign ID", value: gclidResult.campaignId },
                    { label: "Ad Group ID", value: gclidResult.adGroupId },
                    { label: "Palavra-chave", value: gclidResult.keyword },
                    { label: "Rede", value: gclidResult.network },
                  ].map((item) => (
                    <div key={item.label} className="bg-card rounded-lg p-3 border border-border/50">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-medium text-card-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="postbacks" className="mt-6">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
            <h3 className="font-semibold text-card-foreground">URLs de Postback por Cliente</h3>
            {templatesLoading ? <p className="text-sm text-muted-foreground">Carregando URLs...</p> : null}
            {!templatesLoading && postbackTemplates ? (
              <>
                <div className="space-y-2">
                  <Label>Token privado</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={postbackTemplates.token} className="font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={() => copyText("token", postbackTemplates.token)}>
                      {copiedField === "token" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Google Ads Postback URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={postbackTemplates.endpoints.google_ads} className="font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={() => copyText("google", postbackTemplates.endpoints.google_ads)}>
                      {copiedField === "google" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Microsoft Ads Postback URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={postbackTemplates.endpoints.microsoft_ads} className="font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={() => copyText("microsoft", postbackTemplates.endpoints.microsoft_ads)}>
                      {copiedField === "microsoft" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Auditoria recente de postbacks</Label>
                  <div className="max-h-64 overflow-auto rounded-md border border-border">
                    {postbackAudit.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">Sem eventos recentes.</p>
                    ) : (
                      postbackAudit.map((row) => (
                        <div key={row.id} className="p-3 border-b border-border/50 last:border-0 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium">{row.platform}</span>
                            <span className={row.status === "success" ? "text-green-600" : row.status === "duplicate" ? "text-amber-600" : "text-red-600"}>{row.status}</span>
                          </div>
                          <p className="text-muted-foreground">{new Date(row.created_at).toLocaleString("pt-BR")}</p>
                          {row.message ? <p>{row.message}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
