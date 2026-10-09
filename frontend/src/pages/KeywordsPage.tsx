import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Copy, Download, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";
import { cn } from "@/lib/utils";
import {
  copyKeywordsText,
  downloadCsv,
  filterKeywords,
  formatResearchDate,
  groupNegativeKeywords,
  KEYWORD_FUNNEL_SECTIONS,
  KEYWORD_INTENT_FILTERS,
  funnelLabel,
  keywordsToCsv,
  keywordFunnel,
  negativeGroupLabel,
  relevanceLabel,
  setKeywordSelection,
  toggleKeywordSelection,
} from "@/lib/keywordResults";
import { CreativePanels } from "@/components/adsGen/CreativePanels";
import { adsToCsv, finalExportBlockReason } from "@/lib/adText";
import {
  keywordResearchService,
  type AdBundle,
  type KeywordIntent,
  type KeywordItem,
  type KeywordResearch,
} from "@/services/keywordResearchService";

const FALLBACK_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
];

const FALLBACK_MARKETS = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "AO", name: "Angola" },
  { code: "BR", name: "Brazil" },
  { code: "PT", name: "Portugal" },
];

function platformLabel(platform: string | null | undefined): string {
  if (platform === "microsoft") return "Microsoft Advertising";
  if (platform === "both") return "Google Ads e Microsoft Advertising";
  if (platform === "google") return "Google Ads";
  return "Plataforma não registada nesta pesquisa";
}

function generationStatus(research: KeywordResearch): string {
  const failed = research.bundle?.llmFailed === true;
  const ai = research.source === "llm" || research.bundle?.source === "llm";
  if (ai && !failed) {
    return "Geração com IA, validada pelas regras carregadas. Sem volume, CPC ou concorrência. Não prevê aprovação.";
  }
  if (!research.bundle && !research.source) {
    return "Pesquisa anterior, sem estado de geração registado. Sem volume, CPC ou concorrência.";
  }
  if (failed) {
    return "Fallback determinístico: a geração inteligente falhou. Não é um resultado da IA. Sem volume, CPC ou concorrência.";
  }
  return "Fallback determinístico. Não é uma redação da IA. Sem volume, CPC ou concorrência.";
}

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

const MATCH_LABEL: Record<string, string> = { BROAD: "ampla", PHRASE: "frase", EXACT: "exata" };

