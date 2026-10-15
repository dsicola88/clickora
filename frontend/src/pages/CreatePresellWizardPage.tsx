import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { trafficRotatorsService } from "@/services/trafficRotatorsService";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";
import { resolveVideoEmbedSrc, buildYoutubeEmbedUrlForPresell } from "@/lib/youtubeEmbed";
import { PresellTypeCombobox } from "@/components/presell/PresellTypeCombobox";
import { getPresellTypeOption } from "@/lib/presellTypeOptions";
import { PRESELL_CREATION_LANGUAGES, type PresellLocaleKey } from "@/lib/presellUiStrings";
import { isDiscountPresellType, isVideoPresellType } from "@/lib/presellTypeMeta";
import { useAuth } from "@/contexts/AuthContext";
import { PresellReviewStage } from "@/components/presell/PresellReviewStage";
import {
  PRESELL_NICHE_OPTIONS,
  applyImportedPolicyToSettings,
  applyImportedSourceIdentity,
  coercePresellTypeForNiche,
  defaultAbPresellTypeB,
  type PresellGenerationNiche,
} from "@/lib/presellGenerationNiche";
import { buildEditablePageDocument } from "@/lib/presellVisualEdit";
import { dpilotAdsHandoffHref } from "@/lib/dpilotPresellHandoff";
import { mergeClickoraTrackingIntoHeader } from "@/lib/presellTrackingMerge";
import { getTrackApiBaseUrl } from "@/lib/apiOrigin";

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
 * Opcional: A/B com 2 landers + rotador 50/50.
 */
