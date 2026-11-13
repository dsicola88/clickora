import { useEffect, useMemo, useState } from "react";
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
import { useCustomDomains } from "@/hooks/useCustomDomains";
import { trafficRotatorsService } from "@/services/trafficRotatorsService";
import {
  getPublicPresellFullUrl,
  isCustomDomainHttpsPendingForPresell,
  listVerifiedHostingDomains,
} from "@/lib/publicPresellOrigin";
import { resolveManualPresellVideoUrl, resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";
import { PresellTypeCombobox } from "@/components/presell/PresellTypeCombobox";
import { getPresellTypeOption } from "@/lib/presellTypeOptions";
import { PRESELL_CREATION_LANGUAGES, type PresellLocaleKey } from "@/lib/presellUiStrings";
import { isDiscountPresellType, isVideoPresellType } from "@/lib/presellTypeMeta";
import { useAuth } from "@/contexts/AuthContext";
import { PresellReviewStage } from "@/components/presell/PresellReviewStage";
import {
  PRESELL_NICHE_OPTIONS,
  applyImportedPolicyToSettings,
  coercePresellTypeForNiche,
  defaultAbPresellTypeB,
  type PresellGenerationNiche,
} from "@/lib/presellGenerationNiche";
import { buildEditablePageDocument } from "@/lib/presellVisualEdit";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { dpilotAdsHandoffHref } from "@/lib/dpilotPresellHandoff";
import { buildClickoraEmbedScriptHtml } from "@/lib/clickoraEmbedScript";
import { mergeClickoraTrackingIntoHeader } from "@/lib/presellTrackingMerge";
import { resolveTrackApiBaseForExport, resolveTrackApiBaseForPanelEmbed } from "@/lib/apiOrigin";
import { defaultAffiliateDisclosureSetting } from "@/lib/presellPublicComplianceCopy";
import { readBrandKitPro } from "@/lib/brandKitPro";
import { bakeAndMaybePublishPresell } from "@/lib/publishPresellFlow";
import {
  PresellPublishReadiness,
  type PublishReadinessItem,
} from "@/components/PresellPublishReadiness";
import { buildEliteQualityBar } from "@/lib/presellEliteQuality";
import { looksLikeAffiliateHopOnlyUrl } from "@/lib/presellAffiliateHop";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";

function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("knownwalk")) return "Knownwalk (Everflow)";
  if (u.includes("digistore")) return "Digistore24";
  if (u.includes("hotmart")) return "Hotmart";
  if (u.includes("clickbank")) return "ClickBank";
  if (u.includes("buygoods") || u.includes("buy-goods")) return "BuyGoods";
  if (u.includes("smartadv")) return "SmartAdv";
  if (u.includes("maxweb")) return "MaxWeb";
  if (u.includes("mwebkivo") || u.includes("mwebinsight")) return "BuyGoods / MaxWeb";
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
  const { t } = useAppLocale();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isSuperAdmin } = useAuth();
  const canAdvertiseDpilot = userCanAccessDpilotAds(user, isSuperAdmin);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  /** Identidade real do operador — nunca inventar CNPJ/marca. */
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [operatorDocument, setOperatorDocument] = useState("");
  /** Rodapé POLICIES — desligado por defeito (página limpa, como SuperPresell). */
  const [showAffiliateTrustFooter, setShowAffiliateTrustFooter] = useState(false);
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
  /** Pacote landing (tsl) + review + advertorial — estilo SuperPresell. */
  const [enableTriplePack, setEnableTriplePack] = useState(false);
  const [abTypeB, setAbTypeB] = useState("desconto");
  const [cookiePolicyUrl, setCookiePolicyUrl] = useState("");
  /** Tipo cookies: Aceitar → oferta (off = só desbloqueia a review; alinhado com defaults). */
  const [cookieRedirectToOffer, setCookieRedirectToOffer] = useState(false);
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
  const [wizardReadiness, setWizardReadiness] = useState<PublishReadinessItem[]>([]);
  const [importedImageCount, setImportedImageCount] = useState(0);
  const [lastMirrorHtmlLen, setLastMirrorHtmlLen] = useState(0);

  useEffect(() => {
    if (!user) return;
    const mail =
      (typeof user.sale_notify_email === "string" && user.sale_notify_email.trim()) ||
      (typeof user.email === "string" ? user.email.trim() : "");
    setContactEmail((prev) => prev || mail);
    if (generationNiche === "black") {
      const name = typeof user.name === "string" ? user.name.trim() : "";
      setBusinessName((prev) => prev || name);
    }
  }, [user, generationNiche]);

  const platform = useMemo(() => detectPlatform(offerUrl), [offerUrl]);
  const typeDetail = getPresellTypeOption(presellType);

  const { data: customDomains = [] } = useCustomDomains();

  const { data: aiQuota } = useQuery({
    queryKey: ["presell-ai-quota"],
    queryFn: async () => {
      const { data } = await presellService.getAiQuota();
      return data ?? null;
    },
    staleTime: 30_000,
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
      if (error || !data) throw new Error(error || t("pages.createPresell.failCreateCampaign"));
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
      const titleSeed = campaignName.trim() || t("pages.createPresell.defaultTitle");
      const slug = `${slugFromTitle(titleSeed)}-${Date.now().toString(36).slice(-4)}`;
      const offer = offerUrl.trim();
      /** Knownwalk/SmartAdv: se não houver sales page, o backend resolve o hop no browser (como BuyGoods). */
      const productPage = productPageUrl.trim() || offer;

      setGenPhase("import");
      const imported = await presellService.importFromUrl({
        product_url: productPage,
        language,
        affiliate_link: offer || productPage,
        generation_niche: generationNiche,
      });
      if (imported.error || !imported.data) {
        throw new Error(
          imported.error ||
            t("pages.createPresell.readProductError"),
        );
      }

      /** Hop afiliado → sales page: preenche o 2.º campo para white/espelho nas próximas criações. */
      const resolvedSource = String(imported.data.source_url || "").trim();
      if (
        !productPageUrl.trim() &&
        resolvedSource &&
        resolvedSource.replace(/\/$/, "") !== offer.replace(/\/$/, "")
      ) {
        setProductPageUrl(resolvedSource);
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
              const embed = resolveManualPresellVideoUrl(manualYoutubeUrl.trim());
              if (!embed) throw new Error(t("pages.createPresell.youtubeInvalid"));
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
      if (
        showAffiliateTrustFooter &&
        generationNiche === "black" &&
        (!operatorName || !operatorEmail)
      ) {
        throw new Error(
          t("pages.createPresell.footerBlackRequired"),
        );
      }
      const policyFromImport = imported.data?.policy_urls;
      const identityFromSource = {
        businessName: imported.data?.source_business_name || imported.data?.product_name,
        contactEmail: imported.data?.source_contact_email,
      };
      const importedProduct = String(imported.data?.product_name || imported.data?.title || "").trim();
      const brandKit = readBrandKitPro();
      const whiteBusinessName =
        businessName.trim() ||
        brandKit.brandName.trim() ||
        identityFromSource.businessName ||
        importedProduct ||
        operatorName ||
        campaignName.trim();
      const whiteContactEmail =
        contactEmail.trim() ||
        brandKit.supportEmail.trim() ||
        identityFromSource.contactEmail ||
        operatorEmail;
      if (
        showAffiliateTrustFooter &&
        generationNiche === "white" &&
        (!whiteBusinessName || !whiteContactEmail)
      ) {
        throw new Error(
          t("pages.createPresell.footerWhiteRequired"),
        );
      }
      // Black: identidade do afiliado. White: produto + contacto real (quando o rodapé está ligado).
      const settingsBase =
        generationNiche === "black"
          ? {
              cookiePolicyUrl: cookiePolicyUrl.trim() || "/privacidade",
              privacyPolicyUrl: cookiePolicyUrl.trim() || "/privacidade",
              termsUrl: "/termos",
              ...(showAffiliateTrustFooter
                ? {
                    businessName: operatorName,
                    contactEmail: operatorEmail,
                    ...(operatorDocument.trim() ? { operatorDocument: operatorDocument.trim() } : {}),
                  }
                : {}),
            }
          : {
              cookiePolicyUrl: cookiePolicyUrl.trim() || "/privacidade",
              privacyPolicyUrl: cookiePolicyUrl.trim() || "/privacidade",
              termsUrl: "/termos",
              ...(showAffiliateTrustFooter
                ? {
                    businessName: whiteBusinessName,
                    contactEmail: whiteContactEmail,
                  }
                : {}),
            };
      const settings: Record<string, unknown> = applyImportedPolicyToSettings(
        {
          ...settingsBase,
          showAffiliateTrustFooter,
          ...(showAffiliateTrustFooter
            ? { affiliateDisclosure: defaultAffiliateDisclosureSetting(language) }
            : {}),
          minAge: minAge.trim() || "18",
          ...(type === "cookies" ? { cookieRedirectToOffer } : {}),
        },
        policyFromImport,
      );
      const uid = user?.id;
      if (uid) {
        const embed = buildClickoraEmbedScriptHtml({
          apiBase: resolveTrackApiBaseForPanelEmbed(customDomains),
          userId: uid,
        });
        settings.headerCode = mergeClickoraTrackingIntoHeader(String(settings.headerCode ?? ""), embed);
      }

      const a = buildContent(type);
      setGenPhase("publish");
      /** Cria em draft → bake CTAs com id real → publica se readiness OK. */
      const { data: pageA, error: errA } = await presellService.create({
        title: a.pageTitle,
        slug,
        type,
        language,
        status: "draft",
        video_url: a.video_url,
        tracking: {
          offerUrl: offer,
          affiliateNetwork: platform ?? undefined,
        },
        content: a.content,
        settings,
        ...(customDomainId ? { custom_domain_id: customDomainId } : {}),
      } as never);
      if (errA || !pageA) throw new Error(errA || t("pages.createPresell.failCreatePresell"));

      const publicUrlA = getPublicPresellFullUrl(customDomains, pageA.custom_domain_id ?? null, pageA);
      const pubA = await bakeAndMaybePublishPresell({
        page: pageA,
        content: a.content as Record<string, unknown>,
        affiliateLink: String((a.content as Record<string, unknown>).affiliateLink || offer),
        wantPublished: a.mirrorOk,
        publicUrl: publicUrlA,
        trackApiBase: resolveTrackApiBaseForExport(customDomains, publicUrlA),
        customDomainHttpsPending: isCustomDomainHttpsPendingForPresell(
          customDomains,
          pageA.custom_domain_id ?? null,
        ),
      });
      const pageALive = pubA.page;
      const complianceBlocked = pubA.complianceBlocked;
      if (pubA.block && a.mirrorOk) {
        toast.warning(fill(t("pages.createPresell.toastDraftBlock"), { label: pubA.block.label, hint: pubA.block.hint || "" }).trim(), {
          duration: 8000,
        });
      } else if (complianceBlocked) {
        toast.warning(
          t("pages.createPresell.toastDraftCompliance"),
          { duration: 10000 },
        );
      }

      // Velocidade: enriquecer texto (review/advertorial/tsl) sem forçar se já for longo.
      if (["review", "advertorial", "tsl", "dtc"].includes(type)) {
        try {
          await presellService.generateReviewCopy(pageALive.id, {
            force: false,
            angle:
              type === "advertorial" ? "advertorial" : type === "tsl" || type === "dtc" ? "landing" : "review",
          });
        } catch {
          /* não bloqueia a criação */
        }
      }

      let pageB: typeof pageA | null = null;
      let rotatorUrl: string | null = null;
      let triplePackNote: string | null = null;

      if (enableTriplePack) {
        setGenPhase("ab");
        const { data: pack, error: packErr } = await presellService.spawnVariantPack(pageALive.id, {
          create_rotator: true,
          deterministic_only: !(aiQuota?.openai_configured ?? false),
        });
        if (packErr || !pack) {
          toast.warning(packErr || t("pages.createPresell.toastPackFail"));
        } else {
          triplePackNote = fill(t("pages.createPresell.toastPackNote"), { source: pack.source, landing: pack.pages.landing.slug, review: pack.pages.review.slug, advertorial: pack.pages.advertorial.slug });
          toast.success(triplePackNote, { duration: 9000 });

          // Bake + publicar irmãs (cada uma com o seu track id) + rotador 33/33/34.
          const packPages = [pack.pages.landing, pack.pages.review, pack.pages.advertorial];
          const loadedEarly = await Promise.all(
            packPages.map(async (p) => {
              const { data } = await presellService.getById(p.id);
              return data;
            }),
          );
          for (const full of loadedEarly) {
            if (!full) continue;
            const c = (full.content || {}) as Record<string, unknown>;
            const pubUrl = getPublicPresellFullUrl(
              customDomains,
              full.custom_domain_id ?? pageALive.custom_domain_id ?? null,
              full,
            );
            await bakeAndMaybePublishPresell({
              page: full,
              content: c,
              affiliateLink: String(c.affiliateLink || offer),
              wantPublished: pubA.published,
              publicUrl: pubUrl,
              trackApiBase: resolveTrackApiBaseForExport(customDomains, pubUrl),
              customDomainHttpsPending: isCustomDomainHttpsPendingForPresell(
                customDomains,
                full.custom_domain_id ?? null,
              ),
            });
          }
          if (pubA.published) {
            setGenPhase("rotator");
            const loaded = await Promise.all(
              packPages.map(async (p) => {
                const { data } = await presellService.getById(p.id);
                return data;
              }),
            );
            const byId = new Map(loaded.filter(Boolean).map((p) => [p!.id, p!] as const));
            const armFor = (
              p: { id: string },
              label: string,
              order: number,
              weight: number,
            ) => {
              const full = byId.get(p.id) || pageALive;
              const url = getPublicPresellFullUrl(
                customDomains,
                full.custom_domain_id ?? pageALive.custom_domain_id ?? null,
                full,
              );
              return { destination_url: url, label, order_index: order, weight };
            };
            const rotSlug = `pack-${slugFromTitle(titleSeed)}-${Date.now().toString(36).slice(-5)}`;
            const { data: rotator, error: rotErr } = await trafficRotatorsService.create({
              name: `3 variantes · ${titleSeed}`.slice(0, 120),
              slug: rotSlug,
              mode: "weighted",
              context_presell_id: pageALive.id,
              is_active: true,
              sticky_session: true,
              arms: [
                armFor(pack.pages.landing, "Landing · TSL", 0, 33),
                armFor(pack.pages.review, "Review", 1, 33),
                armFor(pack.pages.advertorial, "Advertorial", 2, 34),
              ],
            });
            if (!rotErr && rotator?.public_click_url) {
              rotatorUrl = rotator.public_click_url;
            } else if (rotErr) {
              toast.warning(fill(t("pages.createPresell.toastVariantsRotator"), { error: rotErr }));
            }
          }
        }
      }

      if (enableAbTest && !enableTriplePack && pubA.published) {
        setGenPhase("ab");
        const typeB = abTypeB === type ? defaultAbPresellTypeB(type, generationNiche) : abTypeB;
        const b = buildContent(typeB);
        const slugB = `${slugFromTitle(titleSeed)}-b-${Date.now().toString(36).slice(-4)}`;
        const settingsB: Record<string, unknown> = {
          ...settings,
          ...(typeB === "cookies" ? { cookieRedirectToOffer } : {}),
        };
        if (typeB !== "cookies") delete settingsB.cookieRedirectToOffer;
        const { data: createdB, error: errB } = await presellService.create({
          title: `${a.pageTitle} (B)`,
          slug: slugB,
          type: typeB,
          language,
          status: "draft",
          video_url: b.video_url,
          tracking: {
            offerUrl: offer,
            affiliateNetwork: platform ?? undefined,
          },
          content: b.content,
          settings: settingsB,
          ...(customDomainId ? { custom_domain_id: customDomainId } : {}),
        } as never);
        if (errB || !createdB) throw new Error(errB || t("pages.createPresell.failVariantB"));
        const publicUrlB = getPublicPresellFullUrl(customDomains, createdB.custom_domain_id ?? null, createdB);
        const pubB = await bakeAndMaybePublishPresell({
          page: createdB,
          content: b.content as Record<string, unknown>,
          affiliateLink: String((b.content as Record<string, unknown>).affiliateLink || offer),
          wantPublished: b.mirrorOk,
          publicUrl: publicUrlB,
          trackApiBase: resolveTrackApiBaseForExport(customDomains, publicUrlB),
          customDomainHttpsPending: isCustomDomainHttpsPendingForPresell(
            customDomains,
            createdB.custom_domain_id ?? null,
          ),
        });
        pageB = pubB.page;

        if (pubB.published) {
          setGenPhase("rotator");
          const urlA = getPublicPresellFullUrl(customDomains, pageALive.custom_domain_id ?? null, pageALive);
          const urlB = getPublicPresellFullUrl(customDomains, pageB.custom_domain_id ?? null, pageB);
          const rotSlug = `ab-${slugFromTitle(titleSeed)}-${Date.now().toString(36).slice(-5)}`;
          const { data: rotator, error: rotErr } = await trafficRotatorsService.create({
            name: `A/B · ${titleSeed}`.slice(0, 120),
            slug: rotSlug,
            mode: "weighted",
            context_presell_id: pageALive.id,
            is_active: true,
            sticky_session: true,
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
          if (!rotErr && rotator?.public_click_url) {
            rotatorUrl = rotator.public_click_url;
          }
          // Se o rotador falhar após A/B publicados, não abortar: onSuccess avança com URL A e toast.
        }
      }

      const imgs = Array.isArray(imported.data?.images) ? imported.data.images.length : 0;
      const mirrorLen =
        typeof imported.data?.import_mirror_src_doc === "string"
          ? imported.data.import_mirror_src_doc.length
          : 0;
      return {
        page: pageALive,
        pageB,
        mirrorOk: pubA.published,
        importPublishable: a.mirrorOk,
        complianceBlocked,
        rotatorUrl,
        importNotes: imported.data?.import_notes ?? [],
        readinessItems: pubA.readiness,
        imageCount: imgs,
        mirrorHtmlLen: mirrorLen,
      };
    },
    onSuccess: async (
      {
        page,
        pageB,
        mirrorOk,
        importPublishable,
        complianceBlocked,
        rotatorUrl,
        importNotes,
        readinessItems,
        imageCount,
        mirrorHtmlLen,
      },
      _vars,
      _ctx,
    ) => {
      setGenPhase("idle");
      setPresellId(page.id);
      setPresellIdB(pageB?.id ?? null);
      setMirrorFidelityOk(mirrorOk);
      setWizardReadiness(readinessItems ?? []);
      setImportedImageCount(imageCount ?? 0);
      setLastMirrorHtmlLen(mirrorHtmlLen ?? 0);
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
      const wantedAb = enableAbTest && !enableTriplePack;
      const wantedPack = enableTriplePack;
      if (wantedPack && !rotatorUrl && mirrorOk) {
        toast.warning(
          t("pages.createPresell.toastPackNoRotator"),
          { duration: 10000 },
        );
      } else if (wantedPack && rotatorUrl) {
        toast.success(t("pages.createPresell.toastPackReady"));
      } else if (wantedAb && !rotatorUrl) {
        toast.error(
          t("pages.createPresell.toastAbNoRotator"),
          { duration: 10000 },
        );
      } else if (wantedAb && rotatorUrl) {
        toast.success(t("pages.createPresell.toastAbReady"));
      } else if (mirrorOk) {
        toast.success(
          t("pages.createPresell.toastPublished"),
        );
      } else if (complianceBlocked) {
        toast.warning(
          t("pages.createPresell.toastComplianceDraft"),
          { duration: 10000 },
        );
      } else if (importNotes.length > 0) {
        toast.warning(importNotes.join(" "));
      } else if (importPublishable) {
        toast.warning(
          t("pages.createPresell.toastStillDraft"),
        );
      } else {
        toast.warning(
          t("pages.createPresell.toastDraftMissing"),
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
    toast.success(
      rotatorAdUrl
        ? enableTriplePack
          ? t("pages.createPresell.copyRotatorTriple")
          : t("pages.createPresell.copyRotatorAb")
        : t("pages.createPresell.copyAdUrl"),
    );
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { n: 1 as const, label: t("pages.createPresell.stepOffer") },
    { n: 2 as const, label: t("pages.createPresell.stepCampaign") },
    { n: 3 as const, label: t("pages.createPresell.stepTypeLang") },
    { n: 4 as const, label: t("pages.createPresell.stepTracking") },
    { n: 5 as const, label: t("pages.createPresell.stepReview") },
  ];

  const genLabel =
    genPhase === "import"
      ? t("pages.createPresell.phaseImport")
      : genPhase === "publish"
        ? t("pages.createPresell.phasePublish")
        : genPhase === "ab"
          ? enableTriplePack
            ? t("pages.createPresell.phaseTriple")
            : t("pages.createPresell.phaseVariantB")
          : genPhase === "rotator"
            ? enableTriplePack
              ? t("pages.createPresell.phaseRotatorTriple")
              : t("pages.createPresell.phaseRotatorAb")
            : createPresell.isPending
              ? t("pages.createPresell.phaseGenerating")
              : enableTriplePack
                ? t("pages.createPresell.actionTriple")
                : enableAbTest
                  ? t("pages.createPresell.actionAb")
                  : t("pages.createPresell.actionGenerate");

  return (
    <div className={cn(APP_PAGE_SHELL, "max-w-2xl")}>
      <PageHeader
        title={t("pages.createPresell.title")}
        description={t("pages.createPresell.intro")}
        actions={
          <Button variant="outline" onClick={() => navigate("/presells")}>
            {t("common.cancel")}
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
            <Label>{t("pages.createPresell.nicheLabel")}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRESELL_NICHE_OPTIONS.map((opt) => {
                const active = generationNiche === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setGenerationNiche(opt.id);
                      setPresellType((prev) => coercePresellTypeForNiche(prev, opt.id));
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
            <Label htmlFor="offer">{t("pages.createPresell.offerLabel")}</Label>
            <Input
              id="offer"
              placeholder={t("pages.createPresell.offerPlaceholder")}
              value={offerUrl}
              onChange={(e) => setOfferUrl(e.target.value)}
              autoFocus
            />
            {platform ? (
              <p className="text-xs text-muted-foreground">{fill(t("pages.createPresell.networkDetected"), { name: platform })}</p>
            ) : null}
            {looksLikeAffiliateHopOnlyUrl(offerUrl) ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("pages.createPresell.hopOnlyOfferHint")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-page">
              {generationNiche === "black"
                ? t("pages.createPresell.productBlackLabel")
                : t("pages.createPresell.productWhiteLabel")}
            </Label>
            <Input
              id="product-page"
              placeholder={t("pages.createPresell.productPlaceholder")}
              value={productPageUrl}
              onChange={(e) => setProductPageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {generationNiche === "black"
                ? t("pages.createPresell.productBlackHint")
                : t("pages.createPresell.productWhiteHint")}
            </p>
            {looksLikeAffiliateHopOnlyUrl(offerUrl) && !productPageUrl.trim() ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("pages.createPresell.hopOnlyNeedProductHint")}
              </p>
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
                  setCampaignName(t("pages.createPresell.defaultCampaign"));
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
            <Label>{t("pages.createPresell.campaignNameLabel")}</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder={t("pages.createPresell.campaignNamePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("pages.createPresell.campaignNameHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("pages.createPresell.trafficSource")}</Label>
            <Select value={trafficSource} onValueChange={setTrafficSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "Google Ads", label: "Google Ads" },
                  { value: "Meta Ads", label: "Meta Ads" },
                  { value: "TikTok Ads", label: "TikTok Ads" },
                  { value: "Native", label: "Native" },
                  { value: "Email", label: "Email" },
                  { value: "Outra", label: t("pages.createPresell.sourceOther") },
                ].map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 max-w-[8rem]">
            <Label>{t("pages.createPresell.countryLabel")}</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} />
          </div>
          {listVerifiedHostingDomains(customDomains).length > 1 ? (
            <div className="space-y-2 max-w-xl">
              <Label>{t("pages.createPresell.adDomain")}</Label>
              <Select
                value={customDomainId || "default"}
                onValueChange={(v) => setCustomDomainId(v === "default" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("pages.createPresell.defaultDomain")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("pages.createPresell.defaultDomain")}</SelectItem>
                  {listVerifiedHostingDomains(customDomains).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.hostname}
                        {d.is_default ? t("pages.createPresell.defaultSuffix") : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("pages.createPresell.domainSplitHint")}
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
              {saveCampaign.isPending ? t("pages.createPresell.saving") : t("pages.createPresell.continue")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 rounded-xl border border-border/60 bg-card p-5">
          <div className="space-y-2">
            <Label>{t("pages.createPresell.pageLanguage")}</Label>
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
            <p className="text-xs text-muted-foreground">{t("pages.createPresell.pageLanguageHint")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("pages.createPresell.presellType")}</Label>
            <PresellTypeCombobox
              value={presellType}
              generationNiche={generationNiche}
              onValueChange={(v) => {
                setPresellType(v);
                if (enableAbTest) setAbTypeB(defaultAbPresellTypeB(v, generationNiche));
              }}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("pages.createPresell.typeSearchHint")}
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
                <p className="text-sm font-medium">{t("pages.createPresell.tripleTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("pages.createPresell.tripleHint")}</p>
                {aiQuota ? (
                  <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                    {fill(t("pages.createPresell.aiQuotaLine"), {
                      used: aiQuota.used,
                      limit: aiQuota.limit == null ? "" : ` / ${aiQuota.limit}`,
                      remaining:
                        aiQuota.remaining != null
                          ? fill(t("pages.createPresell.aiQuotaRemaining"), { n: aiQuota.remaining })
                          : t("pages.createPresell.aiQuotaUnlimited"),
                      openai: aiQuota.openai_configured
                        ? t("pages.createPresell.aiQuotaOn")
                        : t("pages.createPresell.aiQuotaOff"),
                    })}
                  </p>
                ) : null}
              </div>
              <Switch
                checked={enableTriplePack}
                onCheckedChange={(v) => {
                  setEnableTriplePack(v);
                  if (v) setEnableAbTest(false);
                }}
                aria-label={t("pages.createPresell.tripleAria")}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3">
              <div>
                <p className="text-sm font-medium">{t("pages.createPresell.abTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("pages.createPresell.abHint")}</p>
              </div>
              <Switch
                checked={enableAbTest}
                disabled={enableTriplePack}
                onCheckedChange={(v) => {
                  setEnableAbTest(v);
                  if (v) {
                    setEnableTriplePack(false);
                    setAbTypeB(defaultAbPresellTypeB(presellType, generationNiche));
                  }
                }}
              />
            </div>
            {enableAbTest ? (
              <div className="space-y-2">
                <Label>{t("pages.createPresell.abTypeLabel")}</Label>
                <PresellTypeCombobox
                  value={abTypeB}
                  generationNiche={generationNiche}
                  onValueChange={setAbTypeB}
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t("pages.createPresell.footerTitle")}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t("pages.createPresell.footerHint")}</p>
              </div>
              <Switch
                checked={showAffiliateTrustFooter}
                onCheckedChange={setShowAffiliateTrustFooter}
                aria-label={t("pages.createPresell.footerAria")}
              />
            </div>
            {showAffiliateTrustFooter ? (
              generationNiche === "black" ? (
                <div className="space-y-3 border-t border-border/50 pt-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("pages.createPresell.footerBlackHint")}</p>
                  <div className="space-y-2">
                    <Label htmlFor="bizName">{t("pages.createPresell.bizNameLabel")}</Label>
                    <Input
                      id="bizName"
                      placeholder={user?.name || t("pages.createPresell.bizNamePlaceholder")}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bizEmail">{t("pages.createPresell.bizEmailLabel")}</Label>
                    <Input
                      id="bizEmail"
                      type="email"
                      placeholder={user?.email || t("pages.createPresell.bizEmailPlaceholder")}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bizDoc">{t("pages.createPresell.bizDocLabel")}</Label>
                    <Input
                      id="bizDoc"
                      placeholder={t("pages.createPresell.bizDocPlaceholder")}
                      value={operatorDocument}
                      onChange={(e) => setOperatorDocument(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t border-border/50 pt-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("pages.createPresell.footerWhiteHint")}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="whiteBizName">{t("pages.createPresell.whiteNameLabel")}</Label>
                    <Input
                      id="whiteBizName"
                      placeholder={campaignName.trim() || t("pages.createPresell.productNamePlaceholder")}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whiteBizEmail">{t("pages.createPresell.bizEmailLabel")}</Label>
                    <Input
                      id="whiteBizEmail"
                      type="email"
                      placeholder={user?.email || t("pages.createPresell.bizEmailPlaceholder")}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">{t("pages.createPresell.typeOptions")}</p>
            {presellType === "cookies" ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">{t("pages.createPresell.cookieDirectTitle")}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{t("pages.createPresell.cookieDirectHint")}</p>
                  </div>
                  <Switch
                    checked={cookieRedirectToOffer}
                    onCheckedChange={setCookieRedirectToOffer}
                    aria-label={t("pages.createPresell.cookieDirectAria")}
                  />
                </div>
                {generationNiche === "black" ? (
                  <div className="space-y-2">
                    <Label htmlFor="cookiePolicy">{t("pages.createPresell.cookiePolicyLabel")}</Label>
                    <Input
                      id="cookiePolicy"
                      type="url"
                      placeholder="https://…"
                      value={cookiePolicyUrl}
                      onChange={(e) => setCookiePolicyUrl(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            {["idade", "idade_sexo", "idade_pais"].includes(presellType) ? (
              <div className="space-y-2 max-w-[8rem]">
                <Label htmlFor="minAge">{t("pages.createPresell.minAge")}</Label>
                <Input
                  id="minAge"
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
            ) : null}
            {isVideoPresellType(presellType) ? (
              <div className="space-y-2">
                <Label htmlFor="yt">{t("pages.createPresell.youtubeLabel")}</Label>
                <Input
                  id="yt"
                  placeholder={t("pages.createPresell.youtubePlaceholder")}
                  value={manualYoutubeUrl}
                  onChange={(e) => setManualYoutubeUrl(e.target.value)}
                />
              </div>
            ) : null}
            {isDiscountPresellType(presellType) ? (
              <p className="text-xs text-muted-foreground">
                {t("pages.createPresell.discountHint")}
              </p>
            ) : null}
            {presellType === "fantasma" ? (
              <p className="text-xs text-muted-foreground">
                {t("pages.createPresell.ghostHint")}
              </p>
            ) : null}
            {!["cookies", "idade", "idade_sexo", "idade_pais", "fantasma"].includes(presellType) &&
            !isVideoPresellType(presellType) &&
            !isDiscountPresellType(presellType) ? (
              <p className="text-xs text-muted-foreground">{t("pages.createPresell.noExtraOptions")}</p>
            ) : null}
          </div>

          {createPresell.isPending ? (
            <p className="text-xs text-muted-foreground">
              {genPhase === "import"
                ? t("pages.createPresell.extracting")
                : t("pages.createPresell.publishingPresell")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(2)} disabled={createPresell.isPending}>
              {t("common.back")}
            </Button>
            <Button disabled={createPresell.isPending} onClick={() => createPresell.mutate()}>
              {genLabel}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("pages.createPresell.preferQuickBefore")}{" "}
            <strong className="text-foreground/90">{t("pages.createPresell.quickFormStrong")}</strong>.
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <p className="font-semibold">{t("pages.createPresell.stepTracking")}</p>
          {!mirrorFidelityOk ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
              {t("pages.createPresell.draftBannerBefore")}{" "}
              <strong>{t("pages.createPresell.draftBannerStrong")}</strong>
              {t("pages.createPresell.draftBannerAfter")}
            </div>
          ) : null}

          {tracked ? (
            <div
              className="rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-4 space-y-3"
              data-testid="presell-final-ads-url"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{t("pages.createPresell.finalUrlTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("pages.createPresell.finalUrlBefore")}{" "}
                  <strong className="text-foreground/90">{t("pages.createPresell.finalUrlStrong")}</strong>{" "}
                  {t("pages.createPresell.finalUrlAfter")}
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
                {copied ? t("pages.createPresell.urlCopied") : t("pages.createPresell.copyFullUrl")}
              </Button>
              {!mirrorFidelityOk ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  {t("pages.createPresell.publishFirst")}
                </p>
              ) : null}
            </div>
          ) : null}

          <ul className="space-y-2 text-sm">
            {[
              [t("pages.createPresell.rowAdClicks"), t("pages.createPresell.rowAdClicksVal")],
              [t("pages.createPresell.rowClickId"), t("pages.createPresell.rowClickIdVal")],
              [
                t("pages.createPresell.rowSales"),
                t("pages.createPresell.rowSalesVal"),
              ],
              [t("pages.createPresell.rowPage"), mirrorFidelityOk ? t("pages.createPresell.rowPageLive") : t("pages.createPresell.rowPageDraft")],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 border-b border-border/40 py-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-right max-w-[60%]">
                  {k === t("pages.createPresell.rowSales") || (k === t("pages.createPresell.rowPage") && !mirrorFidelityOk) ? (
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
            <p className="font-medium text-foreground mb-1">{t("pages.createPresell.alreadyTracksTitle")}</p>
            <p>
              {t("pages.createPresell.alreadyTracksBefore")}{" "}
              <strong className="text-foreground/90">{t("pages.createPresell.alreadyTracksStrong")}</strong>{" "}
              {t("pages.createPresell.alreadyTracksAfter")}
            </p>
          </div>
          {wizardReadiness.length ? <PresellPublishReadiness items={wizardReadiness} /> : null}
          {(() => {
            const kit = readBrandKitPro();
            const ctaOk = wizardReadiness.some((i) => i.id === "cta_track" && i.ok);
            /** Espelho sintetico: length real do import + marker de bake se o gate de CTA passou. */
            const mirrorProxy =
              (ctaOk ? '<a href="/api/track/r/baked">cta</a>' : "") +
              (lastMirrorHtmlLen > 0 ? "m".repeat(Math.min(lastMirrorHtmlLen, 1600)) : "");
            const elite = buildEliteQualityBar({
              niche: generationNiche,
              affiliateLink: offerUrl,
              status: mirrorFidelityOk ? "published" : "draft",
              publicUrl,
              customDomainId: customDomainId || null,
              businessName,
              contactEmail,
              brandKitName: kit.brandName,
              hasAffiliateDisclosure: true,
              productImagesCount: importedImageCount,
              mirrorHtml: mirrorProxy,
            });
            return (
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{t("pages.createPresell.eliteTitle")}</h3>
                  <span
                    className={`text-[11px] tabular-nums font-medium ${
                      elite.ready ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    {elite.score}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {elite.ready
                    ? t("pages.createPresell.eliteReady")
                    : t("pages.createPresell.eliteIncomplete")}
                </p>
                <ul className="space-y-1.5">
                  {elite.items
                    .filter((i) => !["published", "domain"].includes(i.id))
                    .slice(0, 6)
                    .map((i) => (
                      <li key={i.id} className="flex justify-between gap-2 text-[11px]">
                        <span className={i.ok ? "text-muted-foreground" : "text-foreground"}>{i.label}</span>
                        <span className="tabular-nums shrink-0">{i.ok ? "OK" : "—"}</span>
                      </li>
                    ))}
                </ul>
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/integracoes/postback">{t("pages.createPresell.setupPostback")}</Link>
            </Button>
            {presellId ? (
              <Button variant="outline" asChild>
                <Link to={`/presell/builder/${presellId}`}>{t("pages.createPresell.editPresell")}</Link>
              </Button>
            ) : null}
            <Button className="w-full sm:w-auto" onClick={() => setStep(5)}>
              {t("pages.createPresell.continueReview")}
            </Button>
            {mirrorFidelityOk && tracked && canAdvertiseDpilot ? (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => navigate(dpilotAdsHandoffHref(tracked))}
              >
                {t("pages.createPresell.advertiseGoogle")}
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
            mirrorFidelityOk && tracked && canAdvertiseDpilot
              ? () => navigate(dpilotAdsHandoffHref(tracked))
              : undefined
          }
          onClose={() => navigate("/presells")}
        />
      ) : null}
    </div>
  );
}