function KeywordList({
  rows,
  selected,
  onToggle,
  onEdit,
}: {
  rows: KeywordItem[];
  selected: Set<string>;
  onToggle: (keyword: string) => void;
  onEdit: (from: string, to: string) => void;
}) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-2"> </th>
              <th className="px-3 py-2 font-medium">Palavra-chave</th>
              <th className="px-3 py-2 font-medium w-40">Relevância estimada</th>
              <th className="px-3 py-2 font-medium w-24"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={`${item.intent}-${index}`} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 align-middle">
                  <Checkbox
                    checked={selected.has(item.keyword)}
                    onCheckedChange={() => onToggle(item.keyword)}
                    aria-label={`Seleccionar ${item.keyword}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    aria-label={`Editar ${item.keyword}`}
                    value={item.keyword}
                    className="h-8"
                    onChange={(e) => onEdit(item.keyword, e.target.value)}
                  />
                  <span className="block text-[11px] text-muted-foreground mt-1">
                    {funnelLabel(item)}
                    {item.matchTypes?.length ? ` · ${item.matchTypes.map((m) => MATCH_LABEL[m] ?? m).join(" · ")}` : ""}
                  </span>
                  {item.natural === false ? (
                    <span className="block text-[11px] text-amber-700">Frase pouco natural — rever</span>
                  ) : null}
                  {item.negativeSuggestion ? (
                    <span className="block text-[11px] text-muted-foreground">Sugestão de negativa</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{relevanceLabel(item.relevance)}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => void copyText(item.keyword, "Copiada")}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2">
        {rows.map((item, index) => (
          <KeywordRow
            key={`${item.intent}-${index}`}
            item={item}
            selected={selected.has(item.keyword)}
            onToggle={() => onToggle(item.keyword)}
            onEdit={(to) => onEdit(item.keyword, to)}
          />
        ))}
      </div>
    </>
  );
}

function KeywordRow({
  item,
  selected,
  onToggle,
  onEdit,
}: {
  item: KeywordItem;
  selected: boolean;
  onToggle: () => void;
  onEdit: (to: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5",
        selected && "border-primary/40 bg-primary/5",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggle()}
        aria-label={`Seleccionar ${item.keyword}`}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <Input aria-label={`Editar ${item.keyword}`} value={item.keyword} className="h-8" onChange={(e) => onEdit(e.target.value)} />
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {funnelLabel(item)} · Relevância estimada: {relevanceLabel(item.relevance)}
          {item.matchTypes?.length ? ` · ${item.matchTypes.map((m) => MATCH_LABEL[m] ?? m).join(" · ")}` : ""}
          {item.natural === false ? " · rever a frase" : ""}
          {item.negativeSuggestion ? " · sugestão de negativa" : ""}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 h-8 px-2"
        onClick={() => void copyText(item.keyword, "Copiada")}
      >
        <Copy className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5 text-xs">Copiar</span>
      </Button>
    </div>
  );
}

export default function KeywordsPage() {
  const qc = useQueryClient();
  const [product, setProduct] = useState("");
  const [language, setLanguage] = useState("en");
  const [market, setMarket] = useState("US");
  const [productUrl, setProductUrl] = useState("");
  const [platform, setPlatform] = useState<"google" | "microsoft" | "both">("google");
  const [objective, setObjective] = useState<"purchase" | "leads" | "comparison" | "commercial">("purchase");
  const [details, setDetails] = useState("");
  const [finalUrl, setFinalUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [guaranteeNote, setGuaranteeNote] = useState("");
  const [promoValue, setPromoValue] = useState("");
  const [studioTab, setStudioTab] = useState<"keywords" | "ad" | "assets" | "review" | "export">("keywords");
  const [draftDirty, setDraftDirty] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [research, setResearch] = useState<KeywordResearch | null>(null);
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<"ALL" | KeywordIntent>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generateError, setGenerateError] = useState<{ message: string; noResults?: boolean } | null>(null);

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

  const languages = optionsQ.data?.languages?.length ? optionsQ.data.languages : FALLBACK_LANGUAGES;
  const markets = optionsQ.data?.markets?.length ? optionsQ.data.markets : FALLBACK_MARKETS;
  const marketLabel = markets.find((m) => m.code === market)?.name ?? market;

  const generate = useMutation({
    mutationFn: async () => {
      const url = productUrl.trim();
      const dest = finalUrl.trim();
      const promo = promoValue.trim();
      const { data, error, errorCode } = await keywordResearchService.generate({
        product: product.trim(),
        language,
        market,
        platform,
        objective,
        ...(url ? { product_url: url } : {}),
        ...(dest ? { final_url: dest } : {}),
        ...(details.trim() ? { description: details.trim() } : {}),
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(priceNote.trim() ? { price_note: priceNote.trim() } : {}),
        ...(offerNote.trim() ? { offer_note: offerNote.trim() } : {}),
        ...(guaranteeNote.trim() ? { guarantee_note: guaranteeNote.trim() } : {}),
        ...(promo
          ? {
              promotion: {
                kind: promo.includes("%") ? "percent" : "amount",
                value: promo.replace("%", ""),
                ...(dest ? { url: dest } : url ? { url } : {}),
              },
            }
          : {}),
      });
      if (error || !data) {
        const err = new Error(error || "Não foi possível gerar as palavras-chave.") as Error & {
          noResults?: boolean;
        };
        err.noResults = errorCode === "NO_RESULTS";
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      setResearch(data);
      setQuery("");
      setIntent("ALL");
      setSelected(new Set());
      setGenerateError(null);
      setStudioTab("keywords");
      setDraftDirty(false);
      void qc.invalidateQueries({ queryKey: ["keyword-researches", "list"] });
    },
    onError: (e: Error & { noResults?: boolean }) => {
      setResearch(null);
      setGenerateError({
        message: e.message || "Não foi possível gerar as palavras-chave.",
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
      setQuery("");
      setIntent("ALL");
      setSelected(new Set());
      setGenerateError(null);
      setDraftDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(
    () => filterKeywords(research?.keywords ?? [], query, intent),
    [research, query, intent],
  );
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
      toast.error("Indique o produto ou nicho.");
      return;
    }
    const url = productUrl.trim();
    if (url && !isHttpUrl(url)) {
      toast.error("A URL do produto deve começar por http:// ou https://");
      return;
    }
    if (finalUrl.trim() && !isHttpUrl(finalUrl)) {
      toast.error("A URL final deve começar por http:// ou https://");
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
        subtitle="Produto, plataforma, idioma e mercado. Revê palavras-chave, anúncio e recursos antes de copiar ou exportar."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-6 min-w-0">
          <form
            className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitGenerate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="kw-product">Produto ou nicho</Label>
              <Input
                id="kw-product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Ex.: GlucoTrust"
                maxLength={200}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                  <SelectTrigger aria-label="Plataforma">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Ads</SelectItem>
                    <SelectItem value="microsoft">Microsoft Advertising</SelectItem>
                    <SelectItem value="both">Ambas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Objetivo</Label>
                <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
                  <SelectTrigger aria-label="Objetivo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Compra</SelectItem>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="comparison">Comparação</SelectItem>
                    <SelectItem value="commercial">Pesquisa comercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger aria-label="Idioma">
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
                <Label>Mercado</Label>
                <Popover open={marketOpen} onOpenChange={setMarketOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={marketOpen}
                      className="w-full justify-between font-normal h-10"
                    >
                      <span className="truncate">{marketLabel}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[min(24rem,calc(100vw-2rem))]" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar mercado…" />
                      <CommandList>
                        <CommandEmpty>Nenhum mercado encontrado.</CommandEmpty>
                        <CommandGroup>
                          {markets.map((m) => (
                            <CommandItem
                              key={m.code}
                              value={`${m.name} ${m.code}`}
                              onSelect={() => {
                                setMarket(m.code);
                                setMarketOpen(false);
                              }}
                            >
                              {m.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kw-url">URL do produto — opcional</Label>
              <Input
                id="kw-url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="Cole a URL do produto (opcional)"
                inputMode="url"
                autoComplete="off"
              />
            </div>
            <details className="rounded-lg border border-border/70 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Opções avançadas</summary>
              <div className="grid gap-3 pt-3">
                <div className="space-y-1">
                  <Label htmlFor="kw-details">Descrição e benefícios comprovados</Label>
                  <textarea
                    id="kw-details"
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={details}
                    maxLength={1000}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="kw-final">URL final ou de afiliado</Label>
                    <Input id="kw-final" value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} inputMode="url" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kw-brand">Marca</Label>
                    <Input id="kw-brand" value={brand} maxLength={80} onChange={(e) => setBrand(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kw-price">Preço confirmado</Label>
                    <Input id="kw-price" value={priceNote} maxLength={120} onChange={(e) => setPriceNote(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kw-offer">Oferta confirmada</Label>
                    <Input id="kw-offer" value={offerNote} maxLength={120} onChange={(e) => setOfferNote(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kw-guarantee">Garantia confirmada</Label>
                    <Input id="kw-guarantee" value={guaranteeNote} maxLength={120} onChange={(e) => setGuaranteeNote(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kw-promo">Desconto confirmado</Label>
                    <Input id="kw-promo" value={promoValue} maxLength={20} placeholder="Ex.: 15%" onChange={(e) => setPromoValue(e.target.value)} />
                  </div>
                </div>
              </div>
            </details>
            <Button type="submit" className="gap-2" disabled={generate.isPending}>
              <Sparkles className="h-4 w-4" />
              Gerar
            </Button>
          </form>

          {generate.isPending || openHistory.isPending ? (
            <LoadingState
              message={
                generate.isPending
                  ? "A gerar palavras-chave e anúncios..."
                  : "A abrir a pesquisa..."
              }
            />
          ) : generateError ? (
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
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Secções do pacote">
                {(
                  [
                    ["keywords", "Palavras-chave"],
                    ["ad", "Anúncio"],
                    ["assets", "Sitelinks e recursos"],
                    ["review", "Revisão"],
                    ["export", "Exportação"],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={studioTab === id}
                    size="sm"
                    variant={studioTab === id ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setStudioTab(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {studioTab !== "keywords" && research.bundle ? (
                <CreativePanels
                  tab={studioTab}
                  bundle={research.bundle}
                  issues={research.validation ?? []}
                  onChange={(bundle) => {
                    setDraftDirty(true);
                    setResearch({ ...research, bundle });
                  }}
                />
              ) : studioTab !== "keywords" ? (
                <p className="text-sm text-muted-foreground">Esta pesquisa antiga não tem pacote de anúncios. Gera de novo para o criar.</p>
              ) : null}
              {studioTab === "keywords" ? (
              <>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Palavras-chave para</p>
                <h2 className="text-xl font-semibold tracking-tight">{research.product}</h2>
                <p className="text-sm text-muted-foreground">
                  {platformLabel(research.platform)}
                  {research.platform ? " · " : ""}
                  {research.language_label} · {research.market_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{generationStatus(research)}</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar palavras-chave..."
                  className="pl-9"
                  aria-label="Pesquisar palavras-chave"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {KEYWORD_INTENT_FILTERS.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    size="sm"
                    variant={intent === f.id ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setIntent(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{selected.size} selecionadas</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!research.keywords.length}
                  onClick={() => void copyText(copyKeywordsText(research.keywords), "Todas copiadas")}
                >
                  Copiar todas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedItems.length}
                  onClick={() => void copyText(copyKeywordsText(selectedItems), "Seleccionadas copiadas")}
                >
                  Copiar selecionadas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!research.keywords.length}
                  onClick={() => {
                    const csv = keywordsToCsv(research.keywords, research);
                    const slug = research.product.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40);
                    downloadCsv(`palavras-chave-${slug || "export"}.csv`, csv);
                    toast.success("CSV exportado");
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Exportar CSV
                </Button>
              </div>

              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma palavra-chave corresponde a este filtro.
                </p>
              ) : (
                <>
                  {KEYWORD_FUNNEL_SECTIONS.map((section) => {
                    const rows = visible.filter((k) => keywordFunnel(k) === section.id);
                    if (!rows.length) return null;
                    const onToggle = (keyword: string) => setSelected((s) => toggleKeywordSelection(s, keyword));
                    return (
                      <section key={section.id} className="space-y-2">
                        <h3 className="text-sm font-semibold pt-2">{section.title}</h3>
                        <p className="text-xs text-muted-foreground">{section.hint}</p>
                        <KeywordList rows={rows} selected={selected} onToggle={onToggle} onEdit={editKeyword} />
                      </section>
                    );
                  })}
                  {(() => {
                    const rows = visible.filter((k) => k.intent === "NEGATIVE");
                    if (!rows.length) return null;
                    const onToggle = (keyword: string) => setSelected((s) => toggleKeywordSelection(s, keyword));
                    const groups = groupNegativeKeywords(rows);
                    return (
                      <section className="space-y-3">
                        <h3 className="text-sm font-semibold pt-2">Sugestões de negativas</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Reveja antes de usar numa campanha. Uma negativa mal escolhida pode bloquear quem ainda está a
                          decidir comprar. Não fazem parte do funil.
                        </p>
                        {groups.map((group) => {
                          const keys = group.items.map((k) => k.keyword);
                          const allOn = keys.every((k) => selected.has(k));
                          return (
                            <div key={group.group} className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-xs font-medium text-muted-foreground">{negativeGroupLabel(group.group)}</h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setSelected((s) => setKeywordSelection(s, keys, !allOn))}
                                >
                                  {allOn ? "Desmarcar grupo" : "Seleccionar grupo"}
                                </Button>
                              </div>
                              <KeywordList rows={group.items} selected={selected} onToggle={onToggle} onEdit={editKeyword} />
                            </div>
                          );
                        })}
                      </section>
                    );
                  })()}
                </>
              )}
              </>
              ) : null}
              {research.bundle ? (
                <div className="flex flex-wrap items-center gap-2">
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
                  {draftDirty ? (
                    <span className="text-xs text-muted-foreground">Grave o rascunho para validar antes de exportar.</span>
                  ) : finalExportBlockReason(research.validation ?? []) ? (
                    <span className="text-xs text-destructive">{finalExportBlockReason(research.validation ?? [])}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem inválidos nas regras carregadas. Continua a ser um CSV de revisão.</span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!research.bundle) return;
                      void keywordResearchService
                        .update(research.id, { keywords: research.keywords, bundle: research.bundle })
                        .then(({ data, error }) => {
                          if (error || !data) {
                            toast.error(error || "Não foi possível gravar.");
                            return;
                          }
                          setResearch(data);
                          setDraftDirty(false);
                          toast.success("Alterações gravadas");
                        });
                    }}
                  >
                    Gravar alterações
                  </Button>
                </div>
              ) : null}
            </div>
          ) : showEmptyHistory ? (
            <p className="text-sm text-muted-foreground py-6">Ainda não existem pesquisas.</p>
          ) : null}
        </div>

        <aside className="space-y-3 min-w-0">
          <h2 className="text-sm font-semibold">Pesquisas recentes</h2>
          {historyQ.isLoading ? (
            <p className="text-xs text-muted-foreground">A carregar…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ainda não existem pesquisas.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => openHistory.mutate(h.id)}
                    className={cn(
                      "w-full text-left rounded-lg border border-transparent px-2.5 py-2 hover:bg-muted/60",
                      research?.id === h.id && "border-border bg-muted/40",
                    )}
                  >
                    <span className="block text-sm font-medium truncate">{h.product}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {h.language_label} · {h.market_name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{formatResearchDate(h.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
