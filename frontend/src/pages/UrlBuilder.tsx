import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Check, Plus, X, ChevronsUpDown, ChevronDown, ExternalLink, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { cn } from "@/lib/utils";
import { getUrlBuilderPlatformList } from "@/lib/marketingPlatforms";
import { orderedAdNetworkTokenSections } from "@/lib/adNetworkDynamicTokens";
import { AdNetworkTokensPickerPanel } from "@/components/tracking/AdNetworkTokensPickerPanel";
import { AdNetworkTokensReferenceDialog } from "@/components/tracking/AdNetworkTokensReferenceDialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** Plataformas (Integrações) + redes de tráfego + Personalizado — ver `marketingPlatforms.ts`. */
const URL_BUILDER_PLATFORMS = getUrlBuilderPlatformList();

function isAbsoluteHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Chaves de ID de clique — negrito + sublinhado no URL final. */
const CLICK_ID_QUERY_KEYS = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "fbclid",
  "ttclid",
  "tblci",
  "obclid",
  "epik",
  "clickid",
  "twclid",
]);

function highlightGeneratedUrlPreview(url: string): ReactNode {
  if (!url) return null;
  const qIdx = url.indexOf("?");
  if (qIdx === -1) {
    return <span className="whitespace-pre-wrap break-all">{url}</span>;
  }
  const base = url.slice(0, qIdx + 1);
  const query = url.slice(qIdx + 1);
  const parts = query.split("&");
  return (
    <span className="whitespace-pre-wrap break-all">
      {base}
      {parts.map((part, i) => {
        const eq = part.indexOf("=");
        const rawKey = eq >= 0 ? part.slice(0, eq) : part;
        let key = rawKey;
        try {
          key = decodeURIComponent(rawKey);
        } catch {
          key = rawKey;
        }
        const emphasize = CLICK_ID_QUERY_KEYS.has(key.toLowerCase());
        return (
          <span key={`${i}-${part.slice(0, 24)}`}>
            {i > 0 ? "&" : null}
            {emphasize ? (
              <strong className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-[3px]">
                {part}
              </strong>
            ) : (
              part
            )}
          </span>
        );
      })}
    </span>
  );
}

