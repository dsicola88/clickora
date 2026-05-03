import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CircleDashed, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleAdsCountriesSelect, GoogleAdsLanguagesSelect } from "@/components/dpilot/GoogleAdsTargetingSelect";
import { GOOGLE_ADS_COUNTRY_OPTIONS, GOOGLE_ADS_LANGUAGE_OPTIONS } from "@/lib/googleAdsTargeting";
import { paidAdsService } from "@/services/paidAdsService";
import { DpilotAdsCampaignWizardShell } from "./DpilotAdsCampaignWizardShell";
import { DpilotAdsWizardFormPreviewSplit } from "./DpilotAdsWizardFormPreviewSplit";
import { DpilotCampaignReadinessCard } from "./DpilotCampaignReadinessCard";
import { DpilotWizardFormSection } from "./DpilotWizardFormSection";
import {
  DpilotGoogleManualSearchCampaignBlock,
  type GoogleManualWizardContextPreview,
} from "./DpilotGoogleManualSearchCampaignBlock";
import { DpilotGoogleSearchAdPreview } from "./DpilotGoogleSearchAdPreview";
import { DpilotKeywordDecisionCard } from "./DpilotKeywordDecisionCard";
import { Gate } from "./DpilotPaidPages";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DPILOT_OFFER_TEMPLATE } from "./dpilotOfferTemplate";
import {
  createEmptyGoogleManualPlanForm,
  formStateToGoogleManualPlanPayload,
  hydrateManualGoogleFormFromBrief,
} from "./googleManualSearchPlanForm";
import {
  DpilotGoogleWizardCampaignTypeStep,
  DpilotGoogleWizardDetailsStepHeader,
  DpilotGoogleWizardObjectiveStep,
  GOOGLE_WIZARD_OBJECTIVES,
} from "./DpilotGoogleWizardCampaignSetup";

const DPILOT_GOOGLE_CAMPAIGN_STEPS = [
  { id: "dpilot-wiz-google-obj", label: "Objetivo e tipo" },
  { id: "dpilot-wiz-google-offer", label: "Landing e oferta" },
  { id: "dpilot-wiz-google-budget", label: "Orçamento e licitação" },
  { id: "dpilot-wiz-google-geo", label: "Localização e idioma" },
  { id: "dpilot-wiz-google-kw", label: "Palavras-chave" },
  { id: "dpilot-wiz-google-signals", label: "Sinais do produto" },
  { id: "dpilot-wiz-google-submit", label: "Gerar plano" },
] as const;

const DEFAULT_LEADS_OBJECTIVE =
  GOOGLE_WIZARD_OBJECTIVES.find((o) => o.id === "leads")?.objective ??
  "Gerar pedidos de contacto ou inscrições qualificadas com custo por lead sob controlo.";

const schema = z.object({
  landingUrl: z.string().url("Informe uma URL válida").max(500),
  offer: z.string().trim().min(3, "Descreva a oferta").max(500),
  objective: z.string().trim().min(3, "Indique o objetivo da campanha").max(200),
  dailyBudgetUsd: z.number().min(1).max(100000),
});

type GoogleBiddingStrategy =
  | "manual_cpc"
  | "maximize_clicks"
  | "maximize_conversions"
  | "target_cpa"
  | "target_roas";

