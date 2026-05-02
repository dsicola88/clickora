import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleAdsCountriesSelect, GoogleAdsLanguagesSelect } from "@/components/dpilot/GoogleAdsTargetingSelect";
import { GOOGLE_ADS_COUNTRY_OPTIONS, GOOGLE_ADS_LANGUAGE_OPTIONS } from "@/lib/googleAdsTargeting";
import { paidAdsService } from "@/services/paidAdsService";
import { DpilotCampaignReadinessCard } from "./DpilotCampaignReadinessCard";
import { Gate } from "./DpilotPaidPages";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DPILOT_OFFER_TEMPLATE } from "./dpilotOfferTemplate";

const schema = z.object({
  landingUrl: z.string().url("Informe uma URL válida").max(500),
  offer: z.string().trim().min(3, "Descreva a oferta").max(500),
  objective: z.string().trim().min(3, "Indique o objetivo da campanha").max(200),
  dailyBudgetUsd: z.number().min(1).max(100000),
});

const OBJECTIVE_SUGGESTIONS: { label: string; objective: string }[] = [
  {
    label: "Leads / contactos",
    objective: "Gerar pedidos de contacto ou inscrições qualificadas com custo por lead sob controlo.",
  },
  {
    label: "Vendas / demos",
    objective: "Gerar demos agendadas ou compras/conversões com foco em retorno sobre investimento.",
  },
  {
    label: "Tráfego ao site",
    objective: "Aumentar visitas qualificadas à landing e melhorar o custo médio por clique.",
  },
  {
    label: "Marca / alcance",
    objective: "Aumentar notoriedade e presença em pesquisas relevantes para a marca.",
  },
];

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

  const [landingUrl, setLandingUrl] = useState("https://example.com");
  const [offer, setOffer] = useState("");
  const [objective, setObjective] = useState("Gerar leads no período de teste gratuito");
  const [dailyBudget, setDailyBudget] = useState("25");
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
  /** Estado da extracção da landing (botão «Buscar dados»). */
  const [extracting, setExtracting] = useState(false);
  /** Sumário do que foi pré-preenchido pela última extracção (mostrado abaixo da Oferta para o utilizador validar). */
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);

  /** Vai à landing, lê dados verificáveis e pré-preenche os campos. Utilizador valida antes de submeter. */
  const onExtractLanding = async () => {
    setError(null);
    setExtractedSummary(null);
    const urlOk = z.string().url().safeParse(landingUrl);
    if (!urlOk.success) {
      const msg = "Indique primeiro uma URL válida da landing.";
      setError(msg);
      toast.error("URL inválida", { description: msg });
      return;
    }
    setExtracting(true);
    try {
      const { data, error: apiErr } = await paidAdsService.extractGoogleLanding(projectId, {
        landingUrl,
      });
      if (apiErr || !data?.ok) {
        const msg = apiErr || "Não foi possível ler a landing.";
        setError(msg);
        toast.error("Falha ao buscar dados", { description: msg });
        return;
      }
      const filled: string[] = [];
      if (data.offer_suggestion) {
        setOffer(data.offer_suggestion);
        filled.push("Oferta");
      }
      if (data.language) {
        const lang = data.language.toLowerCase();
        const known = GOOGLE_ADS_LANGUAGE_OPTIONS.some((o) => o.value === lang);
        if (known && !languageTargets.includes(lang)) {
          setLanguageTargets([lang, ...languageTargets].slice(0, 10));
          filled.push(`Idioma (${lang})`);
        }
      }
      const s = data.signals;
      if (s.price) {
        setPsPrice(s.price);
        filled.push("preço");
      }
      if (s.price_full) {
        setPsPriceFull(s.price_full);
        filled.push("preço cheio");
      }
      if (s.discount) {
        setPsDiscount(s.discount);
        filled.push("desconto");
      }
      if (s.guarantee) {
        setPsGuarantee(s.guarantee);
        filled.push("garantia");
      }
      if (s.shipping) {
        setPsShipping(s.shipping);
        filled.push("envio");
      }
      if (s.certifications) {
        setPsCertifications(s.certifications);
        filled.push("certificações");
      }
      if (s.attributes?.length) {
        setPsAttributes(s.attributes.join(", "));
        filled.push("atributos");
      }
      if (s.bundles?.length) {
        setPsBundles(s.bundles.join("\n"));
        filled.push("bundles");
      }
      if (s.bonuses) {
        setPsBonuses(s.bonuses);
        filled.push("bónus");
      }
      const summary = filled.length
        ? `Pré-preenchi: ${filled.join(", ")}. Confirma e ajusta antes de gerar.`
        : "Página acedida, mas não consegui extrair sinais. Preenche manualmente o que for verdadeiro.";
      setExtractedSummary(summary);
      toast.success("Dados da landing carregados", { description: summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(msg);
      toast.error("Falha ao buscar dados", { description: msg });
    } finally {
      setExtracting(false);
    }
  };

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const body: Parameters<typeof paidAdsService.postGoogleCampaignPlan>[1] = {
        landingUrl: parsed.data.landingUrl,
        offer: parsed.data.offer,
        objective: parsed.data.objective,
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        geoTargets: geoArr,
        languageTargets: langArr,
        google_bidding_strategy: googleBiddingStrategy,
      };
      if (googleBiddingStrategy === "target_cpa") {
        body.google_target_cpa_usd = parseFloat(googleTargetCpaUsd.replace(",", "."));
      }
      if (googleBiddingStrategy === "target_roas") {
        body.google_target_roas = parseFloat(googleTargetRoas.replace(",", "."));
      }
      if (optimizer_pause_spend_usd !== undefined) body.optimizer_pause_spend_usd = optimizer_pause_spend_usd;
      if (optimizer_pause_min_clicks !== undefined) body.optimizer_pause_min_clicks = optimizer_pause_min_clicks;

      const productSignals = buildProductSignals();
      if (productSignals) body.product_signals = productSignals;

      const { data, error: apiErr } = await paidAdsService.postGoogleCampaignPlan(projectId, body);
      if (apiErr || !data?.ok) {
        const msg = apiErr || "Falha ao gerar plano";
        setError(msg);
        toast.error("Falha ao gerar plano", { description: msg });
        return;
      }
      const planGenNote =
        data.planSource === "deterministic"
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

  return (
    <Gate>
      <div className="pb-12">
        <PageHeader
          title="Nova campanha"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                IA · Search
              </Badge>
              <Button variant="ghost" asChild>
                <Link to={`${base}/campanhas`}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                </Link>
              </Button>
            </div>
          }
        />
        <div className="mx-auto max-w-3xl space-y-5 px-0 py-4 sm:px-1 sm:py-6">
          <DpilotCampaignReadinessCard platform="google" />
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <Field
              label="URL da landing page"
              hint="Cola a URL e carrega «Buscar dados» — extraio título, idioma, preço, garantia, envio e certificações que existam mesmo na página."
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                  id="g-wiz-landing"
                  type="url"
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                  autoComplete="url"
                  required
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={onExtractLanding}
                  disabled={extracting || !landingUrl.trim()}
                >
                  <Wand2 className="mr-1 h-4 w-4" />
                  {extracting ? "A ler…" : "Buscar dados"}
                </Button>
              </div>
              {extractedSummary ? (
                <p className="mt-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                  {extractedSummary}
                </p>
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

            <Field label="Objetivo da campanha">
              <div className="flex flex-wrap gap-1.5 pb-2" role="group" aria-label="Sugestões de objetivo">
                {OBJECTIVE_SUGGESTIONS.map((s) => (
                  <Button
                    key={s.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full text-xs font-normal"
                    onClick={() => setObjective(s.objective)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <Textarea
                id="g-wiz-objective"
                rows={2}
                maxLength={200}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder='Ex.: "Gerar ≥20 pedidos de demo qualificados por semana ao custo médio inferior a X € por demo."'
                required
              />
              <p className="mt-1 text-right tabular-nums text-[11px] text-muted-foreground">{objective.length}/200</p>
            </Field>
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

            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <div className="space-y-1">
                <Label htmlFor="g-bidding-strat" className="text-xs font-medium">
                  Estratégia de licitação
                </Label>
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

            <details className="group space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-4 [&_summary::-webkit-details-marker]:hidden">
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

            {error ? (
              <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Button type="submit" disabled={submitting}>
                <Sparkles className="mr-1 h-4 w-4" />
                {submitting ? "A gerar plano…" : "Gerar plano"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Gate>
  );
}
