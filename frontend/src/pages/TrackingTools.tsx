import { useEffect, useState } from "react";
import { Search, MapPin, Key, Copy, Check, Globe, Loader2, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trackingService } from "@/services/trackingService";
import { analyticsService } from "@/services/analyticsService";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { countryDisplayLabel, countryFlagEmoji } from "@/lib/countryDisplay";

export default function Tracking() {
  const [ip, setIp] = useState("");
  const [gclidInput, setGclidInput] = useState("");
  const [ipLoading, setIpLoading] = useState(false);
  const [ipLookup, setIpLookup] = useState<{
    ip: string;
    found: boolean;
    message?: string;
    geo?: {
      country_code: string;
      region: string;
      city: string;
      timezone: string;
      latitude: number | null;
      longitude: number | null;
      eu: boolean;
      metro: number;
      area_km: number;
    };
  } | null>(null);
  const [gclidResult, setGclidResult] = useState<null | { campaignId: string; adGroupId: string; keyword: string; network: string }>(null);
  const [loadingGclid, setLoadingGclid] = useState(false);
  const [clickIdInput, setClickIdInput] = useState("");
  const [clickLookupLoading, setClickLookupLoading] = useState(false);
  const [clickLookup, setClickLookup] = useState<null | Record<string, unknown>>(null);
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

  const handleTrackIp = async () => {
    const v = ip.trim();
    if (!v) {
      toast.error("Insira um IP.");
      return;
    }
    setIpLoading(true);
    setIpLookup(null);
    try {
      const { data, error } = await trackingService.lookupIp(v);
      if (error) throw new Error(error);
      if (!data || !data.ok) throw new Error("Resposta inválida");
      setIpLookup({
        ip: data.ip,
        found: data.found,
        message: data.message,
        geo: data.geo,
      });
      if (data.found) {
        toast.success("Localização obtida (base GeoLite2).");
      } else {
        toast.info(data.message || "Sem dados para este IP.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao consultar IP";
      toast.error(msg);
      setIpLookup(null);
    } finally {
      setIpLoading(false);
    }
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

  const handleLookupClick = async () => {
    const id = clickIdInput.trim();
    if (!id) {
      toast.error("Cole o UUID do clique (Relatórios → Click ID).");
      return;
    }
    setClickLookupLoading(true);
    setClickLookup(null);
    try {
      const { data, error } = await analyticsService.getTrackingClick(id);
      if (error || !data) throw new Error(error || "Clique não encontrado");
      setClickLookup(data as unknown as Record<string, unknown>);
      toast.success("Clique encontrado.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha na consulta";
      toast.error(message);
    } finally {
      setClickLookupLoading(false);
    }
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
        description="Diagnóstico (IP, GCLID, UUID de clique, postbacks). Não substituem Relatórios nem Analytics."
      />

      <Tabs defaultValue="ip">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="ip" className="gap-2"><MapPin className="h-4 w-4" /> Rastrear IP</TabsTrigger>
          <TabsTrigger value="gclid" className="gap-2"><Key className="h-4 w-4" /> GCLID Decoder</TabsTrigger>
          <TabsTrigger value="clickid" className="gap-2"><Search className="h-4 w-4" /> Clique (UUID)</TabsTrigger>
          <TabsTrigger value="postbacks" className="gap-2"><Globe className="h-4 w-4" /> Postbacks</TabsTrigger>
        </TabsList>

        <TabsContent value="ip" className="mt-6">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
            <p className="text-sm text-muted-foreground">
              Consulta aproximada via <span className="text-foreground/90">GeoLite2</span> no servidor. Os dados são
              indicativos (não substituem prova legal); cidade e coordenadas podem errar, sobretudo em IPs de operadoras
              ou VPN. Em <span className="font-mono text-xs">IPv6</span> a base costuma ter só país, sem cidade. Para
              testar: <span className="font-mono text-xs">8.8.8.8</span>.
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>Endereço IP</Label>
                <Input
                  placeholder="Ex: 8.8.8.8"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTrackIp()}
                />
              </div>
              <Button
                type="button"
                onClick={handleTrackIp}
                disabled={ipLoading}
                className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
              >
                {ipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {ipLoading ? "A consultar…" : "Rastrear"}
              </Button>
            </div>

            {ipLookup ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/50 bg-muted/30 p-5 space-y-2">
                  <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" /> IP consultado
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-medium text-card-foreground">{ipLookup.ip}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => copyText("ip-consultado", ipLookup.ip)}
                    >
                      {copiedField === "ip-consultado" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copiar IP
                    </Button>
                  </div>
                </div>

                {!ipLookup.found ? (
                  <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3">
                    {ipLookup.message ??
                      "Sem dados de localização (rede privada, localhost ou IP sem entrada na base GeoLite)."}
                  </p>
                ) : ipLookup.geo ? (
                  <div className="rounded-xl border border-border/50 p-5 space-y-4 bg-card">
                    <div className="flex flex-wrap items-start gap-3">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl leading-none"
                        aria-hidden
                      >
                        {countryFlagEmoji(ipLookup.geo.country_code)}
                      </span>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">País</p>
                        <p className="text-lg font-semibold text-foreground">
                          {countryDisplayLabel(ipLookup.geo.country_code)}{" "}
                          <span className="text-sm font-mono font-normal text-muted-foreground">
                            ({ipLookup.geo.country_code})
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {[
                        { label: "Cidade", value: ipLookup.geo.city || "—" },
                        { label: "Região / estado (código)", value: ipLookup.geo.region || "—" },
                        { label: "Fuso horário", value: ipLookup.geo.timezone || "—" },
                        {
                          label: "Coordenadas (aprox.)",
                          value:
                            ipLookup.geo.latitude != null && ipLookup.geo.longitude != null
                              ? `${ipLookup.geo.latitude.toFixed(4)}, ${ipLookup.geo.longitude.toFixed(4)}`
                              : "—",
                        },
                        { label: "União Europeia", value: ipLookup.geo.eu ? "Sim" : "Não" },
                        {
                          label: "Precisão estimada (km)",
                          value:
                            ipLookup.geo.area_km != null && ipLookup.geo.area_km > 0
                              ? String(ipLookup.geo.area_km)
                              : "—",
                        },
                        ...(ipLookup.geo.metro > 0
                          ? [
                              {
                                label: "Metro / DMA (EUA)",
                                value: String(ipLookup.geo.metro),
                              },
                            ]
                          : []),
                      ].map((row) => (
                        <div key={row.label} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{row.label}</p>
                          <p className="font-medium text-foreground">{row.value}</p>
                        </div>
                      ))}
                    </div>
                    {ipLookup.geo.latitude != null && ipLookup.geo.longitude != null ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${ipLookup.geo.latitude}&mlon=${ipLookup.geo.longitude}&zoom=11`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Ver no mapa (OpenStreetMap)
                          </a>
                        </Button>
                      </div>
                    ) : null}
                    <div className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                      <Smartphone className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
                      <p>
                        <span className="font-medium text-foreground/90">Dispositivo:</span> não dá para saber só pelo IP
                        (móvel, tablet ou desktop). Esse dado vem do navegador nos{" "}
                        <span className="text-foreground/90">relatórios de cliques</span> quando há user-agent.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
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

        <TabsContent value="clickid" className="mt-6">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
            <p className="text-sm text-muted-foreground">
              Consulta um evento de <span className="text-foreground/90">clique</span> pelo UUID (coluna Click ID nos
              Relatórios). Útil para confirmar destino do rotador, sub-IDs, GCLID e IP.
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>UUID do clique</Label>
                <Input
                  placeholder="ex.: a1b2c3d4-…"
                  value={clickIdInput}
                  onChange={(e) => setClickIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookupClick()}
                  className="font-mono text-xs"
                />
              </div>
              <Button
                type="button"
                onClick={handleLookupClick}
                disabled={clickLookupLoading}
                className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
              >
                {clickLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {clickLookupLoading ? "A consultar…" : "Consultar"}
              </Button>
            </div>
            {clickLookup ? (
              <pre className="text-xs bg-muted/40 border border-border/50 rounded-lg p-4 overflow-x-auto max-h-[420px] overflow-y-auto">
                {JSON.stringify(clickLookup, null, 2)}
              </pre>
            ) : null}
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
