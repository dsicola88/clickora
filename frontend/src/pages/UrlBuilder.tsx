import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Check, Plus, X, ChevronsUpDown, ChevronDown, ExternalLink, BookOpen, ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";
import { getUrlBuilderPlatformList } from "@/lib/marketingPlatforms";
import { orderedAdNetworkTokenSections } from "@/lib/adNetworkDynamicTokens";
import { UrlBuilderTokenModalBody } from "@/components/tracking/UrlBuilderTokenModalBody";
import { AdNetworkTokensReferenceDialog } from "@/components/tracking/AdNetworkTokensReferenceDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { MessageKey } from "@/i18n";
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
const defaultParams: Record<
  string,
  { key: string; value: string; highlight?: boolean; keyReadonly?: boolean; valuePlaceholder?: string }[]
> = {
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
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugExample",
    },
    { key: "utm_content", value: "{adgroupid}" },
    { key: "utm_term", value: "{keyword}" },
    { key: "sub1", value: "{matchtype}" },
    { key: "sub2", value: "{device}" },
    { key: "sub3", value: "{network}" },
    // Auto-tagging (gclid/gbraid/wbraid) — NÃO meter gclid={gclid} (macro falsa).
  ],
  "Facebook Ads": [
    { key: "utm_source", value: "facebook" },
    { key: "utm_medium", value: "cpc" },
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugMatch",
    },
    { key: "utm_content", value: "{{ad.name}}" },
    // Meta acrescenta fbclid sozinha no URL final — não forçar fbclid= vazio.
  ],
  "TikTok Ads": [
    { key: "utm_source", value: "tiktok" },
    { key: "utm_medium", value: "cpc" },
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugMatch",
    },
    { key: "utm_content", value: "{adgroup_name}" },
    // TikTok acrescenta o click id — não forçar ttclid={ttclid}.
  ],
  "Bing Ads": [
    { key: "utm_source", value: "bing" },
    { key: "utm_medium", value: "cpc" },
    /** Slug Clickora — alinhado ao P&L; não {CampaignId}. */
    { key: "utm_campaign", value: "", valuePlaceholder: "pages.urlBuilder.slugMatch" },
    { key: "utm_content", value: "{AdGroupId}" },
    { key: "utm_term", value: "{keyword}" },
    // Microsoft Ads acrescenta msclkid — não forçar msclkid={msclkid}.
  ],
  "Taboola": [
    { key: "utm_source", value: "taboola" },
    { key: "utm_medium", value: "native" },
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugShort",
    },
    { key: "tblci", value: "{click_id}", highlight: true },
  ],
  "Outbrain": [
    { key: "utm_source", value: "outbrain" },
    { key: "utm_medium", value: "native" },
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugShort",
    },
    { key: "obclid", value: "{ob_click_id}", highlight: true },
  ],
  "Pinterest Ads": [
    { key: "utm_source", value: "pinterest" },
    { key: "utm_medium", value: "cpc" },
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugShort",
    },
    { key: "epik", value: "{epik}", highlight: true },
  ],
  "Kwai Ads": [
    { key: "utm_source", value: "kwai" },
    { key: "utm_medium", value: "cpc" },
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugShort",
    },
    { key: "clickid", value: "{click_id}", highlight: true },
  ],
  "Twitter Ads": [
    { key: "utm_source", value: "twitter" },
    { key: "utm_medium", value: "cpc" },
    {
      key: "utm_campaign",
      value: "",
      valuePlaceholder: "pages.urlBuilder.slugShort",
    },
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
  "BuyGoods": [
    { key: "subid", value: "", keyReadonly: true },
    {
      key: "subid2",
      value: "",
      keyReadonly: true,
      valuePlaceholder: "pages.urlBuilder.optionalClickIds",
    },
    { key: "subid3", value: "", keyReadonly: true },
    { key: "subid4", value: "", keyReadonly: true },
    { key: "subid5", value: "", keyReadonly: true },
  ],
  "SmartAdv": [
    {
      key: "sub3",
      value: "",
      keyReadonly: true,
      valuePlaceholder: "pages.urlBuilder.clickFilled",
    },
    { key: "sub1", value: "", keyReadonly: true },
    { key: "sub2", value: "", keyReadonly: true },
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

type ParamRow = {
  key: string;
  value: string;
  highlight?: boolean;
  /** Nome do parâmetro fixo (preset afiliado) — só valor editável. */
  keyReadonly?: boolean;
  /** Placeholder do valor (ex.: indicar gclid / msclkid). */
  valuePlaceholder?: string;
};

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
  const { t } = useAppLocale();
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
    const campSlug = searchParams.get("utm_campaign")?.trim();
    if (!base && from !== "presell" && !campSlug) return;

    if (base && isAbsoluteHttpUrl(base)) setBaseUrl(base);
    if (from === "presell") {
      setShowPresellWelcome(true);
      if (offer && isAbsoluteHttpUrl(offer)) setPresellOfferHint(offer);
    }
    if (campSlug) {
      setPlatform((prev) => prev || "Google Ads");
      setParams((prev) => {
        const rows =
          prev.length > 0
            ? prev
            : (defaultParams["Google Ads"] || []).map((p) => ({ ...p }));
        return rows.map((p) =>
          p.key === "utm_campaign" ? { ...p, value: campSlug } : p,
        );
      });
    }
    prefillFromQueryRef.current = true;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("base");
        next.delete("from");
        next.delete("offer");
        next.delete("utm_campaign");
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
    if (!generatedUrl) { toast.error(t("pages.urlBuilder.needUrl")); return; }
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success(t("pages.urlBuilder.copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyGoogleAdsSuffix = () => {
    if (!trackingQueryString) {
      toast.error(t("pages.urlBuilder.needSuffix"));
      return;
    }
    navigator.clipboard.writeText(trackingQueryString);
    setCopiedGoogleSuffix(true);
    toast.success(t("pages.urlBuilder.suffixCopied"));
    setTimeout(() => setCopiedGoogleSuffix(false), 2000);
  };

  const tokenSectionsOrdered = useMemo(() => orderedAdNetworkTokenSections(platform), [platform]);

  const baseUrlValid = useMemo(
    () => baseUrl.trim().length > 0 && isAbsoluteHttpUrl(baseUrl.trim()),
    [baseUrl],
  );

  const buildStatus = useMemo(() => {
    if (!baseUrl.trim()) {
      return { label: t("pages.urlBuilder.statusNeedBase"), variant: "secondary" as const };
    }
    if (!baseUrlValid) {
      return { label: t("pages.urlBuilder.statusBadBase"), variant: "destructive" as const };
    }
    if (!platform) {
      return { label: t("pages.urlBuilder.statusNeedPlatform"), variant: "outline" as const };
    }
    return { label: t("pages.urlBuilder.statusReady"), variant: "default" as const };
  }, [baseUrl, baseUrlValid, platform, t]);

  const flowSteps = [
    t("pages.urlBuilder.flow1"),
    t("pages.urlBuilder.flow2"),
    t("pages.urlBuilder.flow3"),
    t("pages.urlBuilder.flow4"),
    t("pages.urlBuilder.flow5"),
    t("pages.urlBuilder.flow6"),
    t("pages.urlBuilder.flow7"),
  ];

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.urlBuilder.title")}
        subtitle={t("pages.urlBuilder.subtitle")}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setMacrosReferenceOpen(true)}
          >
            <BookOpen className="h-4 w-4" /> Macros
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
          <p className="text-sm font-semibold text-foreground">{t("pages.urlBuilder.nextStep")}</p>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t("pages.urlBuilder.nextStepBody")}</p>
          {presellOfferHint ? (
            <p className="text-[11px] text-muted-foreground leading-snug break-all border-t border-emerald-500/20 pt-2 mt-2">
              <span className="font-medium text-foreground/85">{t("pages.urlBuilder.offerRef")} </span>
              {presellOfferHint}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/25 px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <nav
              className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground"
              aria-label={t("pages.urlBuilder.breadcrumb")}
            >
              <Link to="/integracoes" className="hover:text-foreground transition-colors">
                {t("pages.urlBuilder.integrations")}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
              <span className="font-medium text-foreground">{t("pages.urlBuilder.crumb")}</span>
              {platform ? (
                <>
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                  <span className="truncate font-medium text-foreground/85 max-w-[12rem] sm:max-w-xs">
                    {platform}
                  </span>
                </>
              ) : null}
            </nav>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {t("pages.urlBuilder.buildHeading")}
            </h2>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {baseUrlValid ? (
              <span
                className="hidden sm:inline h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                title={t("pages.urlBuilder.baseValidTitle")}
                aria-hidden
              />
            ) : null}
            <Badge variant={buildStatus.variant} className="font-medium">
              {buildStatus.label}
            </Badge>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <Tabs defaultValue="configure" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto h-auto gap-1 p-1">
              <TabsTrigger value="configure" className="text-xs sm:text-sm px-2 sm:px-3">
                {t("pages.urlBuilder.tabConfigure")}
              </TabsTrigger>
              <TabsTrigger value="result" className="text-xs sm:text-sm px-2 sm:px-3">
                {t("pages.urlBuilder.tabResult")}
              </TabsTrigger>
              <TabsTrigger value="guide" className="text-xs sm:text-sm px-2 sm:px-3">
                {t("pages.urlBuilder.tabGuide")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="configure" className="mt-5 space-y-6 outline-none">
              <div className="space-y-2">
                <Label htmlFor="platform-combobox">{t("pages.urlBuilder.platform")}</Label>
                <Popover open={platformOpen} onOpenChange={setPlatformOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="platform-combobox"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={platformOpen}
                      className="w-full max-w-xl justify-between font-normal h-11 px-3"
                    >
                      <span className={cn("truncate", !platform && "text-muted-foreground")}>
                        {platform || t("pages.urlBuilder.platformPlaceholder")}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[min(28rem,calc(100vw-2rem))]" align="start">
                    <Command>
                      <CommandInput placeholder={t("pages.urlBuilder.filterPlatforms")} className="h-11" />
                      <CommandList>
                        <CommandEmpty>{t("pages.urlBuilder.noPlatform")}</CommandEmpty>
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
                <p className="text-[11px] text-muted-foreground">
                  {t("pages.urlBuilder.platformFilterHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("pages.urlBuilder.baseUrl")}</Label>
                <Input
                  placeholder={t("pages.urlBuilder.basePlaceholder")}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="font-mono text-sm max-w-4xl"
                />
                {platform === "Google Ads" && (
                  <div className="space-y-1.5 max-w-4xl text-[11px] text-muted-foreground">
                    <p>{t("pages.urlBuilder.googlePageHint")}</p>
                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-950 dark:text-amber-100">
                      {t("pages.urlBuilder.googleAutoTag")}
                    </p>
                  </div>
                )}
              </div>

              {platform && (
                <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-4 sm:px-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-sm font-semibold">{t("pages.urlBuilder.params")}</Label>
                    <p className="text-[10px] text-muted-foreground">
                      {t("pages.urlBuilder.tokenRowHint")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {params.map((param, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border border-border/50 bg-background/90 px-3 py-2.5 transition-colors",
                          param.highlight && "border-primary/35 bg-primary/[0.06] ring-1 ring-primary/15",
                        )}
                      >
                        {param.highlight ? (
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-2">
                            {t("pages.urlBuilder.clickIdRecommended")}
                          </p>
                        ) : null}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                          <div className="w-full sm:w-[8.5rem] shrink-0">
                            {param.highlight ? (
                              <Badge
                                variant="default"
                                className="w-full justify-center text-xs font-mono py-1.5 bg-primary text-primary-foreground font-bold underline underline-offset-2 decoration-primary-foreground/80"
                              >
                                {param.key || "param"}
                              </Badge>
                            ) : param.keyReadonly ? (
                              <div className="flex h-10 items-center rounded-md border border-border/70 bg-muted/30 px-3 font-mono text-xs font-medium text-foreground">
                                {param.key}
                              </div>
                            ) : (
                              <Input
                                value={param.key}
                                onChange={(e) => updateParam(i, "key", e.target.value)}
                                className="font-mono text-xs h-10"
                                placeholder={t("pages.urlBuilder.keyPlaceholder")}
                              />
                            )}
                          </div>
                          <Input
                            value={param.value}
                            onChange={(e) => updateParam(i, "value", e.target.value)}
                            className={cn(
                              "font-mono text-xs flex-1 min-w-0 h-10",
                              param.highlight && "border-primary/40 font-medium",
                            )}
                            placeholder={
                              param.valuePlaceholder
                                ? t(param.valuePlaceholder as MessageKey)
                                : param.highlight
                                  ? t("pages.urlBuilder.insertToken")
                                  : param.key === "gbraid" || param.key === "wbraid"
                                    ? t("pages.urlBuilder.optionalIos")
                                    : t("pages.urlBuilder.valueOrMacro")
                            }
                          />
                          <div className="flex items-center gap-1 shrink-0 justify-end sm:justify-start">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => setTokenDialog({ open: true, rowIndex: i })}
                              title={t("pages.urlBuilder.pickToken")}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeParam(i)}
                              title={t("pages.urlBuilder.removeRow")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addParam} className="mt-1">
                    <Plus className="h-3 w-3 mr-1" /> {t("pages.urlBuilder.addParam")}
                  </Button>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                {t("pages.urlBuilder.resultHint")}
              </p>
            </TabsContent>

            <TabsContent value="result" className="mt-5 space-y-6 outline-none">
              {platform === "Google Ads" && trackingQueryString ? (
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{t("pages.urlBuilder.suffixTitle")}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t("pages.urlBuilder.finalUrlBody")}</p>
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
                      {copiedGoogleSuffix ? t("common.copied") : t("common.copy")}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("pages.urlBuilder.generatedUrl")}
                </Label>
                <div className="flex items-stretch gap-2">
                  <div
                    role="status"
                    aria-label={t("pages.urlBuilder.generatedUrlAria")}
                    className={cn(
                      "flex min-h-[4rem] flex-1 rounded-md border border-input bg-muted/10 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground shadow-inner",
                      !generatedUrl && "text-muted-foreground items-center",
                    )}
                  >
                    {generatedUrl ? (
                      highlightGeneratedUrlPreview(generatedUrl)
                    ) : (
                      t("pages.urlBuilder.needBaseTab")
                    )}
                  </div>
                  {generatedUrl && isAbsoluteHttpUrl(generatedUrl) ? (
                    <Button variant="outline" size="icon" className="shrink-0 h-10 w-10" asChild title={t("pages.urlBuilder.openTab")}>
                      <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  ) : null}
                  <Button variant="outline" size="icon" className="shrink-0 h-10 w-10" onClick={handleCopy} title={t("pages.urlBuilder.copyUrl")}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="guide" className="mt-5 space-y-4 outline-none">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-4 sm:px-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">{t("pages.urlBuilder.flowTitle")}</p>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t("pages.urlBuilder.flowSummary")}</p>
                <Collapsible defaultOpen={false} className="space-y-2">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg border border-primary/15 bg-background/60 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-background/90 transition-colors [&[data-state=open]>svg]:rotate-180"
                    >
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" aria-hidden />
                      {t("pages.urlBuilder.flowMore")}
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
                      {t("pages.urlBuilder.flowNote")}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={tokenDialog.open} onOpenChange={(open) => setTokenDialog({ open, rowIndex: open ? tokenDialog.rowIndex : -1 })}>
        <DialogContent
          className="max-h-[90vh] flex flex-col gap-0 p-0 w-[min(100vw-1rem,52rem)] sm:max-w-[52rem]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0 text-left space-y-1 border-b border-border/60">
            <DialogTitle className="text-base sm:text-lg">{t("pages.urlBuilder.pickToken")}</DialogTitle>
            <p className="text-xs sm:text-sm text-muted-foreground font-normal leading-relaxed pr-2">
              {t("pages.urlBuilder.pickTokenHint")}
            </p>
          </DialogHeader>
          <div className="px-5 py-4 flex-1 min-h-0 overflow-y-auto">
            <UrlBuilderTokenModalBody
              key={tokenDialog.open ? `tok-${tokenDialog.rowIndex}` : "tok-closed"}
              onSelectToken={insertToken}
              allSectionsOrdered={tokenSectionsOrdered}
              searchPlaceholder={t("pages.urlBuilder.searchTokens")}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
