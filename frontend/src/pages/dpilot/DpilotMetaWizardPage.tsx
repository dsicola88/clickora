import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ImageIcon, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { DpilotAdsCampaignWizardShell } from "./DpilotAdsCampaignWizardShell";
import { DpilotAdsWizardFormPreviewSplit } from "./DpilotAdsWizardFormPreviewSplit";
import { DpilotCampaignReadinessCard } from "./DpilotCampaignReadinessCard";
import { DpilotWizardFormSection } from "./DpilotWizardFormSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleAdsCountriesSelect } from "@/components/dpilot/GoogleAdsTargetingSelect";
import { GOOGLE_ADS_COUNTRY_OPTIONS } from "@/lib/googleAdsTargeting";
import { paidAdsService } from "@/services/paidAdsService";
import { Gate } from "./DpilotPaidPages";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DPILOT_OFFER_TEMPLATE } from "./dpilotOfferTemplate";
import { DpilotMetaFeedAdPreview } from "./DpilotMetaFeedAdPreview";

const objectives = [
  {
    value: "traffic",
    label: "Tráfego para o site",
    hint: "Alinha com campanhas OUTCOME_TRAFFIC — foco em cliques e visitas.",
  },
  {
    value: "leads",
    label: "Leads",
    hint: "OUTCOME_LEADS — formulários, mensagens ou leads com pixel/eventos configurados.",
  },
  {
    value: "purchases",
    label: "Conversões / vendas",
    hint: "OUTCOME_SALES — compras ou conversões fora da plataforma com conjunto optimizado para conversões.",
  },
  {
    value: "awareness",
    label: "Reconhecimento",
    hint: "OUTCOME_AWARENESS — alcance e exposição da marca.",
  },
  {
    value: "engagement",
    label: "Interacções",
    hint: "OUTCOME_ENGAGEMENT — envolvimento com publicações ou vídeo.",
  },
  {
    value: "app_promotion",
    label: "Promoção de app",
    hint: "OUTCOME_APP_PROMOTION — instalações ou eventos in‑app.",
  },
] as const;

const placementOptions = [
  { value: "facebook_feed", label: "Feed Facebook" },
  { value: "instagram_feed", label: "Feed Instagram" },
  { value: "instagram_stories", label: "Stories Instagram" },
  { value: "instagram_reels", label: "Reels Instagram" },
  { value: "facebook_reels", label: "Reels Facebook" },
  { value: "audience_network", label: "Audience Network" },
  { value: "messenger", label: "Messenger" },
] as const;

type MetaBiddingStrategy = "lowest_cost" | "bid_cap_usd" | "cost_cap_usd";

const META_BIDDING_OPTIONS: { value: MetaBiddingStrategy; label: string; hint: string }[] = [
  {
    value: "lowest_cost",
    label: "Menor custo (automático)",
    hint: "LOWEST_COST_WITHOUT_CAP — a Meta optimiza dentro do orçamento.",
  },
  {
    value: "bid_cap_usd",
    label: "Limite máximo de licitação (USD)",
    hint: "LOWEST_COST_WITH_BID_CAP — teto por evento de optimização (Graph API em centavos).",
  },
  {
    value: "cost_cap_usd",
    label: "Cost cap / CPA médio alvo (USD)",
    hint: "COST_CAP quando compatível (conversões/leads/vendas); para tráfego/alcanço usa-se teto em vez de cost cap.",
  },
];

const specialCategories = [
  { value: "credit", label: "Crédito" },
  { value: "employment", label: "Emprego" },
  { value: "housing", label: "Habitação / Imóveis" },
  { value: "issues_elections_politics", label: "Política / Eleições" },
  { value: "online_gambling_and_gaming", label: "Apostas / Jogos online" },
] as const;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
const MAX_BYTES = 25 * 1024 * 1024;

const DPILOT_META_CAMPAIGN_STEPS = [
  { id: "dpilot-wiz-meta-offer", label: "Destino e público" },
  { id: "dpilot-wiz-meta-obj", label: "Objetivo e orçamento" },
  { id: "dpilot-wiz-meta-bidding", label: "Licitação" },
  { id: "dpilot-wiz-meta-target", label: "Segmentação e posicionamentos" },
  { id: "dpilot-wiz-meta-creative", label: "Criativo" },
  { id: "dpilot-wiz-meta-compliance", label: "Conformidade" },
  { id: "dpilot-wiz-meta-submit", label: "Gerar plano" },
] as const;

const schema = z.object({
  landingUrl: z.string().url("Informe uma URL válida").max(500),
  offer: z.string().trim().min(3).max(500),
  audienceNotes: z.string().trim().min(3).max(800),
  objective: z.enum(["traffic", "leads", "purchases", "awareness", "engagement", "app_promotion"]),
  dailyBudgetUsd: z.number().min(1).max(100000),
  placements: z.array(z.string()).min(1, "Escolha pelo menos um posicionamento"),
  ageMin: z.number().int().min(13).max(65),
  ageMax: z.number().int().min(13).max(65),
});

