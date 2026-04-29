import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lightbulb, Sparkles } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const body: Parameters<typeof paidAdsService.postGoogleCampaignPlan>[1] = {
        landingUrl: parsed.data.landingUrl,
        offer: parsed.data.offer,
        objective: parsed.data.objective,
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        geoTargets: geoArr,
        languageTargets: langArr,
      };
      if (optimizer_pause_spend_usd !== undefined) body.optimizer_pause_spend_usd = optimizer_pause_spend_usd;
      if (optimizer_pause_min_clicks !== undefined) body.optimizer_pause_min_clicks = optimizer_pause_min_clicks;

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
          description="Gera um plano de Pesquisa Google com IA. Em modo Copilot, ou quando os limites o exigirem, o pedido segue para «Aprovações» antes da rede aplicar alterações."
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
            <Field label="URL da landing page" hint="Para onde o clique no anúncio leva.">
              <Input
                id="g-wiz-landing"
                type="url"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                autoComplete="url"
                required
              />
            </Field>

            <div className="flex gap-2.5 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Como pensar nos dois próximos campos</p>
                <p className="mt-1">
                  <span className="text-foreground/90">Oferta:</span> o que vende, para quem, benefício principal e eventual prova/oferta comercial — isto alimenta títulos e descrições do anúncio.
                </p>
                <p className="mt-1">
                  <span className="text-foreground/90">Objetivo:</span> o resultado negócio desta campanha (métricas: leads, vendas, demos, visitas…). Ajuda o assistente a alinhar palavras-chave e texto.
                </p>
              </div>
            </div>

            <Field
              label="Oferta / proposta de valor"
              hint="Seja específico: produto ou serviço, público, diferencial frente à concorrência e oferta atual (trial, desconto, garantia)."
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

            <Field
              label="Objetivo da campanha"
              hint='Uma ou duas frases sobre o resultado de negócio (não apenas "campanhas de pesquisa"). O modelo usa isto junto da oferta para orientar criativos e palavras-chave.'
            >
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
            <div className="grid gap-4 sm:grid-cols-2">
              <GoogleAdsCountriesSelect
                label="Localizações — País"
                hint="Igual ao Google Ads: segmentação por país (critérios geo)."
                searchPlaceholder="Pesquisar país…"
                emptyText="Nenhum país encontrado."
                options={GOOGLE_ADS_COUNTRY_OPTIONS}
                value={geoTargets}
                onChange={setGeoTargets}
                max={20}
              />
              <GoogleAdsLanguagesSelect
                label="Idiomas dos anúncios"
                hint="Quem pode ver os anúncios pelo idioma — critérios de idioma Google Ads."
                searchPlaceholder="Pesquisar idioma…"
                emptyText="Nenhum idioma encontrado."
                options={GOOGLE_ADS_LANGUAGE_OPTIONS}
                value={languageTargets}
                onChange={setLanguageTargets}
                max={10}
              />
            </div>

            <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-4 space-y-3">
              <p className="text-xs font-medium text-foreground">Pausa automática sem conversões (opcional)</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Por defeito aplicam‑se os limites do projecto («Visão geral»). Aqui pode fixar apenas para esta campanha
                quando for criada.
              </p>
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

            {error ? (
              <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground max-w-md">
                O assistente gera rascunhos e um pedido de criação (campanha, grupos de anúncios, palavras-chave e anúncios
                RSA). A conta Google só é alterada quando os limites de segurança e o modo Copilot / Autopilot o permitirem.
              </p>
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
