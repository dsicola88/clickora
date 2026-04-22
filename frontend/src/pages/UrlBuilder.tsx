import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Copy, Check, Plus, X, ChevronsUpDown, ChevronDown, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { cn } from "@/lib/utils";
import { getUrlBuilderPlatformList } from "@/lib/marketingPlatforms";

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

/** Marcador que vai para o URL (valor técnico) + nome legível + texto para pesquisa. */
type TokenPick = { token: string; label: string; search: string };

type TokenSection = {
  id: string;
  title: string;
  items: TokenPick[];
};

/**
 * Uma secção = uma plataforma de anúncios. Tudo de Google junto; Meta separado de Microsoft/Bing; ordem fixa para navegação previsível.
 */
const TOKEN_SECTIONS: TokenSection[] = [
  {
    id: "google",
    title: "Google Ads · ValueTrack (só parâmetros Google)",
    items: [
      { token: "{gclid}", label: "ID do clique (gclid)", search: "gclid clique google ads conversão" },
      { token: "{gbraid}", label: "ID do clique iOS / app (gbraid)", search: "gbraid google app ios" },
      { token: "{wbraid}", label: "ID Web-to-app (wbraid)", search: "wbraid google" },
      { token: "{keyword}", label: "Palavra-chave (Google)", search: "keyword palavra chave google ads" },
      { token: "{campaignid}", label: "ID da campanha", search: "campaign campanha google" },
      { token: "{adgroupid}", label: "ID do grupo de anúncios", search: "adgroup grupo google" },
      { token: "{creative}", label: "ID do criativo / anúncio", search: "creative anúncio google" },
      { token: "{device}", label: "Tipo de dispositivo", search: "device telemóvel google" },
      { token: "{network}", label: "Rede (Pesquisa, Display…)", search: "network rede google" },
      { token: "{placement}", label: "Posição / site (placement)", search: "placement posição google" },
      { token: "{matchtype}", label: "Tipo de correspondência da keyword", search: "match correspondência google" },
      { token: "{extensionid}", label: "Extensão associada ao clique", search: "extension extensão google" },
      { token: "{target}", label: "Alvo do anúncio", search: "target alvo google" },
      { token: "{loc_physical_ms}", label: "Local físico (avançado)", search: "local físico google" },
      { token: "{loc_interest_ms}", label: "Interesse de localização (avançado)", search: "interesse local google" },
    ],
  },
  {
    id: "facebook",
    title: "Meta Ads · Facebook e Instagram (só parâmetros Meta)",
    items: [
      { token: "{fbclid}", label: "ID do clique (fbclid)", search: "fbclid meta facebook instagram clique" },
      { token: "{{campaign.name}}", label: "Nome da campanha", search: "meta facebook instagram campanha nome" },
      { token: "{{adset.name}}", label: "Nome do conjunto de anúncios", search: "meta conjunto adset" },
      { token: "{{ad.name}}", label: "Nome do anúncio", search: "meta anúncio ad" },
      { token: "{{campaign.id}}", label: "ID da campanha", search: "meta id campanha" },
      { token: "{{adset.id}}", label: "ID do conjunto", search: "meta adset id" },
      { token: "{{ad.id}}", label: "ID do anúncio", search: "meta ad id" },
      { token: "{{placement}}", label: "Onde o anúncio apareceu", search: "meta placement posição" },
      { token: "{{site_source_name}}", label: "Origem do site / app", search: "meta origem source instagram" },
    ],
  },
  {
    id: "microsoft",
    title: "Microsoft Advertising (Bing) · modelo de URL (só Bing)",
    items: [
      { token: "{msclkid}", label: "ID do clique (msclkid)", search: "msclkid bing microsoft clique" },
      { token: "{keyword}", label: "Palavra-chave (Bing — não confundir com Google)", search: "keyword bing microsoft palavra" },
      { token: "{QueryString}", label: "Texto da pesquisa (consulta)", search: "query bing pesquisa microsoft" },
      { token: "{CampaignId}", label: "ID da campanha (Bing)", search: "campaign bing microsoft" },
      { token: "{AdGroupId}", label: "ID do grupo de anúncios (Bing)", search: "adgroup bing microsoft" },
      { token: "{AdId}", label: "ID do anúncio (Bing)", search: "ad anúncio bing" },
      { token: "{Device}", label: "Dispositivo (Bing)", search: "device bing" },
      { token: "{MatchType}", label: "Tipo de correspondência (Bing)", search: "match bing" },
      { token: "{Network}", label: "Rede (Bing)", search: "network bing" },
      { token: "{feeditemid}", label: "ID do feed", search: "feed bing microsoft" },
    ],
  },
  {
    id: "tiktok",
    title: "TikTok Ads",
    items: [
      { token: "{ttclid}", label: "ID do clique (ttclid)", search: "ttclid tiktok clique" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "tiktok campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "tiktok id campanha" },
      { token: "{adgroup_name}", label: "Nome do grupo de anúncios", search: "tiktok grupo" },
      { token: "{adgroup_id}", label: "ID do grupo", search: "tiktok adgroup" },
      { token: "{ad_name}", label: "Nome do anúncio", search: "tiktok anúncio" },
      { token: "{ad_id}", label: "ID do anúncio", search: "tiktok ad id" },
      { token: "{placement}", label: "Posicionamento", search: "tiktok placement" },
    ],
  },
  {
    id: "taboola",
    title: "Taboola",
    items: [
      { token: "{click_id}", label: "ID do clique Taboola", search: "clique taboola" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "taboola campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "taboola id" },
      { token: "{site}", label: "Site", search: "taboola site" },
      { token: "{site_id}", label: "ID do site", search: "taboola site id" },
      { token: "{thumbnail}", label: "Miniatura", search: "taboola thumbnail" },
      { token: "{title}", label: "Título", search: "taboola título" },
    ],
  },
  {
    id: "outbrain",
    title: "Outbrain",
    items: [
      { token: "{ob_click_id}", label: "ID do clique Outbrain", search: "clique outbrain" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "outbrain campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "outbrain id" },
      { token: "{publisher_name}", label: "Nome do editor", search: "outbrain publisher" },
      { token: "{publisher_id}", label: "ID do editor", search: "outbrain publisher id" },
      { token: "{section_name}", label: "Nome da secção", search: "outbrain secção" },
    ],
  },
  {
    id: "kwai",
    title: "Kwai Ads",
    items: [
      { token: "{click_id}", label: "ID do clique Kwai", search: "clique kwai" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "kwai campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "kwai id" },
      { token: "{adgroup_name}", label: "Nome do grupo de anúncios", search: "kwai grupo" },
      { token: "{creative_id}", label: "ID do criativo", search: "kwai criativo" },
    ],
  },
  {
    id: "pinterest",
    title: "Pinterest Ads",
    items: [
      { token: "{epik}", label: "ID do clique (epik)", search: "pinterest epik clique" },
      { token: "{campaign_name}", label: "Nome da campanha", search: "pinterest campanha" },
      { token: "{campaign_id}", label: "ID da campanha", search: "pinterest id" },
    ],
  },
  {
    id: "twitter",
    title: "X (Twitter) Ads",
    items: [{ token: "{twclid}", label: "ID do clique (twclid)", search: "twitter x twclid clique" }],
  },
];

const PLATFORM_SECTION_BOOST: Record<string, string> = {
  "Google Ads": "google",
  "Facebook Ads": "facebook",
  "Bing Ads": "microsoft",
  "TikTok Ads": "tiktok",
  Taboola: "taboola",
  Outbrain: "outbrain",
  "Kwai Ads": "kwai",
  "Pinterest Ads": "pinterest",
  "Twitter Ads": "twitter",
};

function orderedTokenSections(selectedPlatform: string): TokenSection[] {
  const boostId = PLATFORM_SECTION_BOOST[selectedPlatform];
  if (!boostId) return TOKEN_SECTIONS;
  const idx = TOKEN_SECTIONS.findIndex((s) => s.id === boostId);
  if (idx <= 0) return TOKEN_SECTIONS;
  const copy = [...TOKEN_SECTIONS];
  const [picked] = copy.splice(idx, 1);
  return [picked, ...copy];
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

/** Presets específicos em falta: sub + UUID do clique (o servidor aceita `subid1`/`clickora_click_id` como UUID). */
const GENERIC_AFFILIATE_PARAM_DEFAULTS: ParamRow[] = [
  { key: "sub1", value: "" },
  { key: "sub2", value: "" },
  { key: "subid1", value: "", highlight: true },
];

export default function UrlBuilder() {
  const [platform, setPlatform] = useState("");
  const [platformOpen, setPlatformOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [params, setParams] = useState<ParamRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [tokenDialog, setTokenDialog] = useState<{ open: boolean; rowIndex: number }>({ open: false, rowIndex: -1 });

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

  const generatedUrl = useMemo(() => {
    if (!baseUrl) return "";
    const validParams = params.filter(p => p.key.trim());
    if (validParams.length === 0) return baseUrl;
    const queryString = validParams
      .map((p) => {
        const encVal = (v: string) => (v.includes("{") ? v : encodeURIComponent(v));
        return `${encodeURIComponent(p.key.trim())}=${encVal(p.value)}`;
      })
      .join("&");
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${queryString}`;
  }, [baseUrl, params]);

  const handleCopy = () => {
    if (!generatedUrl) { toast.error("Preencha com uma URL válida"); return; }
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const tokenSectionsOrdered = useMemo(() => orderedTokenSections(platform), [platform]);

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
      />

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
              resto.
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
                </strong>{" "}
                para o Google preencher no clique.
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
            <Command className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden shadow-sm">
              <CommandInput placeholder="Pesquisar (ex.: clique Google, nome da campanha, TikTok)…" className="h-11 border-b border-border/60" />
              <CommandList className="max-h-[min(56vh,380px)]">
                <CommandEmpty className="py-8 text-sm text-muted-foreground">Nada encontrado — tenta outra palavra.</CommandEmpty>
                {tokenSectionsOrdered.map((section, si) => (
                  <Fragment key={section.id}>
                    {si > 0 ? <CommandSeparator className="my-1" /> : null}
                    <CommandGroup
                      heading={section.title}
                      className="px-1 py-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground [&_[cmdk-group-heading]]:leading-snug [&_[cmdk-group-heading]]:normal-case [&_[cmdk-group-heading]]:tracking-normal"
                    >
                      {section.items.map((item) => (
                        <CommandItem
                          key={`${section.id}-${item.token}`}
                          value={`${section.title} ${item.label} ${item.search} ${item.token}`}
                          onSelect={() => insertToken(item.token)}
                          className="cursor-pointer rounded-md mx-1 my-0.5 px-3 py-2.5 aria-selected:bg-accent"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 text-left">
                            <span className="text-sm font-medium text-foreground leading-tight">{item.label}</span>
                            <span className="text-[11px] font-mono text-muted-foreground truncate">{item.token}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Fragment>
                ))}
              </CommandList>
            </Command>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
