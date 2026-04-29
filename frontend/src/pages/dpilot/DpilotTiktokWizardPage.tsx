import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ImageIcon, Loader2, Music2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleAdsCountriesSelect } from "@/components/dpilot/GoogleAdsTargetingSelect";
import { GOOGLE_ADS_COUNTRY_OPTIONS } from "@/lib/googleAdsTargeting";
import { paidAdsService } from "@/services/paidAdsService";
import { DpilotCampaignReadinessCard } from "./DpilotCampaignReadinessCard";
import { DpilotAuctionEducationBanner } from "./DpilotAuctionEducationBanner";
import { Gate } from "./DpilotPaidPages";
import { useDpilotPaid } from "./DpilotPaidContext";
import { DPILOT_OFFER_TEMPLATE } from "./dpilotOfferTemplate";

const objectives = [
  {
    value: "traffic",
    label: "Tráfego",
    hint: "TRAFFIC — mais visitas ao destino.",
  },
  {
    value: "reach",
    label: "Alcance",
    hint: "RF_REACH — exposição e alcance previsto.",
  },
  {
    value: "video_views",
    label: "Visualizações de vídeo",
    hint: "VIDEO_VIEWS — consumo de vídeo no ecossistema TikTok.",
  },
  {
    value: "leads",
    label: "Leads",
    hint: "LEAD_GENERATION — formulários ou mensagens (pixel configurado).",
  },
  {
    value: "conversions",
    label: "Conversões",
    hint: "CONVERSIONS — acções no site ou app com medição.",
  },
  {
    value: "app_installs",
    label: "Instalações de app",
    hint: "APP_INSTALL — instalações ou eventos in‑app.",
  },
] as const;

type TiktokBiddingStrategy = "lowest_cost" | "bid_cap_usd";

const TIKTOK_BIDDING_OPTIONS: { value: TiktokBiddingStrategy; label: string; hint: string }[] = [
  {
    value: "lowest_cost",
    label: "Menor custo (automático)",
    hint: "Sem bid_price manual — o TikTok optimiza dentro do orçamento.",
  },
  {
    value: "bid_cap_usd",
    label: "Teto de licitação / bid_price (USD)",
    hint: "BID_TYPE_CUSTOM + bid_price (API v1.3); mínimos e formato dependem da conta.",
  },
];

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
const MAX_BYTES = 25 * 1024 * 1024;

const schema = z.object({
  landingUrl: z.string().url("Informe uma URL válida").max(500),
  offer: z.string().trim().min(3).max(500),
  audienceNotes: z.string().trim().min(3).max(800),
  objective: z.enum(["traffic", "reach", "video_views", "leads", "conversions", "app_installs"]),
  dailyBudgetUsd: z.number().min(1).max(100000),
  ageMin: z.number().int().min(13).max(65),
  ageMax: z.number().int().min(13).max(65),
});

