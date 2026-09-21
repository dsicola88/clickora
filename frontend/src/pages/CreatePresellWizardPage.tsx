import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
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
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { cn } from "@/lib/utils";
import { campaignsService, buildTrackedPresellUrl } from "@/services/campaignsService";
import { presellService } from "@/services/presellService";
import { customDomainService } from "@/services/customDomainService";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";

const MODELS = [
  { id: "review", label: "Review", type: "review" },
  { id: "advertorial", label: "Advertorial", type: "dtc" },
  { id: "comparison", label: "Comparison", type: "review" },
  { id: "listicle", label: "Listicle", type: "cookies" },
  { id: "vsl", label: "VSL", type: "vsl" },
] as const;

function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("digistore")) return "Digistore24";
  if (u.includes("hotmart")) return "Hotmart";
  if (u.includes("clickbank")) return "ClickBank";
  if (u.includes("buygoods") || u.includes("buy-goods")) return "BuyGoods";
  if (u.includes("smartadv")) return "SmartAdv";
  if (u.includes("maxweb")) return "MaxWeb";
  return null;
}

function slugFromTitle(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `presell-${Date.now().toString(36)}`
  );
}

/**
 * Fluxo principal: Oferta → Campanha → Presell → Tracking → Publicar.
 * Importa conteúdo da oferta (como o formulário rápido) para o CTA e a página abrirem correctos.
 */