export default function CreatePresellWizardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  /** Identidade real do operador — nunca inventar CNPJ/marca. */
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [operatorDocument, setOperatorDocument] = useState("");
  const [offerUrl, setOfferUrl] = useState("");
  /** Página de vendas a clonar (visual). Se vazio, usa o hoplink. */
  const [productPageUrl, setProductPageUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [trafficSource, setTrafficSource] = useState("Google Ads");
  const [country, setCountry] = useState("US");
  const [language, setLanguage] = useState<PresellLocaleKey>("pt-BR");
  const [generationNiche, setGenerationNiche] = useState<PresellGenerationNiche>("black");
  const [presellType, setPresellType] = useState("cookies");
  const [enableAbTest, setEnableAbTest] = useState(false);
  const [abTypeB, setAbTypeB] = useState("desconto");
  const [cookiePolicyUrl, setCookiePolicyUrl] = useState("");
  const [minAge, setMinAge] = useState("18");
  const [manualYoutubeUrl, setManualYoutubeUrl] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  /** Vazio = domínio padrão da conta. As duas variantes A/B usam o mesmo. */
  const [customDomainId, setCustomDomainId] = useState("");
  const [presellId, setPresellId] = useState<string | null>(null);
  const [presellIdB, setPresellIdB] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [reviewVariant, setReviewVariant] = useState<"a" | "b">("a");
  const [rotatorAdUrl, setRotatorAdUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [genPhase, setGenPhase] = useState<"idle" | "import" | "publish" | "ab" | "rotator">("idle");
  const [mirrorFidelityOk, setMirrorFidelityOk] = useState(true);

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
        generation_niche: generationNiche,
      });
      if (imported.error || !imported.data) {
        throw new Error(
          imported.error ||
            "Não foi possível ler a página do produto. Cole o URL público da sales page (não o checkout).",
        );
      }

      const buildContent = (typeForPage: string) => {
        let content: Record<string, unknown>;
        let video_url: string | null = null;
        let mirrorOk = false;
        const pageTitle = titleSeed.slice(0, 200);

        if (imported.data) {
          const data = imported.data;
          const isDiscount = isDiscountPresellType(typeForPage);
          const hasMirror =
            typeof data.import_mirror_src_doc === "string" && data.import_mirror_src_doc.length > 200;
          /** White publica o visual da origem (espelho). Black publica o artigo informativo com fotos reais. */
          mirrorOk = data.publishable === true;
          const importedTitle = String(data.title || data.product_name || "").trim();
          const titleLooksWeak =
            importedTitle.length < 3 ||
            /^(home|welcome|example domain|document|nova presell|new page)$/i.test(importedTitle);
          const resolvedTitle = titleLooksWeak ? pageTitle : importedTitle || pageTitle;
          content = {
            title: resolvedTitle,
            subtitle: data.subtitle,
            salesText: data.sales_text,
            ctaText: isDiscount ? data.official_buy_cta : data.cta_text,
            affiliateLink: data.affiliate_link || offer,
            productName: titleLooksWeak ? pageTitle : data.product_name || resolvedTitle,
            productImages: data.images,
            sourceUrl: data.source_url || productPage,
            generationNiche: data.generation_niche ?? generationNiche,
            policyUrls: data.policy_urls,
            storefrontTheme: data.storefront_theme,
            storefrontHeroTint: data.storefront_hero_tint,
            mirrorShowSpotlight: false,
            ...(hasMirror ? { importMirrorSrcDoc: data.import_mirror_src_doc } : {}),
            ...(typeof data.source_page_title === "string" && data.source_page_title.trim()
              ? { sourcePageTitle: data.source_page_title.trim() }
              : {}),
            ...(typeof data.favicon_url === "string" && data.favicon_url.trim()
              ? { faviconUrl: data.favicon_url.trim() }
              : {}),
            importMode: data.import_mode,
            ...(data.rating_from_source
              ? {
                  ratingValue: data.rating_value,
                  ratingStars: data.rating_stars ?? 5,
                  ratingFromSource: true,
                }
              : {}),
            ...(isDiscount
              ? {
                  discountHeadline: data.discount_headline || data.title,
                  ...(data.social_proof ? { socialProofLine: data.social_proof } : {}),
                  urgencyTimerSeconds: data.urgency_timer_seconds > 0 ? data.urgency_timer_seconds : 0,
                }
              : {}),
          };
          if (isVideoPresellType(typeForPage)) {
            if (data.video_url) {
              video_url = resolveVideoEmbedSrc(data.video_url) || null;
            } else if (manualYoutubeUrl.trim()) {
              const embed = buildYoutubeEmbedUrlForPresell(manualYoutubeUrl.trim());
              if (!embed) throw new Error("URL do YouTube inválido.");
              video_url = embed;
            }
          }
        }

        content.pageDocument = buildEditablePageDocument({
          title: pageTitle,
          type: typeForPage,
          videoUrl: video_url,
          language,
          content,
        });

        return { content, video_url, mirrorOk, pageTitle };
      };

      const operatorName =
        businessName.trim() ||
        (typeof user?.name === "string" ? user.name.trim() : "") ||
        "";
      const operatorEmail =
        contactEmail.trim() ||
        (typeof user?.sale_notify_email === "string" && user.sale_notify_email.trim()) ||
        (typeof user?.email === "string" ? user.email.trim() : "") ||
        "";
      if (generationNiche === "black" && (!operatorName || !operatorEmail)) {
        throw new Error(
          "No nicho black (Google/Bing Ads), indique o seu nome real de afiliado/operador e um e-mail de contacto válidos — sem inventar CNPJ, marca nem e-mail.",
        );
      }
      const policyFromImport = imported.data?.policy_urls;
      const identityFromSource = {
        businessName: imported.data?.source_business_name || imported.data?.product_name,
        contactEmail: imported.data?.source_contact_email,
      };
      // Black: identidade do afiliado intermediário (obrigatória). White: dados da página espelhada.
      const settingsBase =
        generationNiche === "black"
          ? {
              cookiePolicyUrl: cookiePolicyUrl.trim() || policyFromImport?.privacy || "/privacidade",
              privacyPolicyUrl: cookiePolicyUrl.trim() || policyFromImport?.privacy || "/privacidade",
              termsUrl: "/termos",
              businessName: operatorName,
              contactEmail: operatorEmail,
              ...(operatorDocument.trim() ? { operatorDocument: operatorDocument.trim() } : {}),
            }
          : applyImportedSourceIdentity(
              {
                cookiePolicyUrl: cookiePolicyUrl.trim() || policyFromImport?.privacy || "/privacidade",
                privacyPolicyUrl: cookiePolicyUrl.trim() || policyFromImport?.privacy || "/privacidade",
                termsUrl: "/termos",
              },
              identityFromSource,
            );
      const settings: Record<string, unknown> = applyImportedPolicyToSettings(
        {
          ...settingsBase,
          affiliateDisclosure:
            "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão — sem custo extra para si. Não somos o fabricante nem processamos o pagamento.",
          minAge: minAge.trim() || "18",
        },
        policyFromImport,
      );
      const uid = user?.id;
      if (uid) {
        const embed = `<script src="${getTrackApiBaseUrl().replace(/\/$/, "")}/track/v2/clickora.min.js" data-id="${uid}"></script>`;
        settings.headerCode = mergeClickoraTrackingIntoHeader(String(settings.headerCode ?? ""), embed);
      }

      const a = buildContent(type);
      setGenPhase("publish");
      const publishStatus = a.mirrorOk ? "published" : "draft";
      const { data: pageA, error: errA } = await presellService.create({
        title: a.pageTitle,
        slug,
        type,
        language,
        status: publishStatus,
        video_url: a.video_url,
        tracking: {
          offerUrl: offer,
          affiliateNetwork: platform ?? undefined,
        },
        content: a.content,
        settings,
        ...(customDomainId ? { custom_domain_id: customDomainId } : {}),
      } as never);
      if (errA || !pageA) throw new Error(errA || "Falha ao criar presell");
      const complianceBlocked = Boolean((pageA as { compliance_blocked?: boolean }).compliance_blocked);
      if (complianceBlocked) {
        toast.warning(
          "Presell criada em rascunho: a conformidade publicitária impede a publicação automática. Abra a página e corrija os problemas — a aprovação final depende do Google/Microsoft.",
          { duration: 10000 },
        );
      }

      let pageB: typeof pageA | null = null;
      let rotatorUrl: string | null = null;

      if (enableAbTest && a.mirrorOk) {
        setGenPhase("ab");
        const typeB = abTypeB === type ? defaultAbPresellTypeB(type, generationNiche) : abTypeB;
        const b = buildContent(typeB);
        const slugB = `${slugFromTitle(titleSeed)}-b-${Date.now().toString(36).slice(-4)}`;
        const { data: createdB, error: errB } = await presellService.create({
          title: `${a.pageTitle} (B)`,
          slug: slugB,
          type: typeB,
          language,
          status: b.mirrorOk ? "published" : "draft",
          video_url: b.video_url,
          tracking: {
            offerUrl: offer,
            affiliateNetwork: platform ?? undefined,
          },
          content: b.content,
          settings,
          ...(customDomainId ? { custom_domain_id: customDomainId } : {}),
        } as never);
        if (errB || !createdB) throw new Error(errB || "Falha ao criar variante B");
        pageB = createdB;

        if (b.mirrorOk) {
          setGenPhase("rotator");
          const urlA = getPublicPresellFullUrl(customDomains, pageA.custom_domain_id ?? null, pageA);
          const urlB = getPublicPresellFullUrl(customDomains, pageB.custom_domain_id ?? null, pageB);
          const rotSlug = `ab-${slugFromTitle(titleSeed)}-${Date.now().toString(36).slice(-5)}`;
          const { data: rotator, error: rotErr } = await trafficRotatorsService.create({
            name: `A/B · ${titleSeed}`.slice(0, 120),
            slug: rotSlug,
            mode: "weighted",
            context_presell_id: pageA.id,
            is_active: true,
            arms: [
              {
                destination_url: urlA,
                label: `A · ${getPresellTypeOption(type)?.name ?? type}`,
                order_index: 0,
                weight: 50,
              },
              {
                destination_url: urlB,
                label: `B · ${getPresellTypeOption(typeB)?.name ?? typeB}`,
                order_index: 1,
                weight: 50,
              },
            ],
          });
          if (rotErr || !rotator) throw new Error(rotErr || "Falha ao criar rotador A/B");
          rotatorUrl = rotator.public_click_url;
        }
      }

      return {
        page: pageA,
        pageB,
        /** Import OK e servidor efectivamente publicou (não ficou draft por conformidade). */
        mirrorOk: a.mirrorOk && pageA.status === "published" && !complianceBlocked,
        importPublishable: a.mirrorOk,
        complianceBlocked,
        rotatorUrl,
        importNotes: imported.data?.import_notes ?? [],
      };
    },
    onSuccess: async ({
      page,
      pageB,
      mirrorOk,
      importPublishable,
      complianceBlocked,
      rotatorUrl,
      importNotes,
    }) => {
      setGenPhase("idle");
      setPresellId(page.id);
      setPresellIdB(pageB?.id ?? null);
      setMirrorFidelityOk(mirrorOk);
      const url = getPublicPresellFullUrl(customDomains, page.custom_domain_id ?? null, page);
      setPublicUrl(url);
      setReviewVariant("a");
      setRotatorAdUrl(rotatorUrl);
      if (campaignId) {
        await campaignsService.update(campaignId, {
          presell_id: page.id,
          status: mirrorOk ? "active" : "draft",
        });
      }
      void qc.invalidateQueries({ queryKey: ["presells"] });
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
      void qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      setStep(4);
      if (rotatorUrl) {
        toast.success("A/B criado: 2 landers + rotador 50/50");
      } else if (mirrorOk) {
        toast.success(
          "Presell publicada com o nome, as fotos e o link da oferta. Não é um clone da página da marca.",
        );
      } else if (complianceBlocked) {
        toast.warning(
          "Importação ok, mas a conformidade publicitária manteve a página em rascunho. Edite e publique em Presells.",
          { duration: 10000 },
        );
      } else if (importNotes.length > 0) {
        toast.warning(importNotes.join(" "));
      } else if (importPublishable) {
        toast.warning(
          "A presell ficou em rascunho. Abra Presells, complete a conformidade e publique antes de anunciar.",
        );
      } else {
        toast.warning(
          "Presell em rascunho — faltam título, imagens ou texto reais. Complete e publique antes de anunciar.",
        );
      }
    },
    onError: (e: Error) => {
      setGenPhase("idle");
      toast.error(e.message);
    },
  });

  const trackedSingle =
    publicUrl && campaignName
      ? buildTrackedPresellUrl(publicUrl, campaignName, trafficSource)
      : publicUrl;
  const tracked = rotatorAdUrl || trackedSingle;

  const copy = async () => {
    if (!tracked) return;
    await navigator.clipboard.writeText(tracked);
    setCopied(true);
    toast.success(rotatorAdUrl ? "URL do rotador A/B copiada" : "URL do anúncio copiada");
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { n: 1 as const, label: "Oferta" },
    { n: 2 as const, label: "Campanha" },
    { n: 3 as const, label: "Tipo e idioma" },
    { n: 4 as const, label: "Rastreio" },
    { n: 5 as const, label: "Rever" },
  ];

  const genLabel =
    genPhase === "import"
      ? "A ler a oferta…"
      : genPhase === "publish"
        ? "A publicar…"
        : genPhase === "ab"
          ? "A criar variante B…"
          : genPhase === "rotator"
            ? "A criar rotador A/B…"
            : createPresell.isPending
              ? "A gerar…"
              : enableAbTest
                ? "Gerar A/B e publicar"
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
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <Label>Gerador — nicho da campanha</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRESELL_NICHE_OPTIONS.map((opt) => {
                const active = generationNiche === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setGenerationNiche(opt.id);
                      setPresellType((t) => coercePresellTypeForNiche(t, opt.id));
                      if (enableAbTest) setAbTypeB(defaultAbPresellTypeB(presellType, opt.id));
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left text-xs",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/70 bg-card hover:border-primary/40",
                    )}
                  >
                    <p className="font-semibold text-foreground text-sm">{opt.name}</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

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
            <Label htmlFor="product-page">
              {generationNiche === "black"
                ? "Página do produto (nome, fotos — sem clonar claims)"
                : "Página do produto (fidelidade visual)"}
            </Label>
            <Input
              id="product-page"
              placeholder="https://… sales page (opcional — se vazio usa o hoplink)"
              value={productPageUrl}
              onChange={(e) => setProductPageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {generationNiche === "black"
                ? "Black: portal informativo (Google/Bing). O cookie só desbloqueia o artigo; o hoplink fica no botão «site oficial». A sales page agressiva não vai para o anúncio."
                : "White: a página segue o visual do produto. Em cookies o hoplink fica no aviso; nos outros tipos o CTA do tipo. Use a sales page pública, não o checkout."}
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
          {customDomains.filter((d) => d.status === "verified").length > 1 ? (
            <div className="space-y-2 max-w-xl">
              <Label>Domínio do anúncio</Label>
              <Select
                value={customDomainId || "default"}
                onValueChange={(v) => setCustomDomainId(v === "default" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Domínio padrão da conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Domínio padrão da conta</SelectItem>
                  {customDomains
                    .filter((d) => d.status === "verified")
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.hostname}
                        {d.is_default ? " (padrão)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A campanha X e a Y ficam em domínios diferentes ao escolheres aqui o domínio de cada uma.
              </p>
            </div>
          ) : null}
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
            <PresellTypeCombobox
              value={presellType}
              generationNiche={generationNiche}
              onValueChange={(v) => {
                setPresellType(v);
                if (enableAbTest) setAbTypeB(defaultAbPresellTypeB(v, generationNiche));
              }}
            />
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

          <div className="rounded-lg border border-border/60 bg-muted/15 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Teste A/B (2 landers + rotador)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cria variante B com outro tipo, mesmo espelho/hoplink, e um rotador 50/50. Use o URL do
                  rotador no anúncio.
                </p>
              </div>
              <Switch
                checked={enableAbTest}
                onCheckedChange={(v) => {
                  setEnableAbTest(v);
                  if (v) setAbTypeB(defaultAbPresellTypeB(presellType, generationNiche));
                }}
              />
            </div>
            {enableAbTest ? (
              <div className="space-y-2">
                <Label>Tipo da variante B</Label>
                <PresellTypeCombobox
                  value={abTypeB}
                  generationNiche={generationNiche}
                  onValueChange={setAbTypeB}
                />
              </div>
            ) : null}
          </div>

          {generationNiche === "black" ? (
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Identidade do operador (obrigatório para Google Ads)
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use apenas dados verdadeiros do afiliado intermediário — não se passe pelo fabricante. Não invente
                CNPJ, marca nem e-mail: a analista do Google bloqueia informação fictícia no rodapé e nas políticas.
              </p>
              <div className="space-y-2">
                <Label htmlFor="bizName">Nome do responsável / empresa</Label>
                <Input
                  id="bizName"
                  placeholder={user?.name || "O seu nome ou razão social"}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bizEmail">E-mail de contacto público</Label>
                <Input
                  id="bizEmail"
                  type="email"
                  placeholder={user?.email || "voce@dominio.com"}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bizDoc">CNPJ / CPF / NIF (opcional — só se for real)</Label>
                <Input
                  id="bizDoc"
                  placeholder="Deixe vazio se ainda não tiver"
                  value={operatorDocument}
                  onChange={(e) => setOperatorDocument(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Identidade (nicho white)</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A página espelha a oferta original — nome e políticas vêm do site do produto. Sem preenchimento
                manual de operador no white.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Opções do tipo</p>
            {presellType === "cookies" && generationNiche === "black" ? (
              <div className="space-y-2">
                <Label htmlFor="cookiePolicy">URL política de cookies (opcional)</Label>
                <Input
                  id="cookiePolicy"
                  type="url"
                  placeholder="https://…"
                  value={cookiePolicyUrl}
                  onChange={(e) => setCookiePolicyUrl(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  No black, «Aceitar» só abre o portal informativo — a oferta fica no botão da página (como afiliado
                  intermediário).
                </p>
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
          <p className="font-semibold">Rastreio</p>
          {!mirrorFidelityOk ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
              A presell ficou em <strong>rascunho</strong>. O link do anúncio só abre depois de a publicares em
              Presells.
            </div>
          ) : null}

          {tracked ? (
            <div
              className="rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-4 space-y-3"
              data-testid="presell-final-ads-url"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">URL final para o Google Ads</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Link completo da presell com UTMs, gclid e rastreamento — copie e cole no campo{" "}
                  <strong className="text-foreground/90">URL final</strong> do anúncio. Não acrescente parâmetros à
                  mão.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
                <p className="break-all font-mono text-[11px] sm:text-xs leading-relaxed text-foreground/90 select-all">
                  {tracked}
                </p>
              </div>
              <Button
                type="button"
                className="w-full sm:w-auto gap-2"
                size="lg"
                disabled={!mirrorFidelityOk}
                onClick={() => void copy()}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "URL copiada" : "Copiar URL completa para o Ads"}
              </Button>
              {!mirrorFidelityOk ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  Publique a página primeiro — em rascunho o link ainda não está no ar.
                </p>
              ) : null}
            </div>
          ) : null}

          <ul className="space-y-2 text-sm">
            {[
              ["Cliques no anúncio", "Já no link — gclid/UTMs e redirect /track, sem pixel extra"],
              ["Click ID na oferta", "Já no hoplink (subid / cid da rede reconhecida)"],
              [
                "Vendas no painel",
                "Uma vez: colar o URL de postback na BuyGoods / SmartAdv / Digistore (não no anúncio)",
              ],
              ["Página", mirrorFidelityOk ? "Publicada e pronta para o anúncio" : "Rascunho — editar antes de anunciar"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 border-b border-border/40 py-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-right max-w-[60%]">
                  {k === "Vendas no painel" || (k === "Página" && !mirrorFidelityOk) ? (
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  )}
                  {v}
                </span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-3 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">O link do anúncio já rastreia o clique</p>
            <p>
              Não acrescente pixels nem parâmetros à mão. O visitante chega com o gclid da Google; o CTA e os cookies
              passam por <span className="font-mono">/track</span> e o ID vai na oferta. Vendas no painel: em{" "}
              <strong className="text-foreground/90">Integrações → Postback</strong> copie o URL uma vez para a rede
              de afiliados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/integracoes/postback">Configurar postback agora</Link>
            </Button>
            {presellId ? (
              <Button variant="outline" asChild>
                <Link to={`/presell/builder/${presellId}`}>Editar presell</Link>
              </Button>
            ) : null}
            <Button className="w-full sm:w-auto" onClick={() => setStep(5)}>
              Continuar / Rever
            </Button>
            {mirrorFidelityOk && tracked ? (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => navigate(dpilotAdsHandoffHref(tracked))}
              >
                Anunciar no Google Ads
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {step === 5 && presellId ? (
        <PresellReviewStage
          pageId={presellId}
          pageIdB={presellIdB}
          variant={reviewVariant}
          onVariant={setReviewVariant}
          published={mirrorFidelityOk}
          adUrl={tracked}
          copied={copied}
          onCopy={() => void copy()}
          onEdit={() => navigate(`/presell/builder/${reviewVariant === "b" && presellIdB ? presellIdB : presellId}`)}
          onAdvertise={
            mirrorFidelityOk && tracked ? () => navigate(dpilotAdsHandoffHref(tracked)) : undefined
          }
          onClose={() => navigate("/presells")}
        />
      ) : null}
    </div>
  );
}