const GOOGLE_BIDDING_OPTIONS: { value: GoogleBiddingStrategy; label: string }[] = [
  { value: "manual_cpc", label: "CPC manual" },
  { value: "maximize_clicks", label: "Maximizar cliques" },
  { value: "maximize_conversions", label: "Maximizar conversões" },
  { value: "target_cpa", label: "CPA alvo" },
  { value: "target_roas", label: "ROAS alvo" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DpilotGoogleWizardPage() {
  const { projectId } = useDpilotPaid();
  const navigate = useNavigate();
  const base = `/tracking/dpilot/p/${projectId}`;

  const [landingUrl, setLandingUrl] = useState("");
  const [offer, setOffer] = useState("");
  const [objective, setObjective] = useState(DEFAULT_LEADS_OBJECTIVE);
  const [dailyBudget, setDailyBudget] = useState("25");
  /** Cliques alvo por dia — alimenta o cálculo de CPC e o motor de decisão da análise de keyword. */
  const [desiredClicks, setDesiredClicks] = useState("");
  const [geoTargets, setGeoTargets] = useState<string[]>(["BR", "PT"]);
  const [languageTargets, setLanguageTargets] = useState<string[]>(["pt"]);
  const [optPauseUsd, setOptPauseUsd] = useState("");
  const [optPauseClicks, setOptPauseClicks] = useState("");
  const [googleBiddingStrategy, setGoogleBiddingStrategy] =
    useState<GoogleBiddingStrategy>("maximize_conversions");
  const [googleTargetCpaUsd, setGoogleTargetCpaUsd] = useState("");
  const [googleTargetRoas, setGoogleTargetRoas] = useState("");
  /** Sinais reais do produto — usados textualmente nos anúncios; campos vazios são ignorados (nada é inventado). */
  const [psPrice, setPsPrice] = useState("");
  const [psPriceFull, setPsPriceFull] = useState("");
  const [psDiscount, setPsDiscount] = useState("");
  const [psGuarantee, setPsGuarantee] = useState("");
  const [psShipping, setPsShipping] = useState("");
  const [psBonuses, setPsBonuses] = useState("");
  const [psCertifications, setPsCertifications] = useState("");
  /** Bundles separados por nova linha (ex.: "1 Bottle $69" / "3 Bottles $177" / "6 Bottles $294"). */
  const [psBundles, setPsBundles] = useState("");
  /** Atributos separados por vírgula ou nova linha (ex.: "100% Organic, 100% Natural"). */
  const [psAttributes, setPsAttributes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Quando `true`, abre o painel "Detalhes do produto" para o utilizador ver de relance o que foi extraído (sem ter de o abrir à mão). */
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [campaignSeedKeyword, setCampaignSeedKeyword] = useState<string | null>(null);
  const [googleAdsLinked, setGoogleAdsLinked] = useState<boolean | null>(null);
  const [googleSearchPlanMode, setGoogleSearchPlanMode] = useState<"assistant" | "manual">("assistant");
  const [manualPlanForm, setManualPlanForm] = useState(createEmptyGoogleManualPlanForm());

  /** Estado do feedback ao vivo da extracção em background.
   *  - `extracting`: spinner + lista cinzenta enquanto fetch corre
   *  - `done`: cada passo marcado como ✓ encontrado ou ⊘ não detectado
   *  - `error`: mensagem em vermelho (a próxima alteração da URL re-tenta) */
  type FeedbackStep = {
    key: string;
    label: string;
    state: "pending" | "found" | "missing";
  };
  type ExtractionFeedback =
    | { status: "extracting"; url: string; steps: FeedbackStep[] }
    | { status: "done"; url: string; steps: FeedbackStep[] }
    | { status: "error"; url: string; errorMsg: string };
  const [feedback, setFeedback] = useState<ExtractionFeedback | null>(null);

  /** Última URL que terminou (sucesso ou erro) — evita re-extrair se o utilizador apenas perde o foco. */
  const lastExtractedUrlRef = useRef<string | null>(null);
  /** Timer do debounce — cancelado se o utilizador continua a escrever. */
  const extractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ID monotónico do request mais recente. Respostas com ID antigo são descartadas
   *  para evitar flicker se o utilizador colou URL B antes da extracção de URL A terminar. */
  const requestIdRef = useRef(0);

  /** Lista de passos pendentes mostrada enquanto a extracção está a correr.
   *  A ordem reflecte o que o utilizador espera ver acontecer numa landing típica. */
  const buildPendingSteps = (): FeedbackStep[] => [
    { key: "page", label: "A aceder à página…", state: "pending" },
    { key: "headline", label: "A ler título e oferta…", state: "pending" },
    { key: "language", label: "A detectar idioma…", state: "pending" },
    { key: "price", label: "A procurar preço…", state: "pending" },
    { key: "guarantee", label: "A procurar garantia…", state: "pending" },
    { key: "shipping", label: "A procurar envio…", state: "pending" },
    { key: "certifications", label: "A procurar certificações…", state: "pending" },
  ];

  /** Lê a landing em background. Race-condition seguro: respostas com ID antigo são ignoradas
   *  quando o utilizador colou nova URL antes da anterior responder (evita flicker). */
  const autoExtract = async (url: string) => {
    const myId = ++requestIdRef.current;
    setError(null);
    setFeedback({ status: "extracting", url, steps: buildPendingSteps() });

    try {
      const { data, error: apiErr } = await paidAdsService.extractGoogleLanding(projectId, {
        landingUrl: url,
      });
      if (myId !== requestIdRef.current) return;
      if (apiErr || !data?.ok) {
        setFeedback({
          status: "error",
          url,
          errorMsg: apiErr || "Não foi possível ler a landing.",
        });
        return;
      }

      /** Aplicamos sinais ao state — só sobrescrevemos o que a landing trouxe; preservamos
       *  edições do utilizador em campos que ela não consegue determinar. */
      if (data.offer_suggestion) setOffer(data.offer_suggestion);
      if (data.language) {
        const lang = data.language.toLowerCase();
        const known = GOOGLE_ADS_LANGUAGE_OPTIONS.some((o) => o.value === lang);
        if (known && !languageTargets.includes(lang)) {
          setLanguageTargets([lang, ...languageTargets].slice(0, 10));
        }
      }
      const s = data.signals;
      if (s.price) setPsPrice(s.price);
      if (s.price_full) setPsPriceFull(s.price_full);
      if (s.discount) setPsDiscount(s.discount);
      if (s.guarantee) setPsGuarantee(s.guarantee);
      if (s.shipping) setPsShipping(s.shipping);
      if (s.certifications) setPsCertifications(s.certifications);
      if (s.attributes?.length) setPsAttributes(s.attributes.join(", "));
      if (s.bundles?.length) setPsBundles(s.bundles.join("\n"));
      if (s.bonuses) setPsBonuses(s.bonuses);

      /** Se o utilizador ainda não escreveu objectivo, infere a partir do hostname. Sem isto,
       *  o schema (`objective.min(3)`) bloquearia o submit mesmo com landing perfeita. */
      if (!objective.trim()) {
        setObjective(
          `Gerar conversões a partir de ${data.hostname} — alinhado com a oferta da landing.`,
        );
      }

      /** Abre o painel "Detalhes do produto" para o utilizador ver de relance o que ficou pré-preenchido. */
      setSignalsOpen(true);

      const found = (v: unknown): "found" | "missing" => (v ? "found" : "missing");
      setFeedback({
        status: "done",
        url,
        steps: [
          { key: "page", label: `Página acedida (${data.hostname})`, state: "found" },
          {
            key: "headline",
            label: data.offer_suggestion ? "Headline / oferta lida" : "Headline / oferta — não detectada",
            state: found(data.offer_suggestion),
          },
          {
            key: "language",
            label: data.language ? `Idioma: ${data.language.toUpperCase()}` : "Idioma — não detectado",
            state: found(data.language),
          },
          {
            key: "price",
            label: s.price ? `Preço: ${s.price}` : "Preço — não encontrado",
            state: found(s.price),
          },
          {
            key: "guarantee",
            label: s.guarantee ? `Garantia: ${s.guarantee}` : "Garantia — não detectada",
            state: found(s.guarantee),
          },
          {
            key: "shipping",
            label: s.shipping ? `Envio: ${s.shipping}` : "Envio — não identificado",
            state: found(s.shipping),
          },
          {
            key: "certifications",
            label: s.certifications ? `Certificações: ${s.certifications}` : "Sem certificações detectadas",
            state: found(s.certifications),
          },
        ],
      });
    } catch (err) {
      if (myId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : "Erro inesperado ao ler a landing.";
      setFeedback({ status: "error", url, errorMsg: msg });
    }
  };

  /** Mantém referência sempre actual de `autoExtract` para o `useEffect` poder chamá-la sem
   *  a incluir nas deps (que iria recriar o efeito a cada render e re-disparar a extracção). */
  const autoExtractRef = useRef(autoExtract);
  autoExtractRef.current = autoExtract;

  /** Auto-extracção em background com debounce de 700 ms.
   *  - URL vazia limpa o feedback
   *  - URL inválida espera silenciosamente que se torne válida
   *  - URL já extraída não re-dispara (mesmo que o componente re-renderize) */
  useEffect(() => {
    if (extractTimerRef.current) {
      clearTimeout(extractTimerRef.current);
      extractTimerRef.current = null;
    }
    const trimmed = landingUrl.trim();
    if (!trimmed) {
      setFeedback(null);
      lastExtractedUrlRef.current = null;
      return;
    }
    const urlOk = z.string().url().safeParse(trimmed);
    if (!urlOk.success) return;
    if (lastExtractedUrlRef.current === trimmed) return;

    extractTimerRef.current = setTimeout(() => {
      lastExtractedUrlRef.current = trimmed;
      void autoExtractRef.current(trimmed);
    }, 700);

    return () => {
      if (extractTimerRef.current) {
        clearTimeout(extractTimerRef.current);
        extractTimerRef.current = null;
      }
    };
  }, [landingUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await paidAdsService.getOverview(projectId);
      if (cancelled) return;
      if (error || !data?.connection) {
        setGoogleAdsLinked(false);
        return;
      }
      setGoogleAdsLinked(data.connection.status === "connected");
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const landingHostname = useMemo(() => {
    const t = landingUrl.trim();
    if (!t) return "";
    try {
      return new URL(t).hostname.replace(/^www\./i, "");
    } catch {
      return "";
    }
  }, [landingUrl]);

  const lastSeedLandingRef = useRef(landingUrl);
  useEffect(() => {
    if (landingUrl !== lastSeedLandingRef.current) {
      setCampaignSeedKeyword(null);
      lastSeedLandingRef.current = landingUrl;
    }
  }, [landingUrl]);

  /** Cálculo do CPC inteligente: transforma "quanto pago por clique?" em "quantos cliques quero?".
   *  Compara contra a faixa típica de Google Search ($0.20–$3) e devolve veredicto humano. */
  const cpcCalc = useMemo<{
    value: string;
    tone: "ok" | "warn-low" | "warn-high";
    message: string;
  } | null>(() => {
    const budget = parseFloat(dailyBudget.replace(",", "."));
    const clicks = parseInt(desiredClicks.trim(), 10);
    if (!Number.isFinite(budget) || budget <= 0) return null;
    if (!Number.isFinite(clicks) || clicks <= 0) return null;
    const cpc = budget / clicks;
    if (cpc < 0.1) {
      return {
        value: cpc.toFixed(2),
        tone: "warn-low",
        message: "Muito baixo — provavelmente não compete no leilão. Reduz cliques alvo ou aumenta o orçamento.",
      };
    }
    if (cpc <= 3) {
      return {
        value: cpc.toFixed(2),
        tone: "ok",
        message: "Dentro da faixa típica de Google Search ($0.20–$3 / clique).",
      };
    }
    if (cpc <= 10) {
      return {
        value: cpc.toFixed(2),
        tone: "warn-high",
        message: "Acima da média — só justifica em nichos competitivos (B2B, jurídico, financeiro).",
      };
    }
    return {
      value: cpc.toFixed(2),
      tone: "warn-high",
      message: "Muito alto — orçamento esgota com poucos cliques. Reconsidera o número de cliques alvo.",
    };
  }, [dailyBudget, desiredClicks]);

  const insightBudgetUsd = useMemo(() => {
    const budget = parseFloat(dailyBudget.replace(",", "."));
    return Number.isFinite(budget) && budget > 0 ? budget : null;
  }, [dailyBudget]);

  const insightDesiredClicksPerDay = useMemo(() => {
    const clicks = parseInt(desiredClicks.trim(), 10);
    return Number.isFinite(clicks) && clicks > 0 ? clicks : null;
  }, [desiredClicks]);

  /** Constrói o objecto product_signals só com os campos preenchidos; devolve undefined se tudo vazio. */
  const buildProductSignals = (): NonNullable<
    Parameters<typeof paidAdsService.postGoogleCampaignPlan>[1]["product_signals"]
  > | undefined => {
    const splitLines = (raw: string, max: number): string[] =>
      raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max);
    const ps: NonNullable<
      Parameters<typeof paidAdsService.postGoogleCampaignPlan>[1]["product_signals"]
    > = {};
    if (psPrice.trim()) ps.price = psPrice.trim();
    if (psPriceFull.trim()) ps.price_full = psPriceFull.trim();
    if (psDiscount.trim()) ps.discount = psDiscount.trim();
    if (psGuarantee.trim()) ps.guarantee = psGuarantee.trim();
    if (psShipping.trim()) ps.shipping = psShipping.trim();
    if (psBonuses.trim()) ps.bonuses = psBonuses.trim();
    if (psCertifications.trim()) ps.certifications = psCertifications.trim();
    const bundles = splitLines(psBundles, 6);
    if (bundles.length) ps.bundles = bundles;
    const attrs = splitLines(psAttributes, 8);
    if (attrs.length) ps.attributes = attrs;
    return Object.keys(ps).length ? ps : undefined;
  };

  /** Lógica central de submissão — usa o state actual do formulário (auto-extracção já o
   *  sincronizou). O utilizador clica "Gerar plano" depois de a página estar pré-preenchida. */
  const submitPlan = async () => {
    setError(null);
    const parsed = schema.safeParse({
      landingUrl,
      offer,
      objective,
      dailyBudgetUsd: Number(dailyBudget),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const geoArr = geoTargets.map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
    if (!geoArr.length) {
      setError("Seleccione pelo menos uma localização (país).");
      return;
    }
    const langArr = languageTargets.map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 10);
    if (!langArr.length) {
      setError("Selecione pelo menos um idioma dos anúncios.");
      return;
    }
    setSubmitting(true);
    try {
      let optimizer_pause_spend_usd: number | undefined;
      let optimizer_pause_min_clicks: number | undefined;
      if (optPauseUsd.trim() !== "") {
        const x = parseFloat(optPauseUsd.replace(",", "."));
        if (!Number.isFinite(x) || x <= 0) {
          setError("Pausa automática USD: número positivo ou deixe vazio.");
          setSubmitting(false);
          return;
        }
        optimizer_pause_spend_usd = x;
      }
      if (optPauseClicks.trim() !== "") {
        const x = parseInt(optPauseClicks.trim(), 10);
        if (!Number.isFinite(x) || x < 0 || x > 500) {
          setError("Cliques mínimos: inteiro entre 0 e 500 ou vazio.");
          setSubmitting(false);
          return;
        }
        optimizer_pause_min_clicks = x;
      }

      if (googleBiddingStrategy === "target_cpa") {
        const x = parseFloat(googleTargetCpaUsd.replace(",", "."));
        if (!Number.isFinite(x) || x <= 0) {
          setError("CPA alvo: indique um valor USD positivo.");
          setSubmitting(false);
          return;
        }
      }
      if (googleBiddingStrategy === "target_roas") {
        const x = parseFloat(googleTargetRoas.replace(",", "."));
        if (!Number.isFinite(x) || x <= 0) {
          setError("ROAS alvo: indique um número positivo (ex.: 3.5).");
          setSubmitting(false);
          return;
        }
      }

      let google_manual_search_plan:
        | Parameters<typeof paidAdsService.postGoogleCampaignPlan>[1]["google_manual_search_plan"]
        | undefined;
      if (googleSearchPlanMode === "manual") {
        const mp = formStateToGoogleManualPlanPayload(manualPlanForm);
        if (!mp.ok) {
          setError(mp.error);
          setSubmitting(false);
          return;
        }
        google_manual_search_plan = mp.plan;
      }

      const body: Parameters<typeof paidAdsService.postGoogleCampaignPlan>[1] = {
        landingUrl: parsed.data.landingUrl,
        offer: parsed.data.offer,
        objective: parsed.data.objective,
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        geoTargets: geoArr,
        languageTargets: langArr,
        google_bidding_strategy: googleBiddingStrategy,
        google_search_plan_mode: googleSearchPlanMode,
        ...(google_manual_search_plan ? { google_manual_search_plan } : {}),
      };
      if (googleBiddingStrategy === "target_cpa") {
        body.google_target_cpa_usd = parseFloat(googleTargetCpaUsd.replace(",", "."));
      }
      if (googleBiddingStrategy === "target_roas") {
        body.google_target_roas = parseFloat(googleTargetRoas.replace(",", "."));
      }
      /** CPC calculado a partir de "Cliques alvo / dia" — só faz sentido com `manual_cpc`,
       *  onde vira o `cpcBidMicros` por defeito do AdGroup. Para outras estratégias o Google
       *  define o lance dinamicamente, por isso não enviamos. */
      if (googleBiddingStrategy === "manual_cpc" && cpcCalc) {
        const cpcNumber = Number(cpcCalc.value);
        if (Number.isFinite(cpcNumber) && cpcNumber > 0) {
          body.google_max_cpc_usd = cpcNumber;
        }
      }
      if (optimizer_pause_spend_usd !== undefined) body.optimizer_pause_spend_usd = optimizer_pause_spend_usd;
      if (optimizer_pause_min_clicks !== undefined) body.optimizer_pause_min_clicks = optimizer_pause_min_clicks;

      const productSignals = buildProductSignals();
      if (productSignals) body.product_signals = productSignals;
      if (campaignSeedKeyword?.trim() && googleSearchPlanMode === "assistant") {
        body.campaign_seed_keyword = campaignSeedKeyword.trim().slice(0, 80);
      }

      const { data, error: apiErr } = await paidAdsService.postGoogleCampaignPlan(projectId, body);
      if (apiErr || !data?.ok) {
        const msg = apiErr || "Falha ao gerar plano";
        setError(msg);
        toast.error("Falha ao gerar plano", { description: msg });
        return;
      }
      const planGenNote =
        data.planSource === "manual"
          ? " Plano Pesquisa manual (sem IA; estrutura editada no assistente)."
          : data.planSource === "deterministic"
            ? " Modo de reserva: sem chamada ao modelo (regras fixas)."
            : " Texto gerado com chamada ao modelo de IA.";
      if (data.autoApplied) {
        toast.success("Plano aplicado pelo Autopilot", {
          description: `Dentro dos guardrails — publicação no Google tentada.${planGenNote}`,
        });
      } else if (data.reasons && data.reasons.length > 0) {
        toast.warning("Plano enviado para aprovação", {
          description: `${data.reasons[0]?.message ?? "Ver guardrails e fila de aprovações."}${planGenNote}`,
        });
      } else {
        toast.success("Plano gerado", {
          description: `Rascunho e pedido criados. Consulte «Aprovações» para rever o pedido.${planGenNote}`,
        });
      }
      navigate(`${base}/aprovacoes`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(msg);
      toast.error("Falha ao gerar plano", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  /** Handler do submit do formulário — usa apenas o que o utilizador tem no state. */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPlan();
  };

  const manualWizardContextPreview = useMemo((): GoogleManualWizardContextPreview => {
    return {
      dailyBudgetUsd: dailyBudget.trim() || undefined,
      biddingStrategyLabel: GOOGLE_BIDDING_OPTIONS.find((o) => o.value === googleBiddingStrategy)?.label,
      geoSummary: geoTargets.length ? geoTargets.join(", ") : undefined,
      languageSummary: languageTargets.length ? languageTargets.join(", ") : undefined,
    };
  }, [dailyBudget, googleBiddingStrategy, geoTargets, languageTargets]);

  return (
    <Gate>
      <DpilotAdsCampaignWizardShell
        platform="google"
        platformBadge="Google Ads · Pesquisa"
        steps={[...DPILOT_GOOGLE_CAMPAIGN_STEPS]}
        subtitle={
          <>
            Assistente alinhado com o fluxo de <strong className="font-medium text-foreground">Pesquisa</strong> no Google Ads:
            objectivo da campanha, estratégia de licitação, segmentação e palavras‑chave, com pré‑via automática opcional da
            landing — só incorporamos sinais que valida antes de criar.
          </>
        }
        hint={
          <span className="text-muted-foreground">
            <strong className="font-medium text-foreground">Antes da primeira publicação</strong>, escolha mais abaixo se o
            plano é{" "}
            <strong className="font-medium text-foreground">
              gerado com apoio de IA ou definido integralmente manualmente
            </strong>
            — ambos ficam dentro dos guardrails ao submeter «Gerar plano».{" "}
            <strong className="font-medium text-foreground">Depois de estar na conta Google</strong>, atualize grupos,
            palavras‑chave, anúncios RSA, CPC, pausas e orçamento na página{" "}
            <Link to={`${base}/campanhas`} className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
              Campanhas
            </Link>{" "}
            (botão «Gestão» nas linhas Google) — modo Copilot regista auditoria através de «Aprovações» quando aplicável.
          </span>
        }
        backHref={`${base}/campanhas`}
        backLabel="Voltar às campanhas"
        readiness={<DpilotCampaignReadinessCard platform="google" />}
      >
        <DpilotAdsWizardFormPreviewSplit
          autoSaveId={projectId ? `dpilot-google-wizard-split-${projectId}` : "dpilot-google-wizard-split"}
          preview={
            <aside className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none lg:sticky lg:top-2">
              <DpilotGoogleSearchAdPreview
                landingUrl={landingUrl}
                offer={offer}
                seedKeyword={campaignSeedKeyword}
                price={psPrice}
                discount={psDiscount}
                guarantee={psGuarantee}
                shipping={psShipping}
                bundles={psBundles}
              />
            </aside>
          }
          form={
            <form id="dpilot-google-wizard-form" onSubmit={onSubmit} className="min-w-0 space-y-6">
          <DpilotWizardFormSection
            id="dpilot-wiz-google-obj"
            platform="google"
            stepLabel="Passo 1 de 7"
            title="Objetivo e tipo de campanha"
            description="Defina o raciocínio comercial e o posicionamento antes de destino, modo de construção e orçamento."
          >
            <DpilotGoogleWizardObjectiveStep objective={objective} onObjectiveChange={setObjective} />
            <DpilotGoogleWizardCampaignTypeStep />
            <DpilotGoogleWizardDetailsStepHeader />
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-google-offer"
            platform="google"
            stepLabel="Passo 2 de 7"
            title="Landing e proposta de valor"
            description="URL obrigatória; a extracção pode pré‑preencher a oferta — confirme factos antes de publicar. Neste passo escolhe também se a estrutura de Pesquisa é sugerida pela IA ou definida manualmente (cartão imediatamente abaixo)."
          >
            <Field
              label="URL da landing page"
              hint="Cola o URL — a IA lê a página automaticamente e preenche os campos abaixo. Tudo é editável."
            >
              <Input
                id="g-wiz-landing"
                type="url"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                autoComplete="url"
                placeholder="https://exemplo.com/produto"
                required
              />
              {feedback ? (
                <div
                  className={
                    "mt-2 rounded-md border px-3 py-2 text-[12px] " +
                    (feedback.status === "error"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-emerald-500/20 bg-emerald-500/[0.04] text-foreground")
                  }
                  aria-live="polite"
                >
                  {feedback.status === "extracting" ? (
                    <div className="flex items-center gap-2 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
                      <span>🔍 A analisar a página…</span>
                    </div>
                  ) : feedback.status === "error" ? (
                    <div className="font-medium">
                      ⚠ Não consegui ler a landing: <span className="font-normal">{feedback.errorMsg}</span>
                    </div>
                  ) : (
                    <div className="font-medium">
                      ✔ Pronto. Os campos abaixo já reflectem a landing — confirma e edita o que quiseres.
                    </div>
                  )}
                  {feedback.status !== "error" ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {feedback.steps.map((step) => (
                        <li key={step.key} className="flex items-center gap-2 text-[11px]">
                          {step.state === "pending" ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                          ) : step.state === "found" ? (
                            <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          ) : (
                            <CircleDashed className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />
                          )}
                          <span
                            className={
                              step.state === "missing"
                                ? "text-muted-foreground/80"
                                : "text-foreground"
                            }
                          >
                            {step.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </Field>

            <Field
              label="Oferta / proposta de valor"
            >
              <Textarea
                id="g-wiz-offer"
                rows={4}
                maxLength={500}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Ex.: Software de automação para PME retalhistas — reduz trabalho manual em stock e facturação + integração Shopify. Trial 14 dias; a partir de 49 €/mês."
                aria-describedby="g-wiz-offer-hint"
                required
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs font-normal"
                  onClick={() => setOffer(DPILOT_OFFER_TEMPLATE.trim())}
                >
                  Inserir modelo editável (4 linhas)
                </Button>
                <span id="g-wiz-offer-hint" className="tabular-nums text-[11px] text-muted-foreground">
                  {offer.length}/500
                </span>
              </div>
            </Field>

            <DpilotGoogleManualSearchCampaignBlock
              mode={googleSearchPlanMode}
              onModeChange={(m) => {
                setGoogleSearchPlanMode(m);
                if (m === "manual") {
                  setManualPlanForm((prev) =>
                    hydrateManualGoogleFormFromBrief(prev, {
                      offer,
                      objective,
                      seed: campaignSeedKeyword,
                    }),
                  );
                }
              }}
              manualForm={manualPlanForm}
              onManualFormChange={setManualPlanForm}
              wizardContextPreview={manualWizardContextPreview}
            />
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-google-budget"
            platform="google"
            stepLabel="Passo 3 de 7"
            title="Orçamento e licitação"
            description="Combina gasto diário com estratégia de conversões ou cliques; estimativas são indicativas para o briefing."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Orçamento diário (USD)">
                <Input
                  type="number"
                  min={1}
                  step="0.01"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Cliques alvo / dia (opcional)"
                hint="Em vez de pensar em CPC, indica quantos cliques queres por dia. Calculamos o CPC máximo possível."
              >
                <Input
                  type="number"
                  min={1}
                  step="1"
                  inputMode="numeric"
                  placeholder="Ex.: 20"
                  value={desiredClicks}
                  onChange={(e) => setDesiredClicks(e.target.value)}
                />
              </Field>
            </div>

            {cpcCalc ? (
              <div
                className={
                  "rounded-lg border px-3 py-2.5 text-[12px] " +
                  (cpcCalc.tone === "ok"
                    ? "border-emerald-500/20 bg-emerald-500/[0.06] text-foreground"
                    : cpcCalc.tone === "warn-low"
                      ? "border-amber-500/30 bg-amber-500/[0.08] text-foreground"
                      : "border-rose-500/30 bg-rose-500/[0.08] text-foreground")
                }
                aria-live="polite"
              >
                <div className="font-medium">
                  CPC máximo estimado: <span className="tabular-nums">${cpcCalc.value}</span> / clique
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    (orçamento ÷ cliques alvo)
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {cpcCalc.tone === "ok" ? "✔ " : "⚠ "}
                  {cpcCalc.message}
                </div>
                {googleBiddingStrategy === "manual_cpc" ? (
                  <div className="mt-1.5 rounded-sm bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                    ✔ Vai ser aplicado como lance máximo CPC (`cpcBidMicros`) em cada AdGroup ao publicar.
                  </div>
                ) : (
                  <div className="mt-1.5 rounded-sm bg-amber-500/15 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300">
                    ⓘ Apenas indicativo: a estratégia escolhida ({GOOGLE_BIDDING_OPTIONS.find((o) => o.value === googleBiddingStrategy)?.label ?? googleBiddingStrategy}) deixa o Google definir o CPC. Para aplicar este valor, escolhe «CPC manual» abaixo.
                  </div>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground/80">
                  Estimativa indicativa. CPC real depende do nicho, palavras-chave e concorrência no leilão.
                </div>
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="g-bidding-strat" className="text-xs font-medium">
                  Estratégia de licitação (enviada à Google Ads)
                </Label>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Isto é o que a <strong className="font-medium text-foreground">conta Google</strong> usa no leilão.
                  «Maximizar conversões», «CPA alvo» ou «ROAS alvo» combinam melhor com o briefing{" "}
                  <strong className="font-medium text-foreground">Vendas</strong> ou{" "}
                  <strong className="font-medium text-foreground">Leads</strong> — desde que tenha conversões e dados
                  configurados. «Maximizar cliques» ou «CPC manual» alinham mais com{" "}
                  <strong className="font-medium text-foreground">Tráfego do site</strong>.
                </p>
              </div>
              <select
                id="g-bidding-strat"
                value={googleBiddingStrategy}
                onChange={(e) => setGoogleBiddingStrategy(e.target.value as GoogleBiddingStrategy)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {GOOGLE_BIDDING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {googleBiddingStrategy === "target_cpa" ? (
                <Field label="CPA alvo (USD por conversão)">
                  <Input
                    id="g-bidding-cpa"
                    inputMode="decimal"
                    placeholder="Ex.: 25"
                    value={googleTargetCpaUsd}
                    onChange={(e) => setGoogleTargetCpaUsd(e.target.value)}
                    required
                  />
                </Field>
              ) : null}
              {googleBiddingStrategy === "target_roas" ? (
                <Field label="ROAS alvo (receita / gasto em anúncios)">
                  <Input
                    id="g-bidding-roas"
                    inputMode="decimal"
                    placeholder="Ex.: 4"
                    value={googleTargetRoas}
                    onChange={(e) => setGoogleTargetRoas(e.target.value)}
                    required
                  />
                </Field>
              ) : null}
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-google-geo"
            platform="google"
            stepLabel="Passo 4 de 7"
            title="Segmentação geo e idioma"
            description="Áreas e idiomas alinhados à proposta — condicionam texto e dados de pesquisa no motor."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <GoogleAdsCountriesSelect
                label="País"
                hint=""
                searchPlaceholder="Pesquisar país…"
                emptyText="Nenhum país encontrado."
                options={GOOGLE_ADS_COUNTRY_OPTIONS}
                value={geoTargets}
                onChange={setGeoTargets}
                max={20}
              />
              <GoogleAdsLanguagesSelect
                label="Idiomas do anúncio"
                hint=""
                searchPlaceholder="Pesquisar idioma…"
                emptyText="Nenhum idioma encontrado."
                options={GOOGLE_ADS_LANGUAGE_OPTIONS}
                value={languageTargets}
                onChange={setLanguageTargets}
                max={10}
              />
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-google-kw"
            platform="google"
            stepLabel="Passo 5 de 7"
            title="Palavras‑chave e protecção da campanha"
            description="Volumes, intenção e palavra-semente para o grupo; opcionalmente regras de pausa antes de despesa sem conversão."
          >
            {googleSearchPlanMode === "assistant" ? (
              <DpilotKeywordDecisionCard
                projectId={projectId}
                offer={offer}
                landingHostname={landingHostname}
                primaryCountryCode={(geoTargets[0] ?? "").trim().toUpperCase()}
                primaryLanguageCode={(languageTargets[0] ?? "pt").trim().toLowerCase()}
                geoCountryCodes={geoTargets.map((g) => g.trim().toUpperCase()).filter(Boolean)}
                userCpcUsd={cpcCalc != null ? Number(cpcCalc.value) : null}
                dailyBudgetUsd={insightBudgetUsd}
                desiredClicksPerDay={insightDesiredClicksPerDay}
                committedKeyword={campaignSeedKeyword}
                onCommitKeyword={setCampaignSeedKeyword}
                requireGoogleAdsConnection
                googleAdsConnected={googleAdsLinked}
                connectionsPageHref={`${base}/ligacoes`}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                No modo <strong className="text-foreground">manual</strong>, as correspondências das palavras-chave e todo
                o RSA estão definidos no passo «Landing e oferta». O orçamento, a licitação e a pausa automática continuam a
                aplicar‑se igualmente à campanha.
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-4">
              <p className="text-xs font-medium text-foreground">Pausa automática (opcional)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Gasto máximo USD (sem conv.)">
                  <Input
                    inputMode="decimal"
                    placeholder="Ex.: 50 ou vazio"
                    value={optPauseUsd}
                    onChange={(e) => setOptPauseUsd(e.target.value)}
                  />
                </Field>
                <Field label="Mínimo de cliques no período">
                  <Input
                    inputMode="numeric"
                    placeholder="Ex.: 5 ou vazio"
                    value={optPauseClicks}
                    onChange={(e) => setOptPauseClicks(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-google-signals"
            platform="google"
            stepLabel="Passo 6 de 7"
            title="Sinais opcionais do produto"
            description="Só valores que pode sustentar; campos em branco não são inferidos pela IA."
          >
            <details
              open={signalsOpen}
              onToggle={(e) => setSignalsOpen(e.currentTarget.open)}
              className="group space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-foreground">
                <span>
                  Detalhes do produto (opcional) — usados textualmente nos anúncios
                </span>
                <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Preencha apenas o que for verdade. Campos vazios são ignorados — o gerador <strong>nunca</strong> inventa
                preços, descontos, garantias, envios ou certificações.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Preço actual" hint='Ex.: "$49" ou "49 €"'>
                  <Input
                    placeholder="$49"
                    maxLength={20}
                    value={psPrice}
                    onChange={(e) => setPsPrice(e.target.value)}
                  />
                </Field>
                <Field label="Preço cheio (opcional)" hint='Ex.: "$79"'>
                  <Input
                    placeholder="$79"
                    maxLength={20}
                    value={psPriceFull}
                    onChange={(e) => setPsPriceFull(e.target.value)}
                  />
                </Field>
                <Field label="Desconto" hint='Ex.: "77% Off" ou "$120 Off"'>
                  <Input
                    placeholder="77% Off"
                    maxLength={28}
                    value={psDiscount}
                    onChange={(e) => setPsDiscount(e.target.value)}
                  />
                </Field>
                <Field label="Garantia" hint='Ex.: "180 Day Money Back"'>
                  <Input
                    placeholder="180 Day Money Back"
                    maxLength={40}
                    value={psGuarantee}
                    onChange={(e) => setPsGuarantee(e.target.value)}
                  />
                </Field>
                <Field label="Envio" hint='Ex.: "Free US Shipping"'>
                  <Input
                    placeholder="Free US Shipping"
                    maxLength={28}
                    value={psShipping}
                    onChange={(e) => setPsShipping(e.target.value)}
                  />
                </Field>
                <Field label="Bónus incluídos" hint='Ex.: "2 Free Bonuses"'>
                  <Input
                    placeholder="2 Free Bonuses"
                    maxLength={28}
                    value={psBonuses}
                    onChange={(e) => setPsBonuses(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Certificações" hint='Ex.: "FDA Approved & GMP Certified"'>
                <Input
                  placeholder="FDA Approved & GMP Certified"
                  maxLength={40}
                  value={psCertifications}
                  onChange={(e) => setPsCertifications(e.target.value)}
                />
              </Field>
              <Field
                label="Bundles / packs (uma linha por bundle, ≤30 caracteres)"
                hint={'Ex.: "1 Bottle $69" / "3 Bottles $177" / "6 Bottles $294"'}
              >
                <Textarea
                  rows={3}
                  placeholder={"1 Bottle $69\n3 Bottles $177\n6 Bottles $294"}
                  value={psBundles}
                  onChange={(e) => setPsBundles(e.target.value)}
                />
              </Field>
              <Field
                label="Atributos do produto (separados por vírgula ou nova linha, ≤30 caracteres cada)"
                hint='Ex.: "100% Organic, 100% Natural, Vegan"'
              >
                <Textarea
                  rows={2}
                  placeholder="100% Organic, 100% Natural"
                  value={psAttributes}
                  onChange={(e) => setPsAttributes(e.target.value)}
                />
              </Field>
            </details>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-google-submit"
            platform="google"
            stepLabel="Passo 7 de 7"
            title="Concluir e gerar plano"
            description="Cria pedido técnico e rascunho; em Copilot, confirme em «Aprovações» antes de «Aplicar na rede»."
          >
            {error ? (
              <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border/80 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Button type="submit" size="lg" disabled={submitting} className="min-w-[200px] font-semibold">
                <Sparkles className="mr-2 h-4 w-4" />
                {submitting ? "A gerar plano…" : "Gerar plano"}
              </Button>
            </div>
          </DpilotWizardFormSection>
        </form>
          }
        />
      </DpilotAdsCampaignWizardShell>
    </Gate>
  );
}
