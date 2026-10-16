import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";
import { cn } from "@/lib/utils";
import {
  copyKeywordsText,
  downloadCsv,
  formatResearchDate,
  keywordsToCsv,
} from "@/lib/keywordResults";
import { magazineCopyText } from "@/lib/magazineCopyText";
import { CampaignMagazineStudio, type MagazineTab } from "@/components/adsGen/CampaignMagazineStudio";
import {
  ProductPageIdentityBanner,
  type PageIdentityPreview,
} from "@/components/adsGen/ProductPageIdentityBanner";
import { adsToCsv, finalExportBlockReason } from "@/lib/adText";
import {
  keywordResearchService,
  type AdBundle,
  type KeywordIntent,
  type KeywordItem,
  type KeywordResearch,
} from "@/services/keywordResearchService";
import { dpilotAdsHandoffHref } from "@/lib/dpilotPresellHandoff";
import {
  defaultMarketForLanguage,
  GRINGA_AFFILIATE_PLATFORMS,
  marketsForLanguage,
} from "@/lib/keywordResearchMarkets";

const LAST_RESEARCH_STORAGE_KEY = "dclickora-keyword-research-last-id";

const FALLBACK_LANGUAGES = [
  { code: "en", label: "Inglês" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Francês" },
  { code: "de", label: "Alemão" },
  { code: "it", label: "Italiano" },
];

const AFFILIATE_PLATFORMS = [
  ["digistore24", "Digistore24"],
  ["buygoods", "BuyGoods"],
  ["hotmart", "Hotmart"],
  ["clickbank", "ClickBank"],
  ["maxweb", "MaxWeb"],
  ["smartadv", "SmartAdv"],
  ["braip", "Braip"],
  ["monetizze", "Monetizze"],
  ["kiwify", "Kiwify"],
  ["other", "Outra"],
] as const;

const FUNNEL_OPTIONS = [
  { id: "BOTTOM" as const, title: "Fundo de funil", hint: "Compra e marca" },
  { id: "MIDDLE" as const, title: "Meio de funil", hint: "Comparação e avaliação" },
  { id: "TOP" as const, title: "Topo de funil", hint: "Descoberta e informação" },
];


function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function copyText(text: string, ok: string) {
  await navigator.clipboard.writeText(text);
  toast.success(ok);
}

export default function KeywordsPage() {
  const qc = useQueryClient();
  const restoredOnce = useRef(false);
  const [product, setProduct] = useState("");
  const [language, setLanguage] = useState("en");
  const [market, setMarket] = useState("US");
  const [affiliatePlatform, setAffiliatePlatform] = useState<(typeof AFFILIATE_PLATFORMS)[number][0]>("clickbank");
  const [productUrl, setProductUrl] = useState("");
  const [finalUrl, setFinalUrl] = useState("");
  const [funnel, setFunnel] = useState<(typeof FUNNEL_OPTIONS)[number]["id"]>("BOTTOM");
  const [pageText, setPageText] = useState("");
  const [needsPageText, setNeedsPageText] = useState(false);
  const [studioTab, setStudioTab] = useState<MagazineTab>("copy");
  const [draftDirty, setDraftDirty] = useState(false);
  const [research, setResearch] = useState<KeywordResearch | null>(null);
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<"ALL" | KeywordIntent>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generateError, setGenerateError] = useState<{ message: string; noResults?: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [productNameSource, setProductNameSource] = useState<"auto" | "form" | "page">("auto");
  const [pagePreview, setPagePreview] = useState<PageIdentityPreview | null>(null);
  const [pagePreviewLoading, setPagePreviewLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);

  const optionsQ = useQuery({
    queryKey: ["keyword-researches", "options"],
    queryFn: async () => {
      const { data, error } = await keywordResearchService.options();
      if (error) throw new Error(error);
      return data;
    },
  });

  const historyQ = useQuery({
    queryKey: ["keyword-researches", "list"],
    queryFn: async () => {
      const { data, error } = await keywordResearchService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const languages = FALLBACK_LANGUAGES.map((fallback) => {
    const remote = optionsQ.data?.languages?.find((item) => item.code === fallback.code);
    return remote ? { ...remote, label: fallback.label } : fallback;
  });

  const marketOptions = useMemo(
    () => marketsForLanguage(language, optionsQ.data?.markets ?? []),
    [language, optionsQ.data?.markets],
  );

  useEffect(() => {
    if (!marketOptions.some((m) => m.code === market)) {
      setMarket(defaultMarketForLanguage(language));
    }
  }, [language, market, marketOptions]);

  useEffect(() => {
    const url = productUrl.trim();
    if (!isHttpUrl(url) || product.trim().length < 2) {
      setPagePreview(null);
      return;
    }
    if (needsPageText && pageText.trim().length >= 40) {
      setPagePreviewLoading(true);
      const t = window.setTimeout(() => {
        void keywordResearchService
          .pagePreview({
            product: product.trim(),
            product_url: url,
            language,
            page_text: pageText.trim(),
            product_name_source: productNameSource,
          })
          .then(({ data, error }) => {
            setPagePreviewLoading(false);
            if (error || !data) {
              setPagePreview(null);
              return;
            }
            setPagePreview(data);
            if (
              productNameSource === "auto" &&
              !data.aligned &&
              data.suggested_product_name &&
              data.effective_product_name &&
              data.effective_product_name.toLowerCase() !== product.trim().toLowerCase()
            ) {
              setProduct(data.effective_product_name);
            }
          });
      }, 700);
      return () => window.clearTimeout(t);
    }
    if (needsPageText) return;
    setPagePreviewLoading(true);
    const t = window.setTimeout(() => {
      void keywordResearchService
        .pagePreview({
          product: product.trim(),
          product_url: url,
          language,
          product_name_source: productNameSource,
        })
        .then(({ data, error }) => {
          setPagePreviewLoading(false);
          if (error || !data) {
            setPagePreview(null);
            return;
          }
          setPagePreview(data);
          if (
            productNameSource === "auto" &&
            !data.aligned &&
            data.suggested_product_name &&
            data.effective_product_name &&
            data.effective_product_name.toLowerCase() !== product.trim().toLowerCase()
          ) {
            setProduct(data.effective_product_name);
          }
        });
    }, 700);
    return () => window.clearTimeout(t);
  }, [product, productUrl, language, productNameSource, needsPageText, pageText]);

  const generate = useMutation({
    mutationFn: async () => {
      const url = productUrl.trim();
      const pasted = pageText.trim();
      const landing = finalUrl.trim();
      const { data, error, errorCode } = await keywordResearchService.generate({
        product: product.trim(),
        language,
        market,
        affiliate_platform: affiliatePlatform,
        product_url: url,
        final_url: landing.length && isHttpUrl(landing) ? landing : undefined,
        funnel,
        product_name_source: productNameSource,
        ...(needsPageText && pasted.length >= 40 ? { page_text: pasted } : {}),
      });
      if (error || !data) {
        const err = new Error(error || "Não foi possível gerar a campanha.") as Error & {
          noResults?: boolean;
          needsPageText?: boolean;
        };
        err.noResults = errorCode === "NO_RESULTS";
        err.needsPageText = errorCode === "PAGE_UNAVAILABLE";
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      setResearch(data);
      setMarket(data.market);
      setFinalUrl(data.final_url ?? finalUrl);
      try {
        localStorage.setItem(LAST_RESEARCH_STORAGE_KEY, data.id);
      } catch {
        /* ignore */
      }
      setQuery("");
      setIntent("ALL");
      setSelected(new Set());
      setGenerateError(null);
      setNeedsPageText(false);
      setStudioTab("copy");
      setDraftDirty(false);
      setSaveState("saved");
      setSetupOpen(false);
      void qc.invalidateQueries({ queryKey: ["keyword-researches", "list"] });
    },
    onError: (e: Error & { noResults?: boolean; needsPageText?: boolean }) => {
      if (e.needsPageText) {
        setNeedsPageText(true);
        setResearch(null);
        setGenerateError({ message: e.message });
        return;
      }
      setResearch(null);
      setGenerateError({
        message: e.message || "Não foi possível gerar a campanha.",
        noResults: e.noResults,
      });
    },
  });

  const openHistory = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await keywordResearchService.getById(id);
      if (error || !data) throw new Error(error || "Pesquisa não encontrada.");
      return data;
    },
    onSuccess: (data) => {
      setResearch(data);
      setProduct(data.product);
      setLanguage(data.language);
      setMarket(data.market);
      setProductUrl(data.product_url ?? "");
      setFinalUrl(data.final_url ?? "");
      try {
        localStorage.setItem(LAST_RESEARCH_STORAGE_KEY, data.id);
      } catch {
        /* ignore */
      }
      if (data.funnel) setFunnel(data.funnel as (typeof FUNNEL_OPTIONS)[number]["id"]);
      else if (data.bundle?.analysis?.funnel) setFunnel(data.bundle.analysis.funnel);
      if (data.bundle?.analysis?.affiliatePlatform) {
        const known = AFFILIATE_PLATFORMS.some(([id]) => id === data.bundle?.analysis?.affiliatePlatform);
        if (known) setAffiliatePlatform(data.bundle.analysis.affiliatePlatform as (typeof AFFILIATE_PLATFORMS)[number][0]);
      }
      setStudioTab("copy");
      setQuery("");
      setIntent("ALL");
      setSelected(new Set());
      setGenerateError(null);
      setDraftDirty(false);
      setSaveState("saved");
      setSetupOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNewCampaign() {
    setResearch(null);
    setProduct("");
    setProductUrl("");
    setFinalUrl("");
    setPageText("");
    setNeedsPageText(false);
    setGenerateError(null);
    setDraftDirty(false);
    setSaveState("idle");
    setSetupOpen(true);
    setQuery("");
    setIntent("ALL");
    setSelected(new Set());
    setStudioTab("copy");
    restoredOnce.current = true;
    try {
      localStorage.removeItem(LAST_RESEARCH_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const deleteHistory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await keywordResearchService.remove(id);
      if (error) throw new Error(error);
    },
    onSuccess: (_void, id) => {
      if (research?.id === id) {
        startNewCampaign();
      }
      void qc.invalidateQueries({ queryKey: ["keyword-researches", "list"] });
      toast.success("Pesquisa apagada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearAllHistory = useMutation({
    mutationFn: async () => {
      const { error } = await keywordResearchService.removeAll();
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      startNewCampaign();
      void qc.invalidateQueries({ queryKey: ["keyword-researches", "list"] });
      toast.success("Histórico limpo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (restoredOnce.current || research || generate.isPending || openHistory.isPending) return;
    if (!historyQ.data?.length) return;
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem(LAST_RESEARCH_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (!lastId || !historyQ.data.some((h) => h.id === lastId)) return;
    restoredOnce.current = true;
    openHistory.mutate(lastId);
  }, [historyQ.data, research, generate.isPending, openHistory]);

  useEffect(() => {
    if (!draftDirty || !research?.id || !research.bundle) return;
    setSaveState("dirty");
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void keywordResearchService
        .update(research.id, {
          keywords: research.keywords,
          bundle: research.bundle,
          final_url: finalUrl.trim() || null,
        })
        .then(({ data, error }) => {
          if (error || !data) {
            setSaveState("dirty");
            toast.error(error || "Não foi possível gravar automaticamente.");
            return;
          }
          setResearch(data);
          setDraftDirty(false);
          setSaveState("saved");
          void qc.invalidateQueries({ queryKey: ["keyword-researches", "list"] });
        });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [draftDirty, research?.id, research?.keywords, research?.bundle, finalUrl, qc]);

  const selectedItems = useMemo(
    () => (research?.keywords ?? []).filter((k) => selected.has(k.keyword)),
    [research, selected],
  );

  function editKeyword(from: string, to: string) {
    setResearch((current) => {
      if (!current) return current;
      return {
        ...current,
        keywords: current.keywords.map((k) => (k.keyword === from ? { ...k, keyword: to } : k)),
      };
    });
    setSelected((current) => {
      if (!current.has(from)) return current;
      const next = new Set(current);
      next.delete(from);
      if (to.trim()) next.add(to);
      return next;
    });
    setDraftDirty(true);
  }

  function submitGenerate() {
    if (product.trim().length < 2) {
      toast.error("Indique o nome do produto.");
      return;
    }
    const url = productUrl.trim();
    if (!isHttpUrl(url)) {
      toast.error("Indique o link oficial do produto, começando por http:// ou https://");
      return;
    }
    if (needsPageText && pageText.trim().length < 40) {
      toast.error("Cole o texto visível da página. O link não foi consultado, por isso a campanha não foi gerada.");
      return;
    }
    setGenerateError(null);
    generate.mutate();
  }

  const history = historyQ.data ?? [];
  const showEmptyHistory = !research && !generate.isPending && !generateError && history.length === 0 && !historyQ.isLoading;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Pesquisa e anúncios"
        subtitle="Copy no estilo MAG: títulos, descrições, destaques e sitelinks prontos a copiar para o Google Ads."
      />
      <div className="flex flex-wrap items-center justify-between gap-3 -mt-2">
        {research ? (
          <p className="text-xs text-muted-foreground">
            {saveState === "saving"
              ? "A gravar alterações…"
              : saveState === "dirty"
                ? "Rascunho com alterações por gravar…"
                : saveState === "saved"
                  ? "Pacote gravado na sua conta."
                  : "Pacote pronto para editar."}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground">Preencha o formulário e gere a campanha.</span>
        )}
        <div className="flex flex-wrap gap-2">
          {research ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setSetupOpen((o) => !o)}>
                {setupOpen ? "Ocultar formulário" : "Alterar produto / regenerar"}
              </Button>
              <Button type="button" size="sm" onClick={startNewCampaign}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nova campanha
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-6 min-w-0">
          {setupOpen || !research ? (
          <form
            className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitGenerate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="kw-product">Nome do produto</Label>
              <Input
                id="kw-product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Ex.: Nordic Oak Lamp"
                maxLength={200}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Idioma do anúncio</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger aria-label="Idioma do anúncio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mercado do anúncio</Label>
                <Select value={market} onValueChange={setMarket}>
                  <SelectTrigger aria-label="Mercado do anúncio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {marketOptions.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plataforma de afiliados</Label>
                <Select
                  value={affiliatePlatform}
                  onValueChange={(value) => {
                    const next = value as typeof affiliatePlatform;
                    setAffiliatePlatform(next);
                    if (GRINGA_AFFILIATE_PLATFORMS.has(next)) {
                      setLanguage("en");
                      setMarket("US");
                    }
                  }}
                >
                  <SelectTrigger aria-label="Plataforma de afiliados">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AFFILIATE_PLATFORMS.map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kw-final-url">URL final do anúncio (presell)</Label>
                <Input
                  id="kw-final-url"
                  value={finalUrl}
                  onChange={(e) => {
                    setFinalUrl(e.target.value);
                    if (research) setDraftDirty(true);
                  }}
                  placeholder="https://… a sua presell publicada"
                  inputMode="url"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Usada nos sitelinks e no destino do anúncio. O link do produto acima serve só para ler a oferta e gerar copy.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kw-url">Link oficial do produto</Label>
              <Input
                id="kw-url"
                value={productUrl}
                onChange={(e) => {
                  setProductUrl(e.target.value);
                  setNeedsPageText(false);
                }}
                placeholder="https://… página de vendas"
                inputMode="url"
                autoComplete="off"
              />
              <ProductPageIdentityBanner
                preview={pagePreview}
                loading={pagePreviewLoading}
                productNameSource={productNameSource}
                onUsePageName={() => {
                  if (pagePreview?.suggested_product_name) {
                    setProduct(pagePreview.suggested_product_name);
                    setProductNameSource("page");
                  }
                }}
                onKeepFormName={() => setProductNameSource("form")}
                onUseAuto={() => setProductNameSource("auto")}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de funil</Label>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de funil">
                {FUNNEL_OPTIONS.map((option) => {
                  const selectedFunnel = funnel === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selectedFunnel}
                      onClick={() => setFunnel(option.id)}
                      className={cn(
                        "rounded-lg border px-3 py-3 text-left transition-colors",
                        selectedFunnel ? "border-primary bg-primary/10" : "border-border/70 hover:bg-muted/50",
                      )}
                    >
                      <span className="block text-sm font-semibold">{option.title}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {needsPageText ? (
              <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <Label htmlFor="kw-page-text">Texto da página</Label>
                <p className="text-xs text-muted-foreground">
                  O link não foi consultado. Cole o texto visível da página de vendas. Sem este texto, a campanha não é gerada.
                </p>
                <textarea
                  id="kw-page-text"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={pageText}
                  maxLength={8000}
                  onChange={(e) => setPageText(e.target.value)}
                />
              </div>
            ) : null}
            <Button type="submit" className="h-11 w-full text-sm font-semibold tracking-wide" disabled={generate.isPending}>
              {generate.isPending
                ? "A gerar campanha…"
                : research
                  ? "Regenerar campanha (novo pacote)"
                  : "Gerar campanha"}
            </Button>
          </form>
          ) : null}

          {generate.isPending || openHistory.isPending ? (
            <LoadingState
              message={
                generate.isPending
                  ? "A consultar a página e a montar a campanha..."
                  : "A abrir a pesquisa..."
              }
            />
          ) : generateError && !needsPageText ? (
            generateError.noResults ? (
              <ErrorState
                message="Não encontramos sugestões suficientes. Tente outro produto ou nicho."
                onRetry={() => submitGenerate()}
              />
            ) : (
              <ErrorState message={generateError.message} onRetry={() => submitGenerate()} />
            )
          ) : research ? (
            <div className="space-y-4">
              {research.bundle ? (
                <CampaignMagazineStudio
                  research={research}
                  tab={studioTab}
                  onTabChange={setStudioTab}
                  bundle={research.bundle}
                  issues={research.validation ?? []}
                  onBundleChange={(bundle) => {
                    setDraftDirty(true);
                    setResearch({ ...research, bundle });
                  }}
                  query={query}
                  onQueryChange={setQuery}
                  intent={intent}
                  onIntentChange={setIntent}
                  selected={selected}
                  onSelectedChange={setSelected}
                  onEditKeyword={editKeyword}
                  onCopyKeywords={() => void copyText(copyKeywordsText(research.keywords), "Todas copiadas")}
                  onCopySelected={() => void copyText(copyKeywordsText(selectedItems), "Seleccionadas copiadas")}
                  onExportKeywordsCsv={() => {
                    const csv = keywordsToCsv(research.keywords, research);
                    const slug = research.product.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40);
                    downloadCsv(`palavras-chave-${slug || "export"}.csv`, csv);
                    toast.success("CSV exportado");
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Esta pesquisa antiga não tem pacote de anúncios. Gere de novo para criar copy.</p>
              )}
              {research.bundle ? (
                <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-t border-border/70 bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={draftDirty || Boolean(finalExportBlockReason(research.validation ?? []))}
                    onClick={() => {
                      const bundle = research.bundle as AdBundle;
                      const rows = [
                        ...bundle.headlines.map((h) => ({
                          kind: "headline",
                          text: h.text,
                          pin: h.pin ? String(h.pin) : "",
                          url: "",
                          platform: bundle.platform,
                        })),
                        ...bundle.descriptions.map((d) => ({
                          kind: "description",
                          text: d.text,
                          pin: d.pin ? String(d.pin) : "",
                          url: "",
                          platform: bundle.platform,
                        })),
                        ...bundle.sitelinks.map((s) => ({
                          kind: "sitelink",
                          text: s.text,
                          pin: "",
                          url: s.url,
                          platform: bundle.platform,
                        })),
                        ...bundle.callouts.map((c) => ({
                          kind: "callout",
                          text: c.text,
                          pin: "",
                          url: "",
                          platform: bundle.platform,
                        })),
                      ];
                      downloadCsv(`anuncios-${research.product.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "export"}.csv`, adsToCsv(rows));
                      toast.success("CSV de revisão exportado. Não é importação oficial.");
                    }}
                  >
                    Exportar CSV de revisão
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!research.bundle) return;
                      setSaveState("saving");
                      void keywordResearchService
                        .update(research.id, {
                          keywords: research.keywords,
                          bundle: research.bundle,
                          final_url: finalUrl.trim() || null,
                        })
                        .then(({ data, error }) => {
                          if (error || !data) {
                            setSaveState("dirty");
                            toast.error(error || "Não foi possível gravar.");
                            return;
                          }
                          setResearch(data);
                          setDraftDirty(false);
                          setSaveState("saved");
                          toast.success("Pacote gravado");
                          void qc.invalidateQueries({ queryKey: ["keyword-researches", "list"] });
                        });
                    }}
                  >
                    Gravar agora
                  </Button>
                  {isHttpUrl(finalUrl.trim()) ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link to={dpilotAdsHandoffHref(finalUrl.trim())} className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Assistente Google Ads
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : showEmptyHistory ? (
            <p className="text-sm text-muted-foreground py-6">Ainda não existem pesquisas.</p>
          ) : null}
        </div>

        <aside className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Pesquisas recentes</h2>
            {history.length > 0 ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                    Limpar tudo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar pesquisas recentes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Apaga todas as campanhas guardadas nesta lista. Não afeta presells nem campanhas no Google Ads.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (!clearAllHistory.isPending) clearAllHistory.mutate();
                      }}
                    >
                      Apagar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
          {historyQ.isLoading ? (
            <p className="text-xs text-muted-foreground">A carregar…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ainda não existem pesquisas.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id} className="flex gap-0.5 items-stretch">
                  <button
                    type="button"
                    onClick={() => openHistory.mutate(h.id)}
                    className={cn(
                      "min-w-0 flex-1 text-left rounded-lg border border-transparent px-2.5 py-2 hover:bg-muted/60",
                      research?.id === h.id && "border-border bg-muted/40",
                    )}
                  >
                    <span className="block text-sm font-medium truncate">{h.product}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {h.language_label} · {h.market_name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatResearchDate(h.updated_at ?? h.created_at)}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-auto shrink-0 w-9 text-muted-foreground hover:text-destructive"
                    aria-label={`Apagar pesquisa ${h.product}`}
                    disabled={deleteHistory.isPending}
                    onClick={() => deleteHistory.mutate(h.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