// Default param rows per platform
const defaultParams: Record<string, { key: string; value: string; highlight?: boolean }[]> = {
  "AdCombo": [
    { key: "subacc", value: "" },
    { key: "subacc2", value: "" },
    { key: "subacc3", value: "" },
    { key: "subacc4", value: "" },
    { key: "clickid", value: "", highlight: true },
  ],
  "Google Ads": [
    { key: "utm_source", value: "google" },
    { key: "utm_medium", value: "cpc" },
    { key: "utm_campaign", value: "{campaignid}" },
    { key: "utm_content", value: "{creative}" },
    { key: "utm_term", value: "{keyword}" },
    { key: "sub1", value: "{matchtype}" },
    { key: "sub2", value: "{device}" },
    { key: "sub3", value: "{network}" },
    { key: "gclid", value: "{gclid}", highlight: true },
    { key: "gbraid", value: "{gbraid}" },
    { key: "wbraid", value: "{wbraid}" },
  ],
  "Facebook Ads": [
    { key: "utm_source", value: "facebook" },
    { key: "utm_medium", value: "cpc" },
    { key: "utm_campaign", value: "{{campaign.name}}" },
    { key: "utm_content", value: "{{ad.name}}" },
    { key: "fbclid", value: "", highlight: true },
  ],
  "TikTok Ads": [
    { key: "utm_source", value: "tiktok" },
    { key: "utm_medium", value: "cpc" },
    { key: "utm_campaign", value: "{campaign_name}" },
    { key: "utm_content", value: "{adgroup_name}" },
    { key: "ttclid", value: "{ttclid}", highlight: true },
  ],
  "Bing Ads": [
    { key: "utm_source", value: "bing" },
    { key: "utm_medium", value: "cpc" },
    { key: "utm_campaign", value: "{CampaignId}" },
    { key: "utm_content", value: "{AdId}" },
    { key: "utm_term", value: "{keyword}" },
    { key: "msclkid", value: "{msclkid}", highlight: true },
  ],
  "Taboola": [
    { key: "utm_source", value: "taboola" },
    { key: "utm_medium", value: "native" },
    { key: "utm_campaign", value: "{campaign_name}" },
    { key: "tblci", value: "{click_id}", highlight: true },
  ],
  "Outbrain": [
    { key: "utm_source", value: "outbrain" },
    { key: "utm_medium", value: "native" },
    { key: "utm_campaign", value: "{campaign_name}" },
    { key: "obclid", value: "{ob_click_id}", highlight: true },
  ],
  "Pinterest Ads": [
    { key: "utm_source", value: "pinterest" },
    { key: "utm_medium", value: "cpc" },
    { key: "utm_campaign", value: "{campaign_name}" },
    { key: "epik", value: "{epik}", highlight: true },
  ],
  "Kwai Ads": [
    { key: "utm_source", value: "kwai" },
    { key: "utm_medium", value: "cpc" },
    { key: "utm_campaign", value: "{campaign_name}" },
    { key: "clickid", value: "{click_id}", highlight: true },
  ],
  "Twitter Ads": [
    { key: "utm_source", value: "twitter" },
    { key: "utm_medium", value: "cpc" },
    { key: "utm_campaign", value: "" },
    { key: "twclid", value: "", highlight: true },
  ],
  "ClickBank": [
    { key: "hop", value: "" },
    { key: "tid", value: "" },
    { key: "sub1", value: "" },
    { key: "sub2", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "Hotmart": [
    { key: "src", value: "" },
    { key: "sck", value: "" },
    { key: "sub1", value: "" },
    { key: "sub2", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "Monetizze": [
    { key: "src", value: "" },
    { key: "sub1", value: "" },
    { key: "sub2", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "Eduzz": [
    { key: "src", value: "" },
    { key: "utm_source", value: "" },
    { key: "sub1", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "Kiwify": [
    { key: "src", value: "" },
    { key: "sub1", value: "" },
    { key: "sub2", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "Braip": [
    { key: "src", value: "" },
    { key: "sub1", value: "" },
    { key: "sub2", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "Digistore24": [
    { key: "aff", value: "" },
    { key: "cam", value: "" },
    { key: "sub1", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "MaxWeb": [
    { key: "s1", value: "" },
    { key: "s2", value: "" },
    { key: "s3", value: "" },
    { key: "clickid", value: "{gclid}", highlight: true },
  ],
  "Personalizado": [],
};

type ParamRow = { key: string; value: string; highlight?: boolean };

/** Query string (sem `?`) — valores com `{macro}` não são encodeados (Google ValueTrack). */
function buildTrackingQueryString(rows: ParamRow[]): string {
  const valid = rows.filter((p) => p.key.trim());
  if (valid.length === 0) return "";
  return valid
    .map((p) => {
      const encVal = (v: string) => (v.includes("{") ? v : encodeURIComponent(v));
      return `${encodeURIComponent(p.key.trim())}=${encVal(p.value)}`;
    })
    .join("&");
}

/** Presets específicos em falta: sub + UUID do clique (o servidor aceita `subid1`/`clickora_click_id` como UUID). */
const GENERIC_AFFILIATE_PARAM_DEFAULTS: ParamRow[] = [
  { key: "sub1", value: "" },
  { key: "sub2", value: "" },
  { key: "subid1", value: "", highlight: true },
];

export default function UrlBuilder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillFromQueryRef = useRef(false);
  const [showPresellWelcome, setShowPresellWelcome] = useState(false);
  const [presellOfferHint, setPresellOfferHint] = useState<string | null>(null);

  const [platform, setPlatform] = useState("");
  const [platformOpen, setPlatformOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [params, setParams] = useState<ParamRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedGoogleSuffix, setCopiedGoogleSuffix] = useState(false);
  const [tokenDialog, setTokenDialog] = useState<{ open: boolean; rowIndex: number }>({ open: false, rowIndex: -1 });
  const [macrosReferenceOpen, setMacrosReferenceOpen] = useState(false);

  useEffect(() => {
    if (prefillFromQueryRef.current) return;
    const base = searchParams.get("base")?.trim();
    const from = searchParams.get("from");
    const offer = searchParams.get("offer")?.trim();
    if (!base && from !== "presell") return;

    if (base && isAbsoluteHttpUrl(base)) setBaseUrl(base);
    if (from === "presell") {
      setShowPresellWelcome(true);
      if (offer && isAbsoluteHttpUrl(offer)) setPresellOfferHint(offer);
    }
    prefillFromQueryRef.current = true;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("base");
        next.delete("from");
        next.delete("offer");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const handlePlatformChange = (val: string) => {
    setPlatform(val);
    const preset = defaultParams[val];
    if (preset) {
      setParams([...preset]);
      return;
    }
    if (val === "Personalizado") {
      setParams([]);
      return;
    }
    setParams([...GENERIC_AFFILIATE_PARAM_DEFAULTS]);
  };

  const updateParam = (index: number, field: "key" | "value", val: string) => {
    setParams(prev => prev.map((p, i) => i === index ? { ...p, [field]: val } : p));
  };

  const addParam = () => {
    setParams(prev => [...prev, { key: "", value: "" }]);
  };

  const removeParam = (index: number) => {
    setParams(prev => prev.filter((_, i) => i !== index));
  };

  const insertToken = (token: string) => {
    if (tokenDialog.rowIndex >= 0) {
      updateParam(tokenDialog.rowIndex, "value", token);
    }
    setTokenDialog({ open: false, rowIndex: -1 });
  };

  const trackingQueryString = useMemo(() => buildTrackingQueryString(params), [params]);

  const generatedUrl = useMemo(() => {
    if (!baseUrl) return "";
    if (!trackingQueryString) return baseUrl;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${trackingQueryString}`;
  }, [baseUrl, trackingQueryString]);

  const handleCopy = () => {
    if (!generatedUrl) { toast.error("Preencha com uma URL válida"); return; }
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyGoogleAdsSuffix = () => {
    if (!trackingQueryString) {
      toast.error("Adicione parâmetros ou escolha Google Ads para gerar o sufixo.");
      return;
    }
    navigator.clipboard.writeText(trackingQueryString);
    setCopiedGoogleSuffix(true);
    toast.success("Sufixo copiado — cole no Google Ads (sufixo do URL final).");
    setTimeout(() => setCopiedGoogleSuffix(false), 2000);
  };

  const tokenSectionsOrdered = useMemo(() => orderedAdNetworkTokenSections(platform), [platform]);

  const flowSteps = [
    "Construtor de URL: defines o link da presell com UTMs e IDs de clique (ex.: gclid, fbclid, ttclid) conforme a plataforma escolhida.",
    "O visitante clica no anúncio; a rede substitui as macros pelos valores reais.",
    "A presell carrega com esses parâmetros — o tracking regista clique/impressão e guarda IDs no evento.",
    "No redirect para a oferta, o dclickora acrescenta clickora_click_id (UUID) ao URL do produto (ver também Integrações → Plataformas).",
    "Em venda aprovada, o postback HTTP (webhook em Integrações) envia o mesmo identificador de clique (UUID em clickora_click_id / subid1 / aliases).",
    "A API valida o clique, cria a conversão em conversions e atualiza a presell.",
    "Com Google Ads ativo no Tracking, o gclid (ou gbraid/wbraid) guardado no clique pode ser enviado à API de conversões do Google.",
    "Com Microsoft/Bing, o msclkid fica no evento de clique; conversões por postback usam o webhook em Integrações (Microsoft Ads) com o mesmo msclkid quando a rede o enviar.",
  ];

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Construtor de URL"
        description="Monta o URL da presell com parâmetros da rede (UTMs, gclid, etc.). Alinha com Integrações → Plataformas e o webhook de postback de afiliados."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-violet-500/30 bg-violet-500/[0.06] hover:bg-violet-500/10"
            onClick={() => setMacrosReferenceOpen(true)}
          >
            <BookOpen className="h-4 w-4" /> Macros (referência)
          </Button>
        }
      />

      <AdNetworkTokensReferenceDialog
        open={macrosReferenceOpen}
        onOpenChange={setMacrosReferenceOpen}
        boostPlatformLabel={platform || undefined}
      />

      {showPresellWelcome ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 sm:px-5 space-y-2">
          <p className="text-sm font-semibold text-foreground">Seguinte passo: link para anúncios</p>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground/90">URL base</strong> abaixo é o link público da presell (
            <span className="font-mono text-[11px]">/p/…</span>). Escolha a plataforma (Google, Meta, etc.), mantenha os IDs
            de clique (ex. <span className="font-mono text-[11px]">gclid</span>) e copie o URL gerado para a campanha. O tráfego
            entra na presell com tracking; no botão da oferta usamos o teu link de afiliado e o redirect liga a conversão ao
            clique (postback em Integrações).
          </p>
          {presellOfferHint ? (
            <p className="text-[11px] text-muted-foreground leading-snug break-all border-t border-emerald-500/20 pt-2 mt-2">
              <span className="font-medium text-foreground/85">Link de afiliado na presell (referência): </span>
              {presellOfferHint}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-4 sm:px-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">Fluxo: tracking → oferta → postback</p>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Montas o link público da presell com UTMs e macros; no clique a rede preenche os IDs; o redirect acrescenta{" "}
          <span className="font-mono text-[11px]">clickora_click_id</span> na oferta; o postback em Integrações fecha a conversão.
        </p>
        <Collapsible defaultOpen={false} className="space-y-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-primary/15 bg-background/60 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-background/90 transition-colors [&[data-state=open]>svg]:rotate-180"
            >
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" aria-hidden />
              Ver passo a passo detalhado (8 pontos) e nota sobre URL final na rede
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 data-[state=closed]:animate-none">
            <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {flowSteps.map((s, i) => (
                <li key={i} className="pl-1 marker:text-primary marker:font-medium">
                  {s}
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-muted-foreground leading-snug border-t border-primary/10 pt-3">
              Cola em <strong className="text-foreground/90">URL final</strong> da campanha o endereço público da presell (ex.{" "}
              <span className="font-mono text-[10px]">https://dclickora.com/p/&lt;uuid-da-presell&gt;</span>
              ), não o link direto da rede. O script da presell e o redirect <span className="font-mono">/track/r/…</span> tratam do
              resto. Para ver estatística por anúncio, pode sufixar o link de clique:{" "}
              <span className="font-mono text-[10px]">…/track/r/&lt;uuid&gt;/fb/meu-anuncio?to=…</span> (até 10 níveis).
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        {/* Platform + Base URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="platform-combobox">Plataforma</Label>
            <Popover open={platformOpen} onOpenChange={setPlatformOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="platform-combobox"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={platformOpen}
                  className="w-full justify-between font-normal h-11 px-3"
                >
                  <span className={cn("truncate", !platform && "text-muted-foreground")}>
                    {platform || "Pesquisar ou escolher plataforma…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[min(28rem,calc(100vw-2rem))]" align="start">
                <Command>
                  <CommandInput placeholder="Filtrar plataformas…" className="h-11" />
                  <CommandList>
                    <CommandEmpty>Nenhuma plataforma encontrada.</CommandEmpty>
                    <CommandGroup>
                      {URL_BUILDER_PLATFORMS.map((p) => (
                        <CommandItem
                          key={p}
                          value={p}
                          onSelect={() => {
                            handlePlatformChange(p);
                            setPlatformOpen(false);
                          }}
                        >
                          {p}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">Escreve para filtrar a lista (autocompletar).</p>
          </div>
          <div className="space-y-2">
            <Label>URL base (presell pública)</Label>
            <Input
              placeholder="https://dclickora.com/p/uuid-da-presell"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            {platform === "Google Ads" && (
              <p className="text-[11px] text-muted-foreground">
                Usa o URL da página presell no teu site (rota <span className="font-mono">/p/…</span>). Os parâmetros abaixo incluem{" "}
                <strong className="font-mono text-foreground underline decoration-primary decoration-2 underline-offset-2">
                  gclid=&#123;gclid&#125;
                </strong>
                , ValueTrack em <span className="font-mono">utm_*</span> e <span className="font-mono">sub1–sub3</span> (
                <span className="font-mono">matchtype</span>, <span className="font-mono">device</span>, <span className="font-mono">network</span>
                ) para o Google preencher no clique.
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Params */}
        {platform && (
          <div className="space-y-3">
            <Label>Parâmetros</Label>
            {params.map((param, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg p-2 -mx-2 transition-colors",
                  param.highlight && "bg-primary/[0.08] border border-primary/25 border-l-4 border-l-primary shadow-sm",
                )}
              >
                {param.highlight ? (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary pl-0.5">
                    ID de clique — recomendado
                  </p>
                ) : null}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="min-w-[100px] shrink-0">
                  {param.highlight ? (
                    <Badge
                      variant="default"
                      className="text-xs font-mono px-3 py-1.5 bg-primary text-primary-foreground font-bold underline underline-offset-2 decoration-primary-foreground/80"
                    >
                      {param.key || "param"}
                    </Badge>
                  ) : (
                    <Input
                      value={param.key}
                      onChange={(e) => updateParam(i, "key", e.target.value)}
                      className="font-mono text-xs"
                      placeholder="chave"
                    />
                  )}
                </div>
                <Input
                  value={param.value}
                  onChange={(e) => updateParam(i, "value", e.target.value)}
                  className={cn(
                    "font-mono text-xs flex-1 min-w-0",
                    param.highlight && "border-primary/40 bg-background/80 font-medium",
                  )}
                  placeholder={
                    param.highlight
                      ? "Usa + para escolher ou escreve à mão"
                      : param.key === "gbraid" || param.key === "wbraid"
                        ? "Opcional (iOS / apps)"
                        : "valor"
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-primary hover:text-primary/80"
                  onClick={() => setTokenDialog({ open: true, rowIndex: i })}
                  title="Escolher valor dinâmico"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeParam(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addParam} className="mt-1">
              <Plus className="h-3 w-3 mr-1" /> Adicionar parâmetro
            </Button>
          </div>
        )}

        {platform === "Google Ads" && trackingQueryString ? (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-4 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Sufixo para colar no Google Ads</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No Google Ads, no <strong className="text-foreground/90">URL final</strong> use só o endereço da presell (ex.{" "}
                <span className="font-mono text-[10px]">https://…/p/…</span> <strong className="text-foreground/90">sem</strong> parâmetros). Em{" "}
                <strong className="text-foreground/90">Opções do URL da campanha</strong> (ou do grupo / anúncio) abra{" "}
                <strong className="text-foreground/90">Sufixo do URL final</strong> e cole a linha abaixo —{" "}
                <strong className="text-foreground/90">sem</strong> <span className="font-mono">?</span> no início. O Google junta isto ao URL
                final no clique e substitui <span className="font-mono">{"{…}"}</span> pelos valores ValueTrack.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
              <div
                className="flex min-h-[4.5rem] flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground break-all shadow-sm"
                role="status"
              >
                {trackingQueryString}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 gap-2 sm:self-start"
                onClick={handleCopyGoogleAdsSuffix}
              >
                {copiedGoogleSuffix ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copiedGoogleSuffix ? "Copiado" : "Copiar sufixo"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Generated URL */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL gerado (IDs de clique em negrito e sublinhados)</Label>
          <div className="flex items-stretch gap-2">
            <div
              role="status"
              aria-label="URL gerada"
              className={cn(
                "flex min-h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground shadow-sm",
                !generatedUrl && "text-muted-foreground",
              )}
            >
              {generatedUrl ? (
                highlightGeneratedUrlPreview(generatedUrl)
              ) : (
                "Indica o URL base da presell (https://…/p/…). Opcional: escolhe a plataforma para carregar UTMs e IDs de clique."
              )}
            </div>
            {generatedUrl && isAbsoluteHttpUrl(generatedUrl) ? (
              <Button variant="outline" size="icon" className="shrink-0 h-10 w-10" asChild title="Abrir num separador (teste)">
                <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="icon" className="shrink-0 h-10 w-10" onClick={handleCopy} title="Copiar URL">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Token Picker Dialog */}
      <Dialog open={tokenDialog.open} onOpenChange={(open) => setTokenDialog({ open, rowIndex: open ? tokenDialog.rowIndex : -1 })}>
        <DialogContent
          className="max-h-[90vh] flex flex-col gap-0 p-0 sm:max-w-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 text-left space-y-2">
            <DialogTitle className="text-lg">Escolher valor dinâmico</DialogTitle>
            <p className="text-sm text-muted-foreground font-normal leading-relaxed">
              Marcadores agrupados por rede (Google, Meta, Bing, etc.) — usa só os da plataforma onde vais criar o anúncio. A rede substitui pelo
              valor real no clique. Pesquisa pelo nome; o valor técnico aparece por baixo.
            </p>
          </DialogHeader>
          <div className="px-6 pb-6 flex-1 min-h-0 flex flex-col gap-3">
            <AdNetworkTokensPickerPanel
              sections={tokenSectionsOrdered}
              onSelect={insertToken}
              searchPlaceholder="Pesquisar (ex.: clique Google, nome da campanha, TikTok)…"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