export function DpilotTiktokWizardPage() {
  const { projectId } = useDpilotPaid();
  const navigate = useNavigate();
  const base = `/tracking/dpilot/p/${projectId}`;
  const fileRef = useRef<HTMLInputElement>(null);

  const [landingUrl, setLandingUrl] = useState("https://example.com");
  const [offer, setOffer] = useState("");
  const [audienceNotes, setAudienceNotes] = useState("Utilizadores 18-35, interessados em entretenimento e estilo de vida.");
  const [objective, setObjective] = useState<(typeof objectives)[number]["value"]>("traffic");
  const [dailyBudget, setDailyBudget] = useState("25");
  const [geoTargets, setGeoTargets] = useState<string[]>(["BR", "PT"]);
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("45");
  const [complianceAck, setComplianceAck] = useState(false);
  const [tiktokBiddingStrategy, setTiktokBiddingStrategy] = useState<TiktokBiddingStrategy>("lowest_cost");
  const [tiktokBidAmountUsd, setTiktokBidAmountUsd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoIsVideo, setVideoIsVideo] = useState(false);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      if (videoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreview);
      }
      setVideoPreview(dataUrl);
      setVideoIsVideo(file.type.startsWith("video/"));
      setVideoName(file.name);

      const { data, error: upErr } = await paidAdsService.uploadTiktokAsset(projectId, file);
      if (upErr || !data?.path) {
        setVideoPath(null);
        setVideoPreview(null);
        setVideoName(null);
        setVideoIsVideo(false);
        toast.error("Falha no envio", { description: upErr || "Tente de novo num instante." });
        return;
      }
      setVideoPath(data.path);
      toast.success("Ficheiro carregado", { description: "Referência guardada no servidor para o plano." });
    } catch {
      setVideoPath(null);
      setVideoPreview(null);
      setVideoName(null);
      setVideoIsVideo(false);
      toast.error("Falha ao processar o ficheiro");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearVideo() {
    if (videoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoPath(null);
    setVideoPreview(null);
    setVideoIsVideo(false);
    setVideoName(null);
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
      setError("Confirme a declaração de conformidade com as políticas do TikTok Ads.");
      return;
    }

    const geoArr = geoTargets.map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
    if (!geoArr.length) {
      setError("Selecione pelo menos uma localização (país).");
      return;
    }

    if (tiktokBiddingStrategy === "bid_cap_usd") {
      const cap = parseFloat(tiktokBidAmountUsd.replace(",", "."));
      if (!Number.isFinite(cap) || cap <= 0) {
        setError("Indique um valor USD positivo para o teto de licitação.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data, error: apiErr } = await paidAdsService.postTiktokCampaignPlan(projectId, {
        landingUrl: parsed.data.landingUrl,
        offer: parsed.data.offer,
        audienceNotes: parsed.data.audienceNotes,
        objective: parsed.data.objective,
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        geoTargets: geoArr,
        ageMin: parsed.data.ageMin,
        ageMax: parsed.data.ageMax,
        complianceAcknowledged: complianceAck,
        videoAssetPath: videoPath,
        tiktok_bidding_strategy: tiktokBiddingStrategy,
        ...(tiktokBiddingStrategy === "bid_cap_usd"
          ? { tiktok_bid_amount_usd: parseFloat(tiktokBidAmountUsd.replace(",", ".")) }
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
        toast.success("Campanha TikTok — autopilot", {
          description: `Publicação automática tentada na conta ligada (dentro dos limites).${planGenNote}`,
        });
      } else if (data.reasons && data.reasons.length > 0) {
        toast.warning("Campanha TikTok — revisão necessária", {
          description: `${data.reasons[0]?.message ?? "Consulte os motivos nos pedidos em «Aprovações»."}${planGenNote}`,
        });
      } else {
        toast.success("Campanha TikTok criada", {
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

  const canSubmit = complianceAck && !submitting && !uploading;

  return (
    <Gate>
      <div className="pb-12">
        <PageHeader
          title="Nova campanha TikTok"
          description="Indique destino, oferta e público; opcionalmente envie vídeo ou imagem. O assistente prepara rascunhos na conta TikTok Ads ligada — em Copilot ou quando os limites o exigirem, o pedido segue para «Aprovações». Pode refinar criativos depois no TikTok Ads Manager."
          actions={
            <Button variant="outline" asChild>
              <Link to={`${base}/tiktok`}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Link>
            </Button>
          }
        />
        <div className="mt-2 px-0 py-2 sm:px-1">
          <div className="mx-auto max-w-3xl space-y-5">
            <DpilotCampaignReadinessCard platform="tiktok" />
            <DpilotAuctionEducationBanner platform="tiktok" />
            <form
              onSubmit={onSubmit}
              className="grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
            <div className="grid gap-2">
              <Label htmlFor="t-url">URL de destino</Label>
              <Input
                id="t-url"
                type="url"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">Para onde o anúncio deve levar após o clique.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="t-offer">Oferta / proposta de valor</Label>
              <Textarea
                id="t-offer"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Ex.: Curso de edição de vídeo para criadores, com acesso imediato."
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
              <Label htmlFor="t-audience">Notas sobre o público-alvo</Label>
              <Textarea
                id="t-audience"
                value={audienceNotes}
                onChange={(e) => setAudienceNotes(e.target.value)}
                placeholder="Perfil do público, interesses, tom do criativo (vertical, estilo UGC…)."
                rows={3}
                required
              />
              <p className="text-[11px] text-muted-foreground">Ajuda o modelo dentro das políticas TikTok Ads.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="t-obj">Objetivo da campanha</Label>
                <select
                  id="t-obj"
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
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {objectives.find((o) => o.value === objective)?.hint}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="t-budget">Orçamento diário (USD)</Label>
                <Input
                  id="t-budget"
                  type="number"
                  min={1}
                  step={1}
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <div className="space-y-1">
                <Label htmlFor="t-bidding-strat" className="text-xs font-medium">
                  Licitação do grupo de anúncios (TikTok)
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Opcional: enviar bid_price com licitação personalizada; de contrário o TikTok optimiza automaticamente.
                </p>
              </div>
              <select
                id="t-bidding-strat"
                value={tiktokBiddingStrategy}
                onChange={(e) => setTiktokBiddingStrategy(e.target.value as TiktokBiddingStrategy)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIKTOK_BIDDING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {TIKTOK_BIDDING_OPTIONS.find((o) => o.value === tiktokBiddingStrategy)?.hint}
              </p>
              {tiktokBiddingStrategy === "bid_cap_usd" ? (
                <div className="grid gap-2">
                  <Label htmlFor="t-bid-usd">Valor bid_price (USD)</Label>
                  <Input
                    id="t-bid-usd"
                    inputMode="decimal"
                    placeholder="Ex.: 1.50"
                    value={tiktokBidAmountUsd}
                    onChange={(e) => setTiktokBidAmountUsd(e.target.value)}
                    required
                  />
                </div>
              ) : null}
            </div>

            <GoogleAdsCountriesSelect
              label="Localizações — País"
              hint="Mesmos países disponíveis que no fluxo Google Ads deste produto."
              searchPlaceholder="Pesquisar país…"
              emptyText="Nenhum país encontrado."
              options={GOOGLE_ADS_COUNTRY_OPTIONS}
              value={geoTargets}
              onChange={setGeoTargets}
              max={20}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="t-age-min">Idade mínima</Label>
                <Input
                  id="t-age-min"
                  type="number"
                  min={13}
                  max={65}
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="t-age-max">Idade máxima</Label>
                <Input
                  id="t-age-max"
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
              <Label>Criativo (vídeo ou imagem, opcional)</Label>
              {videoPath ? (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {videoPreview && !videoIsVideo ? (
                      <img src={videoPreview} alt={videoName ?? "asset"} className="h-full w-full object-cover" />
                    ) : videoPreview && videoIsVideo ? (
                      <video src={videoPreview} className="h-full w-full object-cover" muted />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{videoName}</p>
                    <p className="text-xs text-muted-foreground">Guardado no servidor para usar no pedido de campanha.</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearVideo} disabled={uploading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span>{uploading ? "A enviar…" : "Clique para escolher ficheiro (recomendado: vídeo vertical)"}</span>
                  <span className="text-[11px]">JPEG, PNG, WebP, MP4 ou MOV · até 25MB</span>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept={ALLOWED_MIME.join(",")}
                    onChange={handleVideoChange}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            <div className="grid gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-amber-500/50">
                  <Music2 className="mr-1 h-3 w-3" />
                  TikTok Ads
                </Badge>
                <p className="text-sm font-medium">Conformidade</p>
              </div>
              <p className="text-xs text-muted-foreground">
                O seu anúncio deve cumprir as regras de conteúdo e publicidade do TikTok. Objetivos como conversões podem
                exigir pixel ou aplicação configurados na conta TikTok.
              </p>
              <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={complianceAck}
                  onCheckedChange={(v) => setComplianceAck(Boolean(v))}
                  className="mt-0.5"
                />
                <span className="leading-relaxed">
                  Confirmo que este plano e criativos respeitam as{" "}
                  <a
                    href="https://ads.tiktok.com/help/article?aid=10000357"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    políticas de anúncios do TikTok
                  </a>
                  .
                </span>
              </label>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-4">
              O assistente gera rascunhos e um pedido na conta TikTok Ads ligada. A conta só é alterada quando os limites de
              segurança e o modo Copilot / Autopilot o permitirem — por exemplo após rever o pedido em «Aprovações».
            </p>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" asChild>
                <Link to={`${base}/tiktok`}>Cancelar</Link>
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                {submitting ? "A gerar plano…" : "Gerar plano com IA"}
              </Button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </Gate>
  );
}