export default function CreatePresellWizardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [offerUrl, setOfferUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [trafficSource, setTrafficSource] = useState("Google Ads");
  const [country, setCountry] = useState("US");
  const [language, setLanguage] = useState("en");
  const [modelId, setModelId] = useState<string>("review");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [presellId, setPresellId] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [advOpen, setAdvOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [genPhase, setGenPhase] = useState<"idle" | "import" | "publish">("idle");

  const platform = useMemo(() => detectPlatform(offerUrl), [offerUrl]);

  const { data: customDomains = [] } = useQuery({
    queryKey: ["custom-domain"],
    queryFn: async () => {
      const { data } = await customDomainService.list();
      return data ?? [];
    },
  });

  const saveCampaign = useMutation({
    mutationFn: async () => {
      const { data, error } = await campaignsService.create({
        name: campaignName.trim(),
        traffic_source: trafficSource,
        country,
        language,
        offer_url: offerUrl.trim(),
        platform,
        status: "draft",
      });
      if (error || !data) throw new Error(error || "Falha ao criar campanha");
      return data;
    },
    onSuccess: (c) => {
      setCampaignId(c.id);
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
      setStep(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPresell = useMutation({
    mutationFn: async () => {
      const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];
      const type = model.type;
      const titleSeed = campaignName.trim() || "Nova presell";
      const slug = `${slugFromTitle(titleSeed)}-${Date.now().toString(36).slice(-4)}`;
      const offer = offerUrl.trim();

      setGenPhase("import");
      const imported = await presellService.importFromUrl({
        product_url: offer,
        language,
        affiliate_link: offer,
      });

      let content: Record<string, unknown>;
      let video_url: string | null = null;
      let pageTitle = titleSeed;

      if (!imported.error && imported.data) {
        const data = imported.data;
        pageTitle = (data.title || data.product_name || titleSeed).slice(0, 200);
        content = {
          title: data.title,
          subtitle: data.subtitle,
          salesText: data.sales_text,
          ctaText: data.cta_text,
          affiliateLink: data.affiliate_link || offer,
          productName: data.product_name,
          productImages: data.images,
          sourceUrl: data.source_url || offer,
          storefrontTheme: data.storefront_theme,
          storefrontHeroTint: data.storefront_hero_tint,
          ...(typeof data.import_mirror_src_doc === "string" && data.import_mirror_src_doc.length > 0
            ? { importMirrorSrcDoc: data.import_mirror_src_doc }
            : {}),
          ratingValue: data.rating_value,
          ratingStars: data.rating_stars ?? 5,
        };
        if (type === "vsl" && data.video_url) {
          video_url = resolveVideoEmbedSrc(data.video_url) || null;
        }
      } else {
        /** Import falhou (timeout, bloqueio, etc.) — ainda assim o CTA deve ir à oferta. */
        toast.message("Não foi possível espelhar a página da oferta; o link do anúncio fica funcional.");
        content = {
          title: titleSeed,
          subtitle: "",
          salesText: "Clique no botão abaixo para ver a oferta.",
          ctaText: "Ver oferta",
          affiliateLink: offer,
          productName: titleSeed,
          productImages: [],
          sourceUrl: offer,
        };
      }

      setGenPhase("publish");
      const { data, error } = await presellService.create({
        title: pageTitle,
        slug,
        type,
        language,
        status: "published",
        video_url,
        tracking: {
          offerUrl: offer,
          affiliateNetwork: platform ?? undefined,
        },
        content,
        settings: {},
      } as never);
      if (error || !data) throw new Error(error || "Falha ao criar presell");
      return data;
    },
    onSuccess: async (page) => {
      setGenPhase("idle");
      setPresellId(page.id);
      const url = getPublicPresellFullUrl(customDomains, page.custom_domain_id ?? null, page);
      setPublicUrl(url);
      if (campaignId) {
        await campaignsService.update(campaignId, {
          presell_id: page.id,
          status: "active",
        });
      }
      void qc.invalidateQueries({ queryKey: ["presells"] });
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
      setStep(4);
      toast.success("Presell criada e publicada");
    },
    onError: (e: Error) => {
      setGenPhase("idle");
      toast.error(e.message);
    },
  });

  /** URL limpa para pré-visualizar (sem macros {gclid} do anúncio). */
  const previewUrl = publicUrl;
  const tracked =
    publicUrl && campaignName
      ? buildTrackedPresellUrl(publicUrl, campaignName, trafficSource)
      : publicUrl;

  const copy = async () => {
    if (!tracked) return;
    await navigator.clipboard.writeText(tracked);
    setCopied(true);
    toast.success("URL do anúncio copiada");
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { n: 1 as const, label: "Oferta" },
    { n: 2 as const, label: "Campanha" },
    { n: 3 as const, label: "Presell" },
    { n: 4 as const, label: "Tracking" },
    { n: 5 as const, label: "Publicar" },
  ];

  const genLabel =
    genPhase === "import"
      ? "A ler a oferta…"
      : genPhase === "publish"
        ? "A publicar…"
        : createPresell.isPending
          ? "A gerar…"
          : "Gerar e publicar";

  return (
    <div className={cn(APP_PAGE_SHELL, "max-w-2xl")}>
      <PageHeader
        title="Criar presell"
        description="Cinco passos. O tracking fica configurado automaticamente."
        actions={
          <Button variant="outline" onClick={() => navigate("/presells")}>
            Cancelar
          </Button>
        }
      />

      <ol className="flex flex-wrap gap-2 mb-6">
        {steps.map((s) => (
          <li
            key={s.n}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
              step === s.n
                ? "bg-primary text-primary-foreground"
                : step > s.n
                  ? "bg-primary/15 text-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <span className="tabular-nums">{s.n}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="offer">Cole o link da oferta</Label>
            <Input
              id="offer"
              placeholder="https://…"
              value={offerUrl}
              onChange={(e) => setOfferUrl(e.target.value)}
              autoFocus
            />
            {platform ? (
              <p className="text-xs text-muted-foreground">Rede detectada: {platform}</p>
            ) : null}
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={!/^https?:\/\//i.test(offerUrl.trim())}
            onClick={() => {
              if (!campaignName) {
                try {
                  const host = new URL(offerUrl).hostname.replace(/^www\./, "");
                  setCampaignName(`${host} — ${trafficSource}`);
                } catch {
                  setCampaignName("Minha campanha");
                }
              }
              setStep(2);
            }}
          >
            Continuar <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <div className="space-y-2">
            <Label>Nome da campanha</Label>
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fonte de tráfego</Label>
            <Select value={trafficSource} onValueChange={setTrafficSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Google Ads", "Meta Ads", "TikTok Ads", "Native", "Email", "Outra"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} />
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Input value={language} onChange={(e) => setLanguage(e.target.value.slice(0, 8))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button
              disabled={!campaignName.trim() || saveCampaign.isPending}
              onClick={() => saveCampaign.mutate()}
            >
              {saveCampaign.isPending ? "A guardar…" : "Continuar"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Escolha um modelo. A oferta é lida automaticamente para a página e o botão de compra.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModelId(m.id)}
                className={cn(
                  "rounded-lg border px-3 py-4 text-sm font-medium text-left transition-colors",
                  modelId === m.id
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-primary/40",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {createPresell.isPending ? (
            <p className="text-xs text-muted-foreground">
              {genPhase === "import"
                ? "A extrair título, imagens e link da oferta (pode demorar alguns segundos)…"
                : "A publicar a presell…"}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(2)} disabled={createPresell.isPending}>
              Voltar
            </Button>
            <Button disabled={createPresell.isPending} onClick={() => createPresell.mutate()}>
              {genLabel}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <p className="font-semibold">Tracking</p>
          <ul className="space-y-2 text-sm">
            {[
              ["Estado", "Activo"],
              ["Parâmetros do anúncio", "Prontos (UTMs + click ID)"],
              ["Click ID na oferta", "Automático (subid / sub3 / cid)"],
              ["Vendas da rede", "Configure o postback em Integrações"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 border-b border-border/40 py-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-right">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {v}
                </span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-3 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">Para vendas aparecerem no painel</p>
            <p>
              Em <strong className="text-foreground/90">Integrações → Vendas da rede</strong>, escolha BuyGoods ou SmartAdv,
              copie o URL com macros e cole no postback da plataforma. Sem este passo, os cliques registam-se mas as vendas da rede não entram.
            </p>
          </div>
          <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="px-0">
                Configurações avançadas
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="text-sm text-muted-foreground space-y-2 pt-2">
              <p>Postback, domínio e diagnóstico ficam em Integrações e Configurações.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/integracoes">Abrir Integrações</Link>
              </Button>
            </CollapsibleContent>
          </Collapsible>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/integracoes">Configurar postback agora</Link>
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => setStep(5)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <p className="font-semibold text-lg">A sua presell está pronta</p>
          <ul className="text-sm space-y-1.5">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Presell publicada
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Tracking activo
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Conversões preparadas
            </li>
          </ul>
          {tracked ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">URL para o anúncio (com UTMs / click ID):</p>
              <div className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs break-all">{tracked}</div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={() => void copy()} disabled={!tracked}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar URL do anúncio
            </Button>
            {previewUrl ? (
              <Button variant="outline" asChild>
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  Abrir página
                </a>
              </Button>
            ) : null}
            {campaignId ? (
              <Button variant="secondary" asChild>
                <Link to={`/campanhas/${campaignId}`}>Ver campanha</Link>
              </Button>
            ) : (
              <Button variant="secondary" asChild>
                <Link to="/presells">Ver Presells</Link>
              </Button>
            )}
          </div>
          {presellId ? (
            <Button variant="link" className="px-0" asChild>
              <Link to="/presells">Editar conteúdo da página</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
