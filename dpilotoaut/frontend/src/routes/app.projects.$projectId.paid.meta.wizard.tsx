import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, ImageIcon, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { generateMetaCampaignPlan } from "@/server/meta-plan.functions";
import { deleteMetaCreativeAsset, uploadMetaCreativeAsset } from "@/server/meta-asset.functions";

export const Route = createFileRoute("/app/projects/$projectId/paid/meta/wizard")({
  component: MetaWizard,
});

const objectives = [
  { value: "traffic", label: "Tráfego" },
  { value: "leads", label: "Leads" },
  { value: "purchases", label: "Conversões" },
  { value: "awareness", label: "Reconhecimento" },
  { value: "engagement", label: "Engajamento" },
  { value: "app_promotion", label: "Promoção de app" },
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

const specialCategories = [
  { value: "credit", label: "Crédito" },
  { value: "employment", label: "Emprego" },
  { value: "housing", label: "Habitação / Imóveis" },
  { value: "issues_elections_politics", label: "Política / Eleições" },
  { value: "online_gambling_and_gaming", label: "Apostas / Jogos online" },
] as const;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB
/** Pasta lógica sob UPLOAD_DIR (alinhado a `meta-asset.functions` local). */
const META_ASSET_STORAGE_LABEL = "meta-creative-assets";
const schema = z.object({
  landingUrl: z.string().url("Informe uma URL válida").max(500),
  offer: z.string().trim().min(3).max(500),
  audienceNotes: z.string().trim().min(3).max(800),
  objective: z.enum(["traffic", "leads", "purchases", "awareness", "engagement", "app_promotion"]),
  dailyBudgetUsd: z.number().min(1).max(100000),
  geoTargets: z.string().trim().min(2).max(200),
  placements: z.array(z.string()).min(1, "Escolha pelo menos um posicionamento"),
  ageMin: z.number().int().min(13).max(65),
  ageMax: z.number().int().min(13).max(65),
});

function MetaWizard() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const generate = useServerFn(generateMetaCampaignPlan);
  const uploadAsset = useServerFn(uploadMetaCreativeAsset);
  const removeAsset = useServerFn(deleteMetaCreativeAsset);
  const fileRef = useRef<HTMLInputElement>(null);

  const [landingUrl, setLandingUrl] = useState("https://example.com");
  const [offer, setOffer] = useState("");
  const [audienceNotes, setAudienceNotes] = useState(
    "Profissionais 25-45, interessados em produtividade e SaaS.",
  );
  const [objective, setObjective] = useState<(typeof objectives)[number]["value"]>("leads");
  const [dailyBudget, setDailyBudget] = useState("25");
  const [geos, setGeos] = useState("BR, PT");
  const [ageMin, setAgeMin] = useState("25");
  const [ageMax, setAgeMax] = useState("45");
  const [placements, setPlacements] = useState<string[]>([
    "facebook_feed",
    "instagram_feed",
    "instagram_stories",
  ]);
  const [categories, setCategories] = useState<string[]>([]);
  const [complianceAck, setComplianceAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asset upload state
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
      toast.error("Formato não suportado", {
        description: "Use JPEG, PNG, WebP, MP4 ou MOV.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande", { description: "Máximo 25MB." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("file", file);

      if (assetPath) {
        await removeAsset({ data: { path: assetPath } });
      }

      const { path, previewUrl } = await uploadAsset({ data: fd });

      setAssetPath(path);
      setAssetPreview(previewUrl);
      setAssetIsVideo(file.type.startsWith("video/"));
      setAssetName(file.name);
      toast.success("Asset carregado");
    } catch (err) {
      toast.error("Falha no upload", {
        description: err instanceof Error ? err.message : "erro desconhecido",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearAsset() {
    if (assetPath) {
      try {
        await removeAsset({ data: { path: assetPath } });
      } catch {
        // ignore
      }
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
      geoTargets: geos,
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

    // Compliance gating BEFORE we generate
    if (!complianceAck) {
      setError(
        "Confirme a declaração de conformidade com as políticas do Meta antes de continuar.",
      );
      return;
    }
    if (categories.length > 0 && parsed.data.ageMin < 18) {
      setError("Categorias especiais exigem idade mínima de 18 anos. Ajuste a faixa etária.");
      return;
    }

    const geoArr = parsed.data.geoTargets
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);
    if (!geoArr.length) {
      setError("Adicione pelo menos um país");
      return;
    }

    setSubmitting(true);
    try {
      const result = await generate({
        data: {
          projectId,
          landingUrl: parsed.data.landingUrl,
          offer: parsed.data.offer,
          audienceNotes: parsed.data.audienceNotes,
          objective: parsed.data.objective,
          dailyBudgetUsd: parsed.data.dailyBudgetUsd,
          geoTargets: geoArr,
          placements: parsed.data.placements as Array<(typeof placementOptions)[number]["value"]>,
          ageMin: parsed.data.ageMin,
          ageMax: parsed.data.ageMax,
          specialAdCategories:
            categories.length === 0
              ? ["none"]
              : (categories as Array<(typeof specialCategories)[number]["value"]>),
          complianceAcknowledged: complianceAck,
          assetPath,
        },
      });
      if (!result.ok) {
        setError(result.error);
        toast.error("Falha ao gerar plano", { description: result.error });
        return;
      }
      toast.success("Plano Meta criado", {
        description: "Campanha em rascunho. Revise na fila de aprovações.",
      });
      navigate({
        to: "/app/projects/$projectId/paid/approvals",
        params: { projectId },
      });
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
    <div className="pb-12">
      <PageHeader
        title="Nova campanha Meta"
        description="Oferta e audiência → plano em rascunho (campanha, conjunto, criativos)."
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/projects/$projectId/paid/meta" params={{ projectId }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="px-6 py-6 sm:px-8">
        <form
          onSubmit={onSubmit}
          className="grid max-w-3xl gap-5 rounded-2xl border border-border bg-card p-6 shadow-card"
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
              rows={3}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="m-audience">Notas de audiência</Label>
            <Textarea
              id="m-audience"
              value={audienceNotes}
              onChange={(e) => setAudienceNotes(e.target.value)}
              placeholder="Quem é a pessoa? Interesses, comportamentos, dores."
              rows={3}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="m-obj">Objetivo</Label>
              <select
                id="m-obj"
                value={objective}
                onChange={(e) =>
                  setObjective(e.target.value as (typeof objectives)[number]["value"])
                }
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-1">
              <Label htmlFor="m-geo">Países (códigos ISO, vírgula)</Label>
              <Input
                id="m-geo"
                value={geos}
                onChange={(e) => setGeos(e.target.value)}
                placeholder="BR, PT"
                required
              />
            </div>
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

          {/* === Asset upload === */}
          <div className="grid gap-2">
            <Label>Asset criativo (imagem ou vídeo, opcional)</Label>
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
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{assetName}</p>
                  <p className="text-xs text-muted-foreground">
                    Armazenado em {META_ASSET_STORAGE_LABEL}/{assetPath.split("/").pop()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAsset}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                <span>{uploading ? "Enviando…" : "Clique para enviar imagem ou vídeo"}</span>
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

          {/* === Compliance / special ad categories === */}
          <div className="grid gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
            <div className="flex items-center gap-2">
              <Badge variant="warning">Compliance</Badge>
              <p className="text-sm font-medium">Categorias especiais de anúncios</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Obrigatório declarar categorias especiais ao Meta; isso restringe targeting (ex.:
              idade ≥18).
            </p>
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
            {hasSensitive && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                Atenção: {categories.length}{" "}
                {categories.length === 1 ? "categoria especial" : "categorias especiais"} declarada
                {categories.length === 1 ? "" : "s"}. Idade mínima será forçada a 18 anos pelo Meta.
              </p>
            )}

            <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <Checkbox
                checked={complianceAck}
                onCheckedChange={(v) => setComplianceAck(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                Confirmo conformidade com as{" "}
                <a
                  href="https://www.facebook.com/policies/ads/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  políticas de anúncios do Meta
                </a>{" "}
                e categorias especiais corretas.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link to="/app/projects/$projectId/paid/meta" params={{ projectId }}>
                Cancelar
              </Link>
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-4 w-4" />
              )}
              {submitting ? "Gerando plano…" : "Gerar plano com IA"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
