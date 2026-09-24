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
import { resolveVideoEmbedSrc, buildYoutubeEmbedUrlForPresell } from "@/lib/youtubeEmbed";
import { PresellTypeCombobox } from "@/components/presell/PresellTypeCombobox";
import { getPresellTypeOption } from "@/lib/presellTypeOptions";
import { PRESELL_CREATION_LANGUAGES, type PresellLocaleKey } from "@/lib/presellUiStrings";
import { isDiscountPresellType, isVideoPresellType } from "@/lib/presellTypeMeta";

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
 * Fluxo: Oferta → Campanha → Tipo/idioma → Tracking → Publicar.
 * Tipos iguais ao formulário completo (cookies, desconto, VSL, etc.).
 */
export default function CreatePresellWizardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [offerUrl, setOfferUrl] = useState("");
  /** Página de vendas a clonar (visual). Se vazio, usa o hoplink. */
  const [productPageUrl, setProductPageUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [trafficSource, setTrafficSource] = useState("Google Ads");
  const [country, setCountry] = useState("US");
  const [language, setLanguage] = useState<PresellLocaleKey>("pt-BR");
  const [presellType, setPresellType] = useState("cookies");
  const [cookiePolicyUrl, setCookiePolicyUrl] = useState("");
  const [minAge, setMinAge] = useState("18");
  const [manualYoutubeUrl, setManualYoutubeUrl] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [presellId, setPresellId] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [advOpen, setAdvOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [genPhase, setGenPhase] = useState<"idle" | "import" | "publish">("idle");

  const platform = useMemo(() => detectPlatform(offerUrl), [offerUrl]);
  const typeDetail = getPresellTypeOption(presellType);

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
      const type = presellType;
      const titleSeed = campaignName.trim() || "Nova presell";
      const slug = `${slugFromTitle(titleSeed)}-${Date.now().toString(36).slice(-4)}`;
      const offer = offerUrl.trim();
      const productPage = productPageUrl.trim() || offer;

      setGenPhase("import");
      const imported = await presellService.importFromUrl({
        product_url: productPage,
        language,
        affiliate_link: offer,
      });

      let content: Record<string, unknown>;
      let video_url: string | null = null;
      // Nome na lista de Presells = nome da campanha (não o título importado do produto).
      const pageTitle = titleSeed.slice(0, 200);

      if (!imported.error && imported.data) {
        const data = imported.data;
        const isDiscount = isDiscountPresellType(type);
        content = {
          title: data.title,
          subtitle: data.subtitle,
          salesText: data.sales_text,
          ctaText: isDiscount ? data.official_buy_cta : data.cta_text,
          affiliateLink: data.affiliate_link || offer,
          productName: data.product_name,
          productImages: data.images,
          sourceUrl: data.source_url || productPage,
          storefrontTheme: data.storefront_theme,
          storefrontHeroTint: data.storefront_hero_tint,
          /** Espelho = página clonada fiel; sem hero React extra por cima. */
          mirrorShowSpotlight: false,
          ...(typeof data.import_mirror_src_doc === "string" && data.import_mirror_src_doc.length > 0
            ? { importMirrorSrcDoc: data.import_mirror_src_doc }
            : {}),
          ratingValue: data.rating_value,
          ratingStars: data.rating_stars ?? 5,
          ...(isDiscount
            ? {
                discountHeadline: data.discount_headline,
                socialProofLine: data.social_proof,
                urgencyTimerSeconds: data.urgency_timer_seconds ?? 649,
              }
            : {}),
        };
        if (isVideoPresellType(type)) {
          if (data.video_url) {
            video_url = resolveVideoEmbedSrc(data.video_url) || null;
          } else if (manualYoutubeUrl.trim()) {
            const embed = buildYoutubeEmbedUrlForPresell(manualYoutubeUrl.trim());
            if (!embed) throw new Error("URL do YouTube inválido.");
            video_url = embed;
          }
        }
      } else {
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
        if (isVideoPresellType(type) && manualYoutubeUrl.trim()) {
          const embed = buildYoutubeEmbedUrlForPresell(manualYoutubeUrl.trim());
          if (embed) video_url = embed;
        }
      }

      const settings: Record<string, unknown> = {
        cookiePolicyUrl: cookiePolicyUrl.trim() || undefined,
        minAge: minAge.trim() || "18",
      };

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
        settings,
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
    { n: 3 as const, label: "Tipo e idioma" },
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
        description="Escolha tipo (cookies, desconto, VSL…), idioma e publique. O tracking fica automático."
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
            <Label htmlFor="offer">Hoplink da rede (destino da venda)</Label>
            <Input
              id="offer"
              placeholder="https://… (BuyGoods / Digistore / SmartAdv…)"
              value={offerUrl}
              onChange={(e) => setOfferUrl(e.target.value)}
              autoFocus
            />
            {platform ? (
              <p className="text-xs text-muted-foreground">Rede detectada: {platform}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-page">Página do produto a clonar (visual)</Label>
            <Input
              id="product-page"
              placeholder="https://… sales page (opcional — se vazio usa o hoplink)"
              value={productPageUrl}
              onChange={(e) => setProductPageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A dclickora espelha esta página (Playwright). O hoplink acima continua a ser o destino
              rastreado dos CTAs. Use a sales page pública — não a página de checkout.
            </p>
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
            <Label>Nome da campanha (e da página na lista)</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex.: Google US — Nitric Boost"
            />
            <p className="text-xs text-muted-foreground">
              Este nome aparece em Presells como «Nome da página» e na campanha.
            </p>
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
          <div className="space-y-2 max-w-[8rem]">
            <Label>País (anúncio)</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} />
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
        <div className="space-y-5 rounded-xl border border-border/60 bg-card p-5">
          <div className="space-y-2">
            <Label>Idioma da página</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as PresellLocaleKey)}>
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESELL_CREATION_LANGUAGES.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Textos da UI pública (cookies, botões, etc.).</p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de presell</Label>
            <PresellTypeCombobox value={presellType} onValueChange={setPresellType} />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pesquisa por «cookie», «desconto», «VSL», «idade»… Cada tipo muda o que o visitante vê.
            </p>
            {typeDetail ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground/90">{typeDetail.name}</p>
                <p className="mt-1">{typeDetail.description}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Opções do tipo</p>
            {presellType === "cookies" ? (
              <div className="space-y-2">
                <Label htmlFor="cookiePolicy">URL política de cookies (opcional)</Label>
                <Input
                  id="cookiePolicy"
                  type="url"
                  placeholder="https://…"
                  value={cookiePolicyUrl}
                  onChange={(e) => setCookiePolicyUrl(e.target.value)}
                />
              </div>
            ) : null}
            {["idade", "idade_sexo", "idade_pais"].includes(presellType) ? (
              <div className="space-y-2 max-w-[8rem]">
                <Label htmlFor="minAge">Idade mínima</Label>
                <Input
                  id="minAge"
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
            ) : null}
            {isVideoPresellType(presellType) ? (
              <div className="space-y-2">
                <Label htmlFor="yt">YouTube (se o import não trouxer vídeo)</Label>
                <Input
                  id="yt"
                  placeholder="https://youtube.com/watch?v=…"
                  value={manualYoutubeUrl}
                  onChange={(e) => setManualYoutubeUrl(e.target.value)}
                />
              </div>
            ) : null}
            {isDiscountPresellType(presellType) ? (
              <p className="text-xs text-muted-foreground">
                Desconto e urgência vêm do import da página do produto (percentagem, contagem, prova social).
              </p>
            ) : null}
            {presellType === "fantasma" ? (
              <p className="text-xs text-muted-foreground">
                Redirect no primeiro gesto. Confirme se a rede e a compliance o permitem.
              </p>
            ) : null}
            {!["cookies", "idade", "idade_sexo", "idade_pais", "fantasma"].includes(presellType) &&
            !isVideoPresellType(presellType) &&
            !isDiscountPresellType(presellType) ? (
              <p className="text-xs text-muted-foreground">Sem opções extra para este tipo — o import preenche o conteúdo.</p>
            ) : null}
          </div>

          {createPresell.isPending ? (
            <p className="text-xs text-muted-foreground">
              {genPhase === "import"
                ? "A extrair título, imagens e link da oferta…"
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
          <p className="text-xs text-muted-foreground">
            Prefere o formulário completo? Em Presells use{" "}
            <strong className="text-foreground/90">Formulário rápido</strong>.
          </p>
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
              copie o URL com macros e cole no postback da plataforma.
            </p>
          </div>
          <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="px-0">
                Configurações avançadas
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="text-sm text-muted-foreground space-y-2 pt-2">
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
              <Check className="h-4 w-4 text-emerald-600" /> Tipo: {typeDetail?.name ?? presellType}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Idioma: {language}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> Tracking activo
              {presellId ? ` · ${presellId.slice(0, 8)}…` : ""}
            </li>
          </ul>
          {tracked ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">URL para o anúncio:</p>
              <div className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs break-all">{tracked}</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Inclui o <strong className="text-foreground/80">nome da campanha</strong> (
                <span className="font-mono">utm_campaign</span>
                ) e, no Google Ads, <span className="font-mono">utm_term={"{keyword}"}</span> — a Google
                substitui pela palavra-chave no clique. Copie este URL como URL final do anúncio.
              </p>
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
        </div>
      )}
    </div>
  );
}