export function DpilotMetaWizardPage() {
  const { projectId } = useDpilotPaid();
  const navigate = useNavigate();
  const base = `/tracking/dpilot/p/${projectId}`;
  const fileRef = useRef<HTMLInputElement>(null);

  const [landingUrl, setLandingUrl] = useState("https://example.com");
  const [offer, setOffer] = useState("");
  const [audienceNotes, setAudienceNotes] = useState(
    "Profissionais 25-45, interessados em produtividade e SaaS.",
  );
  const [objective, setObjective] = useState<(typeof objectives)[number]["value"]>("leads");
  const [dailyBudget, setDailyBudget] = useState("25");
  const [geoTargets, setGeoTargets] = useState<string[]>(["BR", "PT"]);
  const [ageMin, setAgeMin] = useState("25");
  const [ageMax, setAgeMax] = useState("45");
  const [placements, setPlacements] = useState<string[]>(["facebook_feed", "instagram_feed", "instagram_stories"]);
  const [categories, setCategories] = useState<string[]>([]);
  const [complianceAck, setComplianceAck] = useState(false);
  const [metaBiddingStrategy, setMetaBiddingStrategy] = useState<MetaBiddingStrategy>("lowest_cost");
  const [metaBidAmountUsd, setMetaBidAmountUsd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assetPath, setAssetPath] = useState<string | null>(null);
  const [assetPreview, setAssetPreview] = useState<string | null>(null);
  const [assetIsVideo, setAssetIsVideo] = useState(false);
  const [assetName, setAssetName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const togglePlacement = (v: string) => {
    setPlacements((curr) => (curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v]));
  };

  const toggleCategory = (v: string) => {
    setCategories((curr) => (curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v]));
  };

  async function handleAssetChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Formato não suportado", { description: "Use JPEG, PNG, WebP, MP4 ou MOV." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Ficheiro demasiado grande", { description: "Máximo 25MB." });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      if (assetPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(assetPreview);
      }
      setAssetPreview(dataUrl);
      setAssetIsVideo(file.type.startsWith("video/"));
      setAssetName(file.name);

      const { data, error: upErr } = await paidAdsService.uploadMetaAsset(projectId, file);
      if (upErr || !data?.path) {
        setAssetPath(null);
        setAssetPreview(null);
        setAssetName(null);
        setAssetIsVideo(false);
        toast.error("Falha no envio do criativo", { description: upErr || "Tente de novo num instante." });
        return;
      }
      setAssetPath(data.path);
      toast.success("Criativo carregado", { description: "O ficheiro foi guardado e será usado no plano." });
    } catch {
      setAssetPath(null);
      setAssetPreview(null);
      setAssetName(null);
      setAssetIsVideo(false);
      toast.error("Falha ao processar o ficheiro");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearAsset() {
    if (assetPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(assetPreview);
    }
    setAssetPath(null);
    setAssetPreview(null);
    setAssetIsVideo(false);
    setAssetName(null);
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({
      landingUrl,
      offer,
      audienceNotes,
      objective,
      dailyBudgetUsd: Number(dailyBudget),
      placements,
      ageMin: Number(ageMin),
      ageMax: Number(ageMax),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (parsed.data.ageMax < parsed.data.ageMin) {
      setError("Idade máxima deve ser maior ou igual à idade mínima");
      return;
    }
    if (!complianceAck) {
      setError("Confirme a declaração de conformidade com as políticas do Meta antes de continuar.");
      return;
    }
    if (categories.length > 0 && parsed.data.ageMin < 18) {
      setError("Categorias especiais exigem idade mínima de 18 anos. Ajuste a faixa etária.");
      return;
    }

    const geoArr = geoTargets.map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
    if (!geoArr.length) {
      setError("Selecione pelo menos uma localização (país).");
      return;
    }

    if (metaBiddingStrategy === "bid_cap_usd" || metaBiddingStrategy === "cost_cap_usd") {
      const cap = parseFloat(metaBidAmountUsd.replace(",", "."));
      if (!Number.isFinite(cap) || cap <= 0) {
        setError("Indique um valor USD positivo para o limite ou cost cap.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data, error: apiErr } = await paidAdsService.postMetaCampaignPlan(projectId, {
        landingUrl: parsed.data.landingUrl,
        offer: parsed.data.offer,
        audienceNotes: parsed.data.audienceNotes,
        objective: parsed.data.objective,
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        geoTargets: geoArr,
        placements: parsed.data.placements as string[],
        ageMin: parsed.data.ageMin,
        ageMax: parsed.data.ageMax,
        specialAdCategories: categories.length === 0 ? ["none"] : categories,
        complianceAcknowledged: complianceAck,
        assetPath: assetPath,
        meta_bidding_strategy: metaBiddingStrategy,
        ...(metaBiddingStrategy !== "lowest_cost"
          ? {
              meta_bid_amount_usd: parseFloat(metaBidAmountUsd.replace(",", ".")),
            }
          : {}),
      });
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
        toast.success("Campanha Meta — autopilot", {
          description: `Publicação automática tentada na conta ligada (dentro dos limites).${planGenNote}`,
        });
      } else if (data.reasons && data.reasons.length > 0) {
        toast.warning("Campanha Meta — revisão necessária", {
          description: `${data.reasons[0]?.message ?? "Consulte os motivos nos pedidos em «Aprovações»."}${planGenNote}`,
        });
      } else {
        toast.success("Campanha Meta criada", {
          description: `Rascunho e pedido criados. Consulte «Aprovações» para rever e usar «Aplicar na rede» quando adequado.${planGenNote}`,
        });
      }
      navigate(`${base}/aprovacoes`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      toast.error("Falha ao gerar plano", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const hasSensitive = categories.length > 0;
  const canSubmit = complianceAck && !submitting && !uploading;

  return (
    <Gate>
      <DpilotAdsCampaignWizardShell
        platform="meta"
        platformBadge="Meta Ads · Fluxo Advantage+ simplificado"
        steps={[...DPILOT_META_CAMPAIGN_STEPS]}
        subtitle={
          <>
            Estrutura alinhada ao <strong className="font-medium text-foreground">Gestor de anúncios</strong>: destino,
            objetivo ao nível da campanha, conjunto com licitações reais Graph API, público manual e uploads de criativo
            — gerado por IA sempre com espaço para revisão e aprovação.
          </>
        }
        hint={
          <>
            Objetivos mapeados para{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">OUTCOME_*</code> compatíveis; categorias especiais e
            idade são validadas antes do pedido.
          </>
        }
        backHref={`${base}/meta`}
        backLabel="Voltar ao Meta"
        readiness={<DpilotCampaignReadinessCard platform="meta" />}
      >
        <DpilotAdsWizardFormPreviewSplit
          autoSaveId={projectId ? `dpilot-meta-wizard-split-${projectId}` : "dpilot-meta-wizard-split"}
          preview={
            <aside className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none lg:sticky lg:top-2">
              <DpilotMetaFeedAdPreview
                landingUrl={landingUrl}
                offer={offer}
                placements={placements}
                assetPreview={assetPreview}
                assetIsVideo={assetIsVideo}
              />
            </aside>
          }
          form={
            <form onSubmit={onSubmit} className="min-w-0 space-y-6">
          <DpilotWizardFormSection
            id="dpilot-wiz-meta-offer"
            platform="meta"
            stepLabel="Passo 1 de 7"
            title="Destino e mensagem"
            description="URL da oferta, proposta de valor e notas de público para o conjunto e criativos gerados."
          >
            <div className="grid gap-2">
              <Label htmlFor="m-url">URL de destino</Label>
              <Input
                id="m-url"
                type="url"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="m-offer">Oferta / proposta de valor</Label>
              <Textarea
                id="m-offer"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Ex.: Plataforma de gestão financeira para PMEs, com integração bancária."
                rows={4}
                maxLength={500}
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs font-normal"
                  onClick={() => setOffer(DPILOT_OFFER_TEMPLATE.trim())}
                >
                  Inserir modelo editável (4 linhas)
                </Button>
                <span className="tabular-nums text-[11px] text-muted-foreground">{offer.length}/500</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="m-audience">Notas sobre o público-alvo</Label>
              <Textarea
                id="m-audience"
                value={audienceNotes}
                onChange={(e) => setAudienceNotes(e.target.value)}
                placeholder="Perfil, interesses, comportamentos ou problemas que o anúncio deve endereçar."
                rows={3}
                required
              />
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-meta-obj"
            platform="meta"
            stepLabel="Passo 2 de 7"
            title="Objetivo e investimento diário"
            description={
              <>
                Equivalente aos resultados{" "}
                <code className="rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">
                  OUTCOME_*
                </code>{" "}
                na API; orçamento alinhado ao modelo de campanha gerado pelo servidor.
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="m-obj">Objetivo</Label>
                <select
                  id="m-obj"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value as (typeof objectives)[number]["value"])}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {objectives.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m-budget">Orçamento diário (USD)</Label>
                <Input
                  id="m-budget"
                  type="number"
                  min={1}
                  step={1}
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  required
                />
              </div>
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-meta-bidding"
            platform="meta"
            stepLabel="Passo 3 de 7"
            title="Licitação do conjunto"
            description="LOWEST_COST, bid cap ou cost cap conforme objectivo — valores em USD comunicados ao plano técnico."
          >
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/25 p-4 dark:bg-muted/15">
              <Label htmlFor="m-bidding-strat" className="text-xs font-medium">
                Licitação do conjunto
              </Label>
              <select
                id="m-bidding-strat"
                value={metaBiddingStrategy}
                onChange={(e) => setMetaBiddingStrategy(e.target.value as MetaBiddingStrategy)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {META_BIDDING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {metaBiddingStrategy !== "lowest_cost" ? (
                <div className="grid gap-2">
                  <Label htmlFor="m-bid-usd">
                    {metaBiddingStrategy === "cost_cap_usd" ? "CPA médio alvo / cost cap (USD)" : "Limite máximo (USD)"}
                  </Label>
                  <Input
                    id="m-bid-usd"
                    inputMode="decimal"
                    placeholder="Ex.: 15"
                    value={metaBidAmountUsd}
                    onChange={(e) => setMetaBidAmountUsd(e.target.value)}
                    required
                  />
                </div>
              ) : null}
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-meta-target"
            platform="meta"
            stepLabel="Passo 4 de 7"
            title="Geografia, idade e posicionamentos"
            description="Localização obrigatória; refine demografia e placements cobertos pela campanha."
          >
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="m-age-min">Idade mínima</Label>
                <Input
                  id="m-age-min"
                  type="number"
                  min={13}
                  max={65}
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m-age-max">Idade máxima</Label>
                <Input
                  id="m-age-max"
                  type="number"
                  min={13}
                  max={65}
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Posicionamentos</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {placementOptions.map((p) => {
                  const checked = placements.includes(p.value);
                  return (
                    <label
                      key={p.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => togglePlacement(p.value)} />
                      {p.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-meta-creative"
            platform="meta"
            stepLabel="Passo 5 de 7"
            title="Criativo inicial"
            description="Opcional neste fluxo — imagem ou vídeo é enviado ao servidor antes do pedido IA / API."
          >
            <div className="grid gap-2">
              <Label>Anúncio — imagem ou vídeo (opcional)</Label>
              {assetPath ? (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {assetPreview && !assetIsVideo ? (
                      <img
                        src={assetPreview}
                        alt={assetName ?? "asset"}
                        className="h-full w-full object-cover"
                      />
                    ) : assetPreview && assetIsVideo ? (
                      <video src={assetPreview} className="h-full w-full object-cover" muted />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{assetName}</p>
                    <p className="text-xs text-muted-foreground">Carregado no servidor para usar no pedido de campanha.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAsset} disabled={uploading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span>{uploading ? "A enviar…" : "Clique para escolher imagem ou vídeo"}</span>
                  <span className="text-[11px]">JPEG, PNG, WebP, MP4 ou MOV · até 25MB</span>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept={ALLOWED_MIME.join(",")}
                    onChange={handleAssetChange}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-meta-compliance"
            platform="meta"
            stepLabel="Passo 6 de 7"
            title="Compliance e políticas Meta"
            description="Declare categorias especiais quando aplicável; confirme leitura das políticas de anúncios."
          >
            <div className="grid gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 dark:bg-amber-500/10">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-amber-500/50">
                  Compliance
                </Badge>
                <p className="text-sm font-medium">Categorias especiais de anúncios</p>
              </div>
              <p className="text-xs text-muted-foreground">Quando aplicável, declare.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {specialCategories.map((c) => {
                  const checked = categories.includes(c.value);
                  return (
                    <label
                      key={c.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted/30"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleCategory(c.value)} />
                      {c.label}
                    </label>
                  );
                })}
              </div>
              {hasSensitive ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                  Idade mínima pode ser forçada a 18 anos.
                </p>
              ) : null}

              <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={complianceAck}
                  onCheckedChange={(v) => setComplianceAck(Boolean(v))}
                  className="mt-0.5"
                />
                <span className="leading-relaxed">
                  Confirmo que esta campanha respeita as{" "}
                  <a
                    href="https://www.facebook.com/policies/ads/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    políticas de anúncios do Meta
                  </a>{" "}
                  e que declarei corretamente as categorias especiais aplicáveis.
                </span>
              </label>
            </div>
          </DpilotWizardFormSection>

          <DpilotWizardFormSection
            id="dpilot-wiz-meta-submit"
            platform="meta"
            stepLabel="Passo 7 de 7"
            title="Gerar plano técnico"
            description="Criação do rascunho e entrada na fila; publicação apenas após revisão quando o modo da conta assim o exigir."
          >
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-border/80 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" className="sm:mr-auto" asChild>
                <Link to={`${base}/meta`}>Cancelar</Link>
              </Button>
              <Button type="submit" size="lg" className="min-w-[220px] font-semibold" disabled={!canSubmit}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
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
