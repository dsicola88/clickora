import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Search } from "lucide-react";
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
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";
import { cn } from "@/lib/utils";
import {
  campaignReviewText,
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

type StudioTab = "summary" | "keywords" | "negatives" | "ads" | "extensions" | "review";

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

function ProductSummary({ research, onCopy }: { research: KeywordResearch; onCopy: (text: string) => void }) {
  const analysis = research.bundle?.analysis;
  const funnelName = FUNNEL_OPTIONS.find((option) => option.id === analysis?.funnel)?.title ?? "Funil não registado nesta pesquisa";
  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{research.product}</h2>
        <p className="text-sm text-muted-foreground">
          {analysis?.affiliatePlatformLabel ?? "Plataforma não registada"} · {funnelName} · {research.language_label}
        </p>
        <p className="mt-2 text-sm">
          {analysis?.pageStatus === "fetched"
            ? "A página foi consultada. Confirmado entra no anúncio. O que está só citado fica de fora."
            : analysis?.pageStatus === "pasted"
              ? "A página não foi consultada. Os trechos vêm do texto colado."
              : "Esta pesquisa não tem leitura de página. Gere de novo para obter o resumo."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{generationStatus(research)}</p>
      </div>
      {analysis?.adGroups?.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {analysis.adGroups.map((group) => (
            <div key={group.name} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="text-sm font-semibold">{group.name}</p>
              <p className="text-xs text-muted-foreground">{group.hint}</p>
            </div>
          ))}
        </div>
      ) : null}
      {analysis?.facts?.length ? (
        <ul className="space-y-2">
          {analysis.facts.map((fact) => (
            <li key={`${fact.label}-${fact.value}`} className="rounded-lg border border-border/60 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fact.label}</p>
                <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => onCopy(fact.value)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-sm">{fact.value}</p>
              <p className="text-[11px] text-muted-foreground">
                {fact.status === "confirmed" ? "Confirmado. Pode entrar no anúncio." : "Citado na página. Não entrou no anúncio."}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {analysis?.missing?.length ? (
        <div>
          <p className="text-sm font-medium">Não encontrado na página</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {analysis.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function KeywordsPage() {
  const qc = useQueryClient();
  const [product, setProduct] = useState("");
  const [language, setLanguage] = useState("pt");
  const [affiliatePlatform, setAffiliatePlatform] = useState<(typeof AFFILIATE_PLATFORMS)[number][0]>("hotmart");
  const [productUrl, setProductUrl] = useState("");
  const [funnel, setFunnel] = useState<(typeof FUNNEL_OPTIONS)[number]["id"]>("BOTTOM");
  const [pageText, setPageText] = useState("");
  const [needsPageText, setNeedsPageText] = useState(false);
  const [studioTab, setStudioTab] = useState<StudioTab>("summary");
  const [draftDirty, setDraftDirty] = useState(false);
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

  const languages = FALLBACK_LANGUAGES.map((fallback) => {
    const remote = optionsQ.data?.languages?.find((item) => item.code === fallback.code);
    return remote ? { ...remote, label: fallback.label } : fallback;
  });

  const generate = useMutation({
    mutationFn: async () => {
      const url = productUrl.trim();
      const pasted = pageText.trim();
      const { data, error, errorCode } = await keywordResearchService.generate({
        product: product.trim(),
        language,
        affiliate_platform: affiliatePlatform,
        product_url: url,
        funnel,
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
      setQuery("");
      setIntent("ALL");
      setSelected(new Set());
      setGenerateError(null);
      setNeedsPageText(false);
      setStudioTab("summary");
      setDraftDirty(false);
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
      setProductUrl(data.product_url ?? "");
      if (data.bundle?.analysis?.funnel) setFunnel(data.bundle.analysis.funnel);
      if (data.bundle?.analysis?.affiliatePlatform) {
        const known = AFFILIATE_PLATFORMS.some(([id]) => id === data.bundle?.analysis?.affiliatePlatform);
        if (known) setAffiliatePlatform(data.bundle.analysis.affiliatePlatform as (typeof AFFILIATE_PLATFORMS)[number][0]);
      }
      setStudioTab("summary");
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
        subtitle="Nome, idioma, plataforma de afiliados, link e funil. A campanha fica pronta para rever."
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
                <Label>Plataforma de afiliados</Label>
                <Select value={affiliatePlatform} onValueChange={(value) => setAffiliatePlatform(value as typeof affiliatePlatform)}>
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
              {generate.isPending ? "A gerar campanha…" : "GERAR CAMPANHA"}
            </Button>
          </form>

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
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Secções da campanha">
                {(
                  [
                    ["summary", "Resumo do produto"],
                    ["keywords", "Palavras-chave"],
                    ["negatives", "Negativas"],
                    ["ads", "Anúncios"],
                    ["extensions", "Extensões"],
                    ["review", "Revisão final"],
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
              {studioTab === "summary" ? (
                <ProductSummary research={research} onCopy={(text) => void copyText(text, "Copiado")} />
              ) : null}
              {studioTab === "ads" || studioTab === "extensions" || studioTab === "review" ? (
                research.bundle ? (
                  <CreativePanels
                    tab={studioTab === "ads" ? "ad" : studioTab === "extensions" ? "assets" : "review"}
                    bundle={research.bundle}
                    issues={research.validation ?? []}
                    onChange={(bundle) => {
                      setDraftDirty(true);
                      setResearch({ ...research, bundle });
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Esta pesquisa antiga não tem pacote de anúncios. Gera de novo para o criar.</p>
                )
              ) : null}
              {studioTab === "keywords" || studioTab === "negatives" ? (
              <>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {studioTab === "negatives" ? "Negativas para" : "Palavras-chave para"}
                </p>
                <h2 className="text-xl font-semibold tracking-tight">{research.product}</h2>
                <p className="text-sm text-muted-foreground">
                  {research.bundle?.analysis?.affiliatePlatformLabel ?? platformLabel(research.platform)}
                  {" · "}
                  {FUNNEL_OPTIONS.find((option) => option.id === research.bundle?.analysis?.funnel)?.title ?? "Funil da pesquisa"}
                  {" · "}
                  {research.language_label}
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

              {studioTab === "keywords" ? <div className="flex flex-wrap gap-1.5">
                {KEYWORD_INTENT_FILTERS.filter((f) => f.id !== "NEGATIVE").map((f) => (
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
              </div> : null}

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
                  {studioTab === "keywords" ? KEYWORD_FUNNEL_SECTIONS.map((section) => {
                    const rows = visible.filter((k) => k.intent !== "NEGATIVE" && keywordFunnel(k) === section.id);
                    if (!rows.length) return null;
                    const onToggle = (keyword: string) => setSelected((s) => toggleKeywordSelection(s, keyword));
                    return (
                      <section key={section.id} className="space-y-2">
                        <h3 className="text-sm font-semibold pt-2">{section.title}</h3>
                        <p className="text-xs text-muted-foreground">{section.hint}</p>
                        <KeywordList rows={rows} selected={selected} onToggle={onToggle} onEdit={editKeyword} />
                      </section>
                    );
                  }) : null}
                  {studioTab === "negatives" ? (() => {
                    const rows = (research?.keywords ?? []).filter((k) => k.intent === "NEGATIVE" && (!query.trim() || k.keyword.toLowerCase().includes(query.trim().toLowerCase())));
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
                  })() : null}
                </>
              )}
              </>
              ) : null}
              {research.bundle ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const bundle = research.bundle as AdBundle;
                      const funnelName = FUNNEL_OPTIONS.find((option) => option.id === bundle.analysis?.funnel)?.title ?? "Campanha";
                      void copyText(
                        campaignReviewText({
                          product: research.product,
                          language: research.language_label,
                          funnel: funnelName,
                          keywords: research.keywords,
                          headlines: bundle.headlines.map((item) => item.text),
                          descriptions: bundle.descriptions.map((item) => item.text),
                          sitelinks: bundle.sitelinks.map((item) => [item.text, item.description1, item.description2, item.url].filter(Boolean).join(" — ")),
                          callouts: bundle.callouts.map((item) => item.text),
                        }),
                        "Campanha copiada",
                      );
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copiar campanha
                  </Button>
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
