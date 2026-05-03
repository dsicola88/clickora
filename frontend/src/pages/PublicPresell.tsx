import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { presellService } from "@/services/presellService";
import { ErrorState } from "@/components/ErrorState";
import {
  CookieConsentModal,
  CookieSettingsChip,
  PresellGateFields,
  useCookieAcceptedState,
  type GatePayload,
} from "@/components/presell/PresellTypeControls";
import {
  buildOfferForwardParamKeys,
  mergeLandingQueryIntoAffiliateUrl,
} from "@/lib/presellOfferQueryForward";
import {
  getInteractiveGateKind,
  getPresellGateKind,
  isDiscountPresellType,
  isGhostPresellType,
  isVideoPresellType,
  isVslOnlyPresellType,
} from "@/lib/presellTypeMeta";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { PublicBuilderPresellView } from "@/components/presell/PublicBuilderPresellView";
import { getApiBaseUrl, resolveApiUrl } from "@/lib/apiOrigin";
import {
  getPublicPresellPrefetchResult,
  startPublicPresellPrefetchForParam,
} from "@/lib/publicPresellEarlyPrefetch";
import { isPresellUuidParam } from "@/lib/publicPresellOrigin";
import {
  DiscountPresellOverlay,
  discountSocialFallback,
} from "@/components/presell/DiscountPresellOverlay";
import { PresellCta } from "@/components/presell/PresellCta";
import { VslProductVideoFallback } from "@/components/presell/VslProductVideoFallback";
import { injectWithCleanup } from "@/lib/injectPresellCustomCode";
import { buildPresellOptionalSettingsMarketing } from "@/lib/presellOptionalSettingsMarketing";
import { PresellMarketingOverlays } from "@/components/presell/PresellMarketingOverlays";
import { isYoutubeUrl, resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";
import { applyPublicPresellHeadMetadata } from "@/lib/publicPresellSeo";
import { getPresellSeoPrimaryTitle } from "@/lib/publicPresellDocumentTitle";
import { usePresellUiLanguage } from "@/lib/presellUiLanguage";
import { PresellLanguageSelector } from "@/components/presell/PresellLanguageSelector";
import { ImportedPageMirrorIframe } from "@/components/presell/ImportedPageMirrorIframe";
import {
  darkStorefrontNavLabels,
  getPresellUiStrings,
  htmlLangForLocale,
  isRtlLocale,
} from "@/lib/presellUiStrings";
import { buildMirrorSrcDocWithTrackHref } from "@/lib/presellMirrorMarkers";
import { cn } from "@/lib/utils";

function queryParam(search: URLSearchParams, key: string) {
  return search.get(key) || undefined;
}

/** Parâmetros tipo Voluum / campanha (custo, external id, var1–var10, clickid/cid a montante). */
const VOLUUM_STYLE_TRACKING_KEYS = [
  "cost",
  "externalid",
  "clickid",
  "cid",
  "var1",
  "var2",
  "var3",
  "var4",
  "var5",
  "var6",
  "var7",
  "var8",
  "var9",
  "var10",
] as const;

/**
 * `to` = hoplink completo (já com sub1–3 da landing e parâmetros do gate, se aplicável).
 * Os UTMs/IDs na query do `/track/r/` são para o relatório dclickora; não duplicar no hoplink
 * excepto quando fundidos explicitamente (subs em mergePathSubsIntoAffiliateUrl).
 */
function makeTrackClickUrl(
  apiBase: string,
  pageId: string,
  affiliateLink: string,
  search: URLSearchParams,
): string {
  const toUrl = affiliateLink.trim();
  const clickUrl = resolveApiUrl(apiBase, `/track/r/${pageId}`);
  clickUrl.searchParams.set("to", toUrl);
  clickUrl.searchParams.set("source", queryParam(search, "utm_source") || "direct");
  clickUrl.searchParams.set("medium", queryParam(search, "utm_medium") || "none");
  clickUrl.searchParams.set("campaign", queryParam(search, "utm_campaign") || "");
  clickUrl.searchParams.set("referrer", document.referrer || "");
  const gclid = queryParam(search, "gclid");
  const fbclid = queryParam(search, "fbclid");
  const ttclid = queryParam(search, "ttclid");
  const utmTerm = queryParam(search, "utm_term");
  const utmContent = queryParam(search, "utm_content");
  const msclkid = queryParam(search, "msclkid");
  const gbraid = queryParam(search, "gbraid");
  const wbraid = queryParam(search, "wbraid");
  const utmSourceExplicit = queryParam(search, "utm_source");
  if (gclid) clickUrl.searchParams.set("gclid", gclid);
  if (gbraid) clickUrl.searchParams.set("gbraid", gbraid);
  if (wbraid) clickUrl.searchParams.set("wbraid", wbraid);
  if (utmSourceExplicit) clickUrl.searchParams.set("utm_source", utmSourceExplicit);
  if (fbclid) clickUrl.searchParams.set("fbclid", fbclid);
  if (ttclid) clickUrl.searchParams.set("ttclid", ttclid);
  if (utmTerm) clickUrl.searchParams.set("utm_term", utmTerm);
  if (utmContent) clickUrl.searchParams.set("utm_content", utmContent);
  if (msclkid) clickUrl.searchParams.set("msclkid", msclkid);
  const sub1 = queryParam(search, "sub1");
  const sub2 = queryParam(search, "sub2");
  const sub3 = queryParam(search, "sub3");
  if (sub1) clickUrl.searchParams.set("sub1", sub1);
  if (sub2) clickUrl.searchParams.set("sub2", sub2);
  if (sub3) clickUrl.searchParams.set("sub3", sub3);
  for (const k of VOLUUM_STYLE_TRACKING_KEYS) {
    const v = queryParam(search, k);
    if (v) clickUrl.searchParams.set(k, v);
  }
  return clickUrl.toString();
}

/** Pixel de impressão: envia UTMs e IDs de clique da URL da presell (alinhado com /track/r/…). */
function buildImpressionPixelUrl(apiBase: string, pageId: string, pageSearch: URLSearchParams): string {
  const params = new URLSearchParams();
  const ref = typeof document !== "undefined" ? document.referrer?.trim() : "";
  if (ref) params.set("referrer", ref);
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "ttclid",
    "msclkid",
    "sub1",
    "sub2",
    "sub3",
    ...VOLUUM_STYLE_TRACKING_KEYS,
  ] as const;
  for (const k of keys) {
    const v = pageSearch.get(k);
    if (v) params.set(k, v);
  }
  const u = resolveApiUrl(apiBase, `/track/pixel/${pageId}.gif`);
  u.search = params.toString();
  return u.toString();
}

function looksLikeSectionHeading(block: string): boolean {
  const t = block.trim();
  if (/^#{2,3}\s/.test(t)) return true;
  if (t.includes("\n")) return false;
  if (t.endsWith(".") || t.endsWith("!") || t.endsWith("?")) return false;
  if (t.length < 28 || t.length > 130) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words >= 4 && words <= 14;
}

function looksLikeBulletList(block: string): boolean {
  const lines = block
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  const bulletish = lines.filter((l) =>
    /^[•*✓✔-]\s?|^\d+[.)]\s/.test(l),
  ).length;
  return bulletish >= Math.ceil(lines.length * 0.7);
}

function SalesBlocks({
  blocks,
  midInsert,
}: {
  blocks: string[];
  midInsert: ReactNode;
}) {
  if (blocks.length === 0) return null;
  const mid = Math.max(4, Math.min(Math.floor(blocks.length / 2), 12));
  const first = blocks.slice(0, mid);
  const rest = blocks.slice(mid);

  return (
    <div className="space-y-5 text-left">
      {first.map((block, i) => (
        <ContentBlock key={`a-${i}`} block={block} />
      ))}
      {rest.length > 0 ? midInsert : null}
      {rest.map((block, i) => (
        <ContentBlock key={`b-${i}`} block={block} />
      ))}
    </div>
  );
}

function ContentBlock({ block }: { block: string }) {
  const t = block.trim();
  if (looksLikeSectionHeading(t)) {
    const clean = t.replace(/^#{2,3}\s*/, "");
    return (
      <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight pt-2 border-b border-border/40 pb-2">
        {clean}
      </h3>
    );
  }
  if (looksLikeBulletList(t)) {
    const lines = t
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return (
      <ul className="space-y-3 text-left list-none pl-0 my-1">
        {lines.map((line, i) => {
          const clean = line.replace(/^[•*✓✔-]\s*/, "").replace(/^\d+[.)]\s*/, "");
          return (
            <li
              key={i}
              className="flex gap-3 text-base md:text-[1.05rem] leading-relaxed text-foreground/90"
            >
              <span className="mt-0.5 shrink-0 text-orange-500 font-bold" aria-hidden>
                ✓
              </span>
              <span>{clean}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  return <p className="text-base md:text-[1.05rem] leading-[1.75] text-foreground/90 whitespace-pre-line">{t}</p>;
}

function StorefrontRatingRow({
  value,
  stars,
  variant = "default",
}: {
  value: string;
  stars: number;
  variant?: "default" | "darkHero" | "tintHero";
}) {
  const n = Math.min(5, Math.max(0, Math.round(stars)));
  const starCls =
    variant === "darkHero"
      ? "text-amber-400"
      : variant === "tintHero"
        ? "text-white drop-shadow-sm"
        : "text-orange-500 dark:text-orange-400";
  const labelCls =
    variant === "darkHero"
      ? "text-slate-300"
      : variant === "tintHero"
        ? "text-white/90 drop-shadow-sm"
        : "text-foreground/85";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={`Avaliação ${value}`}>
      <span className={cn("flex gap-0.5", starCls)} aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn("text-lg leading-none", i < n ? "opacity-100" : "opacity-20")}>
            ★
          </span>
        ))}
      </span>
      <span className={cn("text-sm font-medium", labelCls)}>{value}</span>
    </div>
  );
}

/** Última frase do subtítulo em destaque amarelo (como muitas landings de suplemento). */
function StorefrontDarkSubtitle({ subtitle }: { subtitle: string }) {
  const parts = subtitle
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1].length >= 10) {
    const lead = parts.slice(0, -1).join(" ");
    const hi = parts[parts.length - 1];
    return (
      <div className="space-y-3">
        <p className="text-base md:text-lg text-slate-400 leading-relaxed">{lead}</p>
        <p className="inline-block rounded-sm bg-amber-400 px-3 py-2 text-base md:text-lg font-semibold text-slate-950 shadow-sm">
          {hi}
        </p>
      </div>
    );
  }
  return <p className="text-base md:text-lg text-slate-400 leading-relaxed">{subtitle}</p>;
}

/** Subtítulo em hero lavanda / violeta (texto claro + destaque em cor quente). */
function StorefrontTintSubtitle({ subtitle }: { subtitle: string }) {
  const parts = subtitle
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1].length >= 10) {
    const lead = parts.slice(0, -1).join(" ");
    const hi = parts[parts.length - 1];
    return (
      <div className="space-y-3">
        <p className="text-base md:text-lg text-white/85 leading-relaxed drop-shadow-sm">{lead}</p>
        <p className="inline-block rounded-md bg-orange-600/95 px-3 py-2 text-base md:text-lg font-semibold text-white shadow-md">
          {hi}
        </p>
      </div>
    );
  }
  return <p className="text-base md:text-lg text-white/85 leading-relaxed drop-shadow-sm">{subtitle}</p>;
}

/**
 * Camada sobre o canto inferior direito do embed do YouTube para absorver cliques no logo (abre youtube.com).
 * Não há parâmetro oficial no iframe para remover o logo; a área é estreita para não tapar ecrã inteiro / definições.
 */
function YoutubeCornerClickShield({ embedSrc }: { embedSrc: string }) {
  if (!isYoutubeUrl(embedSrc)) return null;
  return (
    <div
      className="pointer-events-auto absolute bottom-0 right-0 z-[3] h-12 w-[min(104px,28%)] select-none bg-transparent"
      aria-hidden
    />
  );
}

/** Iframe de plataforma de vídeo vs ficheiro .mp4/.webm (importado da página). */
function isEmbedPlayerVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u)) return false;
  return (
    /youtube\.com|youtu\.be|youtube-nocookie/.test(u) ||
    /vimeo\.com|player\.vimeo/.test(u) ||
    /wistia\.|wi\.st|fast\.wistia/.test(u) ||
    /loom\.com\/embed/.test(u) ||
    /dailymotion\.com|dai\.ly/.test(u) ||
    /cloudflarestream|videodelivery\.net/.test(u) ||
    /brightcove|jwplatform/.test(u)
  );
}

function normalizePresellRouteParam(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    return decodeURIComponent(t).replace(/\/+$/, "");
  } catch {
    return t.replace(/\/+$/, "");
  }
}

export default function PublicPresell() {
  const rawId = useParams().id ?? "";
  const id = useMemo(() => normalizePresellRouteParam(rawId), [rawId]);

  useInsertionEffect(() => {
    if (id) startPublicPresellPrefetchForParam(id);
  }, [id]);

  useLayoutEffect(() => {
    if (!id) return;
    const t = document.title.trim();
    if (!t || /dclickora|clickora/i.test(t)) {
      document.title = "\u00A0";
    }
  }, [id]);

  const { data: page, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ["public-presell", id],
    queryFn: async () => {
      const param = id;
      const pref = await getPublicPresellPrefetchResult(param);
      if (pref) return pref;

      if (isPresellUuidParam(param)) {
        const { data, error } = await presellService.getPublicById(param);
        if (data) return data;
        if (error) throw new Error(error);
        throw new Error("Página não encontrada");
      }
      const { data, error } = await presellService.getPublicBySlug(param);
      if (data) return data;
      throw new Error(error || "Página não encontrada");
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!page) return;
    return applyPublicPresellHeadMetadata(page);
  }, [page]);

  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const { cookieAccepted, setCookieAccepted } = useCookieAcceptedState();
  const [cookieDismissed, setCookieDismissed] = useState(false);
  const [fieldGate, setFieldGate] = useState<GatePayload>({ params: {}, ctaEnabled: true });

  const { resolved: uiLang, setMode, override } = usePresellUiLanguage(page?.id, page?.language);

  useEffect(() => {
    document.documentElement.lang = htmlLangForLocale(uiLang);
    document.documentElement.dir = isRtlLocale(uiLang) ? "rtl" : "ltr";
  }, [uiLang]);

  useEffect(() => {
    setCookieAccepted(false);
    setCookieDismissed(false);
    setFieldGate({ params: {}, ctaEnabled: true });
  }, [page?.id, setCookieAccepted]);

  const [storefrontMainIdx, setStorefrontMainIdx] = useState(0);
  useEffect(() => {
    setStorefrontMainIdx(0);
  }, [page?.id]);

  const handleFieldPayload = useCallback((p: GatePayload) => {
    setFieldGate(p);
  }, []);

  useEffect(() => {
    if (!page?.id) return;
    const pixel = new Image();
    pixel.src = buildImpressionPixelUrl(apiBase, page.id, search);
  }, [page?.id, apiBase, search]);

  const bodyCodeMountRef = useRef<HTMLDivElement>(null);
  const settingsInjectKey = useMemo(() => {
    if (!page?.settings) return "";
    const s = page.settings as Record<string, unknown>;
    const opt = buildPresellOptionalSettingsMarketing(s);
    return JSON.stringify({
      h: s.headerCode ?? "",
      conv: s.conversionTrackingScript ?? "",
      b: s.bodyCode ?? "",
      f: s.footerCode ?? "",
      c: s.customCss ?? "",
      m: opt.cacheKey,
    });
  }, [page?.settings]);

  // Re-run when serialized custom code changes (settingsInjectKey), not when page.settings object identity changes.
  useLayoutEffect(() => {
    if (!page?.id) return;
    const s = (page.settings || {}) as Record<string, unknown>;
    const conversionTrackingScript = String(s.conversionTrackingScript ?? "").trim();
    const headerCode = String(s.headerCode ?? "").trim();
    const bodyCode = String(s.bodyCode ?? "").trim();
    const footerCode = String(s.footerCode ?? "").trim();
    const customCss = String(s.customCss ?? "").trim();
    const optionalMarketing = buildPresellOptionalSettingsMarketing(s);

    const cleanups: (() => void)[] = [];

    if (customCss) {
      const style = document.createElement("style");
      style.setAttribute("data-presell-custom-css", page.id);
      style.textContent = customCss;
      document.head.appendChild(style);
      cleanups.push(() => style.remove());
    }
    if (conversionTrackingScript)
      cleanups.push(injectWithCleanup(conversionTrackingScript, document.head));
    if (optionalMarketing.headHtml.trim()) {
      cleanups.push(injectWithCleanup(optionalMarketing.headHtml, document.head));
    }
    if (headerCode) cleanups.push(injectWithCleanup(headerCode, document.head));
    if (optionalMarketing.bodyHtml.trim()) {
      cleanups.push(injectWithCleanup(optionalMarketing.bodyHtml, document.body));
    }
    if (bodyCode && bodyCodeMountRef.current) {
      cleanups.push(injectWithCleanup(bodyCode, bodyCodeMountRef.current));
    }
    if (footerCode) cleanups.push(injectWithCleanup(footerCode, document.body));

    return () => cleanups.forEach((fn) => fn());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps above: settingsInjectKey covers page.settings fields
  }, [page?.id, settingsInjectKey]);

  const content = (page?.content || {}) as Record<string, unknown>;
  const affiliateLink = (content.affiliateLink as string) || "#";
  const settings = (page?.settings || {}) as Record<string, unknown>;

  const showCookieModal =
    getPresellGateKind(page?.type || "") === "cookies" && !cookieAccepted && !cookieDismissed;
  const showCookieChip =
    getPresellGateKind(page?.type || "") === "cookies" && !cookieAccepted && cookieDismissed;

  useEffect(() => {
    if (showCookieModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showCookieModal]);

  const ctaEnabled = useMemo(() => {
    const gk = getPresellGateKind(page?.type || "");
    const ik = getInteractiveGateKind(page?.type || "");
    // Cookies: o gate é o modal (redireciona para a oferta); o CTA da página usa o mesmo link do afiliado.
    if (gk === "cookies") return true;
    if (ik) return fieldGate.ctaEnabled;
    return true;
  }, [page?.type, fieldGate.ctaEnabled]);

  const href = useMemo(() => {
    if (!page?.id) return "";
    let dest = affiliateLink.trim();
    const forwardKeys = buildOfferForwardParamKeys(settings as Record<string, unknown>);
    dest = mergeLandingQueryIntoAffiliateUrl(dest, search, forwardKeys);
    const ik = getInteractiveGateKind(page.type);
    if (ik && Object.keys(fieldGate.params).length > 0) {
      dest = mergeParamsIntoAffiliateUrl(dest, fieldGate.params);
    }
    return makeTrackClickUrl(apiBase, page.id, dest, search);
  }, [apiBase, page?.id, page?.type, affiliateLink, search, fieldGate.params, settings.offerQueryForwardAllowlist]);

  const importMirrorSrcDocRaw =
    typeof content.importMirrorSrcDoc === "string" ? content.importMirrorSrcDoc.trim() : "";

  const mirrorSrcDoc = useMemo(() => {
    if (!importMirrorSrcDocRaw || !href) return "";
    return buildMirrorSrcDocWithTrackHref(importMirrorSrcDocRaw, href);
  }, [importMirrorSrcDocRaw, href]);

  const videoEmbedSrc = useMemo(() => {
    if (!page?.video_url) return "";
    return resolveVideoEmbedSrc(page.video_url);
  }, [page?.video_url]);

  const ghostRedirectDone = useRef(false);
  useEffect(() => {
    ghostRedirectDone.current = false;
  }, [page?.id]);

  useEffect(() => {
    if (!page?.id || !isGhostPresellType(page.type) || !href) return;
    const go = () => {
      if (ghostRedirectDone.current) return;
      ghostRedirectDone.current = true;
      window.location.assign(href);
    };
    const opts = { passive: true } as const;
    window.addEventListener("mousemove", go, opts);
    window.addEventListener("touchstart", go, opts);
    window.addEventListener("touchmove", go, opts);
    window.addEventListener("scroll", go, opts);
    window.addEventListener("wheel", go, opts);
    window.addEventListener("pointermove", go, opts);
    return () => {
      window.removeEventListener("mousemove", go);
      window.removeEventListener("touchstart", go);
      window.removeEventListener("touchmove", go);
      window.removeEventListener("scroll", go);
      window.removeEventListener("wheel", go);
      window.removeEventListener("pointermove", go);
    };
  }, [page?.id, page?.type, href]);

  if (isLoading) {
    return <div className="min-h-screen bg-background" aria-busy="true" aria-label="A carregar página" />;
  }
  if (isError || !page) {
    const raw =
      loadError instanceof Error ? loadError.message : "Página indisponível.";
    let msg = raw;
    if (/Failed to fetch|NetworkError|load failed/i.test(raw)) {
      msg = `${raw} No seu domínio, os pedidos devem ir para o mesmo site (ex.: /api/…). Recarregue ou verifique o DNS.`;
    } else if (
      raw.trim() === "Página não encontrada" ||
      /^Página não encontrada\.?$/i.test(raw.trim())
    ) {
      msg =
        "Página não encontrada. Confirme no painel: a presell está «Publicada»; o UUID no URL é o copiado da lista (mesma conta); a subscrição está ativa.";
    }
    return <ErrorState message={msg} onRetry={() => refetch()} />;
  }

  const gateKind = getPresellGateKind(page.type);
  const interactiveKind = getInteractiveGateKind(page.type);

  const title = (content.title as string) || page.title;
  const subtitle = (content.subtitle as string) || "";
  const salesText = (content.salesText as string) || "";
  const ctaText = (content.ctaText as string) || "Quero Aproveitar Agora";
  const productImages = Array.isArray(content.productImages)
    ? (content.productImages as string[]).filter((u) => typeof u === "string" && u.length > 0)
    : [];

  const cookiePolicyUrl = typeof settings.cookiePolicyUrl === "string" ? settings.cookiePolicyUrl : "";

  const primarySeoLabel = getPresellSeoPrimaryTitle(page);

  const heroImage = productImages[0];
  const galleryImages = productImages.slice(1, 10);
  const textBlocks = salesText
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const vslExcerpt = (() => {
    const first = textBlocks[0] || "";
    if (!first) return "";
    return first.length > 300 ? `${first.slice(0, 297)}…` : first;
  })();

  const showVideo = isVideoPresellType(page.type) && !!page.video_url;
  const showVslFallback = isVideoPresellType(page.type) && !page.video_url;
  const hideHeroImageForVslFallback = showVslFallback;
  const isVslLayout = isVideoPresellType(page.type);
  const showSalesLetterSection =
    textBlocks.length > 0 && !isVslOnlyPresellType(page.type);

  const isDiscount = isDiscountPresellType(page.type);
  const discountHeadline = (content.discountHeadline as string) || title;
  const socialProofLine = typeof content.socialProofLine === "string" ? content.socialProofLine : "";
  const ratingValue = typeof content.ratingValue === "string" ? content.ratingValue : "4.9";
  const ratingStars = typeof content.ratingStars === "number" ? content.ratingStars : 5;
  const urgencyTimerSeconds =
    typeof content.urgencyTimerSeconds === "number" ? content.urgencyTimerSeconds : 649;

  const isGhostPage = isGhostPresellType(page.type);
  const storefrontLayout = !isVslLayout && !isGhostPage && productImages.length > 0;
  const storefrontTheme =
    content.storefrontTheme === "dark_commerce" ? "dark_commerce" : "default";
  const useDarkMirrorStorefront = storefrontLayout && storefrontTheme === "dark_commerce";
  const storefrontHeroTint = content.storefrontHeroTint === true;
  const useTintedCommerceStorefront =
    storefrontLayout && storefrontTheme !== "dark_commerce" && storefrontHeroTint;
  /** Corpo claro em largura total (como a landing original por baixo do hero). */
  const storefrontMirrorLightBody = useDarkMirrorStorefront || useTintedCommerceStorefront;
  const useImportedPageMirror =
    importMirrorSrcDocRaw.length > 800 &&
    mirrorSrcDoc.length > 800 &&
    !isVslLayout &&
    !isGhostPage &&
    page.type !== "builder";

  const darkNav = darkStorefrontNavLabels(uiLang);
  const productNameLabel =
    typeof content.productName === "string"
      ? content.productName.trim()
      : typeof (content as { product_name?: unknown }).product_name === "string"
        ? String((content as { product_name: string }).product_name).trim()
        : "";
  const showStorefrontRating =
    !isDiscount &&
    typeof content.ratingStars === "number" &&
    content.ratingStars > 0 &&
    typeof content.ratingValue === "string" &&
    content.ratingValue.trim().length > 0;

  const builderDoc = parsePresellBuilderPageDocument(page.content);
  if (page.type === "builder") {
    if (!builderDoc) {
      return (
        <ErrorState
          message="Esta presell manual não tem um documento válido. Edite-a de novo no painel ou contacte o suporte."
          onRetry={() => refetch()}
        />
      );
    }
    return (
      <div className="min-h-screen bg-background pb-12">
        <PresellMarketingOverlays
          pageId={page.id}
          settings={settings}
          trackHref={href}
          language={uiLang}
        />
        <div
          ref={bodyCodeMountRef}
          className="sr-only pointer-events-none absolute h-0 w-0 overflow-hidden"
          aria-hidden
          data-presell-inject="body-start"
        />
        <PublicBuilderPresellView doc={builderDoc} />
      </div>
    );
  }

  const pageBody = (
    <>
      {gateKind === "cookies" && !cookieAccepted && !cookieDismissed ? (
        <CookieConsentModal
          language={uiLang}
          policyUrl={cookiePolicyUrl}
          accepted={cookieAccepted}
          redirectHref={href}
          onAccept={() => setCookieAccepted(true)}
          onDismiss={() => setCookieDismissed(true)}
        />
      ) : null}
      {gateKind === "cookies" && showCookieChip ? (
        <CookieSettingsChip
          language={uiLang}
          onClick={() => {
            if (href) window.location.assign(href);
          }}
        />
      ) : null}

      {useImportedPageMirror ? (
        <ImportedPageMirrorIframe srcDoc={mirrorSrcDoc} title={primarySeoLabel} />
      ) : null}

      {!useImportedPageMirror && storefrontLayout ? (
        useDarkMirrorStorefront ? (
          <>
            <header className="sticky top-0 z-40 border-b border-amber-500/30 bg-[#060a12]/95 backdrop-blur-md">
              <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-14 sm:h-[3.75rem] flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_12px_rgba(251,191,36,0.45)]"
                    aria-hidden
                  />
                  <span className="font-bold text-white tracking-wide uppercase truncate text-xs sm:text-sm md:text-base">
                    {(productNameLabel || title).slice(0, 42)}
                  </span>
                </div>
                <nav
                  className="hidden md:flex items-center gap-7 text-sm text-slate-400 font-medium"
                  aria-label="Secções"
                >
                  <a href="#presell-story" className="hover:text-white transition-colors">
                    {darkNav.about}
                  </a>
                  <a href="#presell-story" className="hover:text-white transition-colors">
                    {darkNav.ingredients}
                  </a>
                  <a href="#presell-story" className="hover:text-white transition-colors">
                    {darkNav.faq}
                  </a>
                </nav>
                <a
                  href={href}
                  className={cn(
                    "shrink-0 rounded border border-amber-400/90 px-2 sm:px-3 py-1.5 max-w-[min(11rem,42vw)] sm:max-w-[13rem] md:max-w-none truncate text-[10px] sm:text-xs font-bold uppercase tracking-wide text-amber-400 hover:bg-amber-400/10 transition-colors",
                    !ctaEnabled && "pointer-events-none opacity-50",
                  )}
                >
                  {ctaText}
                </a>
              </div>
            </header>
            <section
              className="relative overflow-hidden border-b border-amber-900/25"
              style={{
                backgroundColor: "#0a0e17",
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.028) 2px, rgba(255,255,255,0.028) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)`,
              }}
            >
              <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-6 sm:pt-10 pb-10 md:pb-14">
                {interactiveKind ? (
                  <div className="mb-8 text-center max-w-3xl mx-auto text-slate-200 [&_label]:text-slate-200 [&_p]:text-slate-300">
                    <PresellGateFields
                      gateKind={interactiveKind}
                      language={uiLang}
                      settings={settings}
                      onPayload={handleFieldPayload}
                    />
                  </div>
                ) : null}

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
                  <div className="space-y-4 md:sticky md:top-6">
                    <div className="rounded-2xl border border-amber-500/25 bg-black/25 shadow-[0_0_48px_-12px_rgba(251,191,36,0.12)] p-4 sm:p-5">
                      <img
                        src={productImages[Math.min(storefrontMainIdx, productImages.length - 1)]}
                        alt={primarySeoLabel}
                        className="w-full max-h-[min(520px,65vh)] object-contain mx-auto rounded-xl"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                      />
                    </div>
                    {productImages.length > 1 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                        {productImages.map((src, i) => (
                          <button
                            key={`${i}-${src.slice(0, 48)}`}
                            type="button"
                            onClick={() => setStorefrontMainIdx(i)}
                            className={cn(
                              "shrink-0 snap-start rounded-lg border-2 overflow-hidden transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/90",
                              i === storefrontMainIdx
                                ? "border-amber-400 ring-2 ring-amber-400/35 shadow-sm"
                                : "border-white/15 opacity-90 hover:opacity-100",
                            )}
                            aria-label={`Imagem ${i + 1}`}
                          >
                            <img
                              src={src}
                              alt=""
                              className="h-16 w-16 sm:h-20 sm:w-20 object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-left space-y-4 lg:space-y-5 pt-1 md:pt-2">
                    {productNameLabel ? (
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-500/90">
                        {productNameLabel}
                      </p>
                    ) : null}
                    <h1 className="text-2xl sm:text-3xl lg:text-[2.65rem] font-sans font-extrabold uppercase tracking-tight text-white leading-tight break-words">
                      {title}
                    </h1>
                    {showStorefrontRating ? (
                      <StorefrontRatingRow
                        value={String(content.ratingValue)}
                        stars={Number(content.ratingStars)}
                        variant="darkHero"
                      />
                    ) : null}
                    {subtitle ? <StorefrontDarkSubtitle subtitle={subtitle} /> : null}
                    <div className="pt-1">
                      <PresellCta href={href} disabled={!ctaEnabled} surface="dark" stretch>
                        {ctaText}
                      </PresellCta>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed border-t border-white/10 pt-4">
                      {getPresellUiStrings(uiLang).midCta}
                    </p>
                  </div>
                </div>

                {showVideo ? (
                  <div className="relative w-full max-w-4xl mx-auto aspect-video bg-black/60 rounded-xl overflow-hidden shadow-md border border-amber-900/40 mt-10">
                    {isEmbedPlayerVideoUrl(videoEmbedSrc) ? (
                      <>
                        <iframe
                          title="Vídeo"
                          src={videoEmbedSrc}
                          className="absolute inset-0 z-0 h-full w-full border-0"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                        <YoutubeCornerClickShield embedSrc={videoEmbedSrc} />
                      </>
                    ) : (
                      <video
                        title="Vídeo"
                        src={videoEmbedSrc}
                        className="absolute inset-0 h-full w-full object-contain bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : useTintedCommerceStorefront ? (
          <>
            <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-900/95 backdrop-blur-md">
              <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-14 sm:h-[3.75rem] flex items-center justify-between gap-2 sm:gap-3">
                <span className="font-bold text-white tracking-wide uppercase truncate text-xs sm:text-sm md:text-base min-w-0">
                  {(productNameLabel || title).slice(0, 42)}
                </span>
                <nav
                  className="hidden md:flex items-center gap-6 lg:gap-7 text-sm text-white/80 font-medium shrink-0"
                  aria-label="Secções"
                >
                  <a href="#presell-story" className="hover:text-white transition-colors whitespace-nowrap">
                    {darkNav.about}
                  </a>
                  <a href="#presell-story" className="hover:text-white transition-colors whitespace-nowrap">
                    {darkNav.ingredients}
                  </a>
                  <a href="#presell-story" className="hover:text-white transition-colors whitespace-nowrap">
                    {darkNav.faq}
                  </a>
                </nav>
                <a
                  href={href}
                  className={cn(
                    "shrink-0 rounded-lg bg-teal-500 px-2 sm:px-3 py-1.5 max-w-[min(11rem,42vw)] sm:max-w-[13rem] md:max-w-none truncate text-[10px] sm:text-xs font-bold text-white shadow-md hover:bg-teal-500 hover:brightness-110 transition-[filter]",
                    !ctaEnabled && "pointer-events-none opacity-50",
                  )}
                >
                  {ctaText}
                </a>
              </div>
            </header>
            <section
              className="relative overflow-hidden border-b border-violet-400/25"
              style={{
                background: "linear-gradient(145deg, #c4b5fd 0%, #bfb0f5 22%, #ddd6fe 52%, #ede9fe 78%, #f5f3ff 100%)",
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_20%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
              <div className="relative w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-6 sm:pt-10 pb-10 md:pb-14">
                {interactiveKind ? (
                  <div className="mb-8 text-center max-w-3xl mx-auto rounded-2xl border border-white/50 bg-white/85 shadow-lg px-4 py-5 text-slate-900 backdrop-blur-sm [&_label]:text-slate-800 [&_p]:text-slate-700">
                    <PresellGateFields
                      gateKind={interactiveKind}
                      language={uiLang}
                      settings={settings}
                      onPayload={handleFieldPayload}
                    />
                  </div>
                ) : null}

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
                  <div className="space-y-4 md:sticky md:top-6">
                    <div className="rounded-2xl border border-white/55 bg-white/25 shadow-[0_12px_40px_-12px_rgba(91,33,182,0.25)] backdrop-blur-[2px] p-4 sm:p-5">
                      <img
                        src={productImages[Math.min(storefrontMainIdx, productImages.length - 1)]}
                        alt={primarySeoLabel}
                        className="w-full max-h-[min(520px,65vh)] object-contain mx-auto rounded-xl bg-white/40"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                      />
                    </div>
                    {productImages.length > 1 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                        {productImages.map((src, i) => (
                          <button
                            key={`${i}-${src.slice(0, 48)}`}
                            type="button"
                            onClick={() => setStorefrontMainIdx(i)}
                            className={cn(
                              "shrink-0 snap-start rounded-lg border-2 overflow-hidden transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90",
                              i === storefrontMainIdx
                                ? "border-white ring-2 ring-white/50 shadow-md"
                                : "border-white/40 opacity-95 hover:opacity-100",
                            )}
                            aria-label={`Imagem ${i + 1}`}
                          >
                            <img
                              src={src}
                              alt=""
                              className="h-16 w-16 sm:h-20 sm:w-20 object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-left space-y-4 lg:space-y-5 pt-1 md:pt-2">
                    {productNameLabel ? (
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/90 drop-shadow-sm">
                        {productNameLabel}
                      </p>
                    ) : null}
                    <h1 className="text-2xl sm:text-3xl lg:text-[2.45rem] font-sans font-bold tracking-tight text-white leading-[1.15] drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] break-words">
                      {title}
                    </h1>
                    {showStorefrontRating ? (
                      <StorefrontRatingRow
                        value={String(content.ratingValue)}
                        stars={Number(content.ratingStars)}
                        variant="tintHero"
                      />
                    ) : null}
                    {subtitle ? <StorefrontTintSubtitle subtitle={subtitle} /> : null}
                    <div className="pt-1">
                      <PresellCta href={href} disabled={!ctaEnabled} surface="tintHero" stretch>
                        {ctaText}
                      </PresellCta>
                    </div>
                    <p className="text-xs text-violet-950/70 leading-relaxed border-t border-violet-400/35 pt-4">
                      {getPresellUiStrings(uiLang).midCta}
                    </p>
                  </div>
                </div>

                {showVideo ? (
                  <div className="relative w-full max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden shadow-lg border border-violet-400/40 bg-black/30 backdrop-blur-sm mt-10">
                    {isEmbedPlayerVideoUrl(videoEmbedSrc) ? (
                      <>
                        <iframe
                          title="Vídeo"
                          src={videoEmbedSrc}
                          className="absolute inset-0 z-0 h-full w-full border-0"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                        <YoutubeCornerClickShield embedSrc={videoEmbedSrc} />
                      </>
                    ) : (
                      <video
                        title="Vídeo"
                        src={videoEmbedSrc}
                        className="absolute inset-0 h-full w-full object-contain bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <section className="relative overflow-hidden border-b border-border/40 bg-background">
            <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-6 sm:pt-10 pb-10 md:pb-14">
              {interactiveKind ? (
                <div className="mb-8 text-center max-w-3xl mx-auto">
                  <PresellGateFields
                    gateKind={interactiveKind}
                    language={uiLang}
                    settings={settings}
                    onPayload={handleFieldPayload}
                  />
                </div>
              ) : null}

              <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
                <div className="space-y-4 md:sticky md:top-6">
                  <div className="rounded-2xl border border-slate-200/90 dark:border-border/60 bg-white dark:bg-card shadow-sm p-4 sm:p-5">
                    <img
                      src={productImages[Math.min(storefrontMainIdx, productImages.length - 1)]}
                      alt={primarySeoLabel}
                      className="w-full max-h-[min(520px,65vh)] object-contain mx-auto rounded-xl bg-slate-50/80 dark:bg-muted/20"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                    />
                  </div>
                  {productImages.length > 1 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                      {productImages.map((src, i) => (
                        <button
                          key={`${i}-${src.slice(0, 48)}`}
                          type="button"
                          onClick={() => setStorefrontMainIdx(i)}
                          className={cn(
                            "shrink-0 snap-start rounded-lg border-2 overflow-hidden transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/80",
                            i === storefrontMainIdx
                              ? "border-orange-500 ring-2 ring-orange-500/30 shadow-sm"
                              : "border-border/60 opacity-90 hover:opacity-100",
                          )}
                          aria-label={`Imagem ${i + 1}`}
                        >
                          <img
                            src={src}
                            alt=""
                            className="h-16 w-16 sm:h-20 sm:w-20 object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="text-left space-y-4 lg:space-y-5 pt-1 md:pt-2">
                  {productNameLabel ? (
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {productNameLabel}
                    </p>
                  ) : null}
                  <h1 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-serif font-bold tracking-tight text-foreground leading-tight break-words">
                    {title}
                  </h1>
                  {showStorefrontRating ? (
                    <StorefrontRatingRow
                      value={String(content.ratingValue)}
                      stars={Number(content.ratingStars)}
                    />
                  ) : null}
                  {subtitle ? (
                    <p className="text-base text-muted-foreground leading-relaxed">{subtitle}</p>
                  ) : null}
                  <div className="pt-1">
                    <PresellCta href={href} disabled={!ctaEnabled} surface="commerce" stretch>
                      {ctaText}
                    </PresellCta>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                    {getPresellUiStrings(uiLang).midCta}
                  </p>
                </div>
              </div>

              {showVideo ? (
                <div className="relative w-full max-w-4xl mx-auto aspect-video bg-muted rounded-xl overflow-hidden shadow-md border border-border/50 mt-10">
                  {isEmbedPlayerVideoUrl(videoEmbedSrc) ? (
                    <>
                      <iframe
                        title="Vídeo"
                        src={videoEmbedSrc}
                        className="absolute inset-0 z-0 h-full w-full border-0"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                      <YoutubeCornerClickShield embedSrc={videoEmbedSrc} />
                    </>
                  ) : (
                    <video
                      title="Vídeo"
                      src={videoEmbedSrc}
                      className="absolute inset-0 h-full w-full object-contain bg-black"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )}
                </div>
              ) : null}
            </div>
          </section>
        )
      ) : !useImportedPageMirror ? (
        <section
          className={
            isVslLayout
              ? "relative overflow-hidden border-b border-border/30 bg-gradient-to-b from-slate-950 via-slate-900/95 to-background text-foreground"
              : "relative overflow-hidden bg-gradient-to-b from-violet-100/90 via-violet-50/40 to-background dark:from-violet-950/30 dark:via-violet-950/10 dark:to-background border-b border-border/30"
          }
        >
          <div className="w-full max-w-[min(100%,72rem)] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-8 sm:pt-10 md:pt-12 pb-10 md:pb-14 text-center space-y-5 sm:space-y-6 md:space-y-8">
            {interactiveKind ? (
              <PresellGateFields
                gateKind={interactiveKind}
                language={uiLang}
                settings={settings}
                onPayload={handleFieldPayload}
              />
            ) : null}

            {heroImage && !hideHeroImageForVslFallback ? (
              <div className="rounded-2xl bg-white/60 dark:bg-card/50 p-4 shadow-sm border border-border/40 mx-auto max-w-2xl">
                <img
                  src={heroImage}
                  alt={primarySeoLabel}
                  className="w-full max-h-[min(420px,55vh)] object-contain mx-auto rounded-lg"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            ) : null}

            <div className="space-y-3 sm:space-y-4 max-w-4xl mx-auto px-1">
              <h1
                className={`text-2xl sm:text-4xl md:text-[2.65rem] font-extrabold leading-[1.12] tracking-tight break-words ${
                  isVslLayout ? "text-white drop-shadow-sm" : "text-foreground"
                }`}
              >
                {title}
              </h1>
              {subtitle ? (
                <p
                  className={`text-base sm:text-lg md:text-xl font-medium leading-snug ${
                    isVslLayout ? "text-slate-200/95" : "text-muted-foreground"
                  }`}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>

            {isVslLayout ? (
              <>
                {showVideo ? (
                  <div className="relative w-full max-w-[min(100%,min(1200px,96vw))] mx-auto aspect-video min-h-[200px] bg-black/40 rounded-lg sm:rounded-xl overflow-hidden shadow-xl border border-white/10 ring-1 ring-white/5">
                    {isEmbedPlayerVideoUrl(videoEmbedSrc) ? (
                      <>
                        <iframe
                          title="Vídeo"
                          src={videoEmbedSrc}
                          className="absolute inset-0 z-0 w-full h-full border-0"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                        <YoutubeCornerClickShield embedSrc={videoEmbedSrc} />
                      </>
                    ) : (
                      <video
                        title="Vídeo"
                        src={videoEmbedSrc}
                        className="absolute inset-0 w-full h-full object-contain bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>
                ) : showVslFallback ? (
                  <div className="w-full max-w-[min(100%,min(1200px,96vw))] mx-auto">
                    <VslProductVideoFallback
                      images={productImages}
                      title={title}
                      subtitle={subtitle}
                      language={uiLang}
                      excerpt={vslExcerpt}
                      variant="vslHero"
                    />
                  </div>
                ) : null}
                <PresellCta href={href} disabled={!ctaEnabled} surface="dark">
                  {ctaText}
                </PresellCta>
              </>
            ) : (
              <>
                <PresellCta href={href} disabled={!ctaEnabled} surface="light">
                  {ctaText}
                </PresellCta>
                {showVideo ? (
                  <div className="relative w-full max-w-3xl mx-auto aspect-video bg-muted rounded-xl overflow-hidden shadow-md border border-border/50 mt-4">
                    {isEmbedPlayerVideoUrl(videoEmbedSrc) ? (
                      <>
                        <iframe
                          title="Vídeo"
                          src={videoEmbedSrc}
                          className="absolute inset-0 z-0 h-full w-full border-0"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                        <YoutubeCornerClickShield embedSrc={videoEmbedSrc} />
                      </>
                    ) : (
                      <video
                        title="Vídeo"
                        src={videoEmbedSrc}
                        className="absolute inset-0 h-full w-full object-contain bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : null}

      {galleryImages.length > 0 && !showVslFallback && !storefrontLayout && !useImportedPageMirror ? (
        <section className="max-w-5xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {galleryImages.map((src, i) => (
              <div
                key={`${i}-${src.slice(0, 40)}`}
                className="rounded-xl overflow-hidden border border-border/50 bg-muted/30 shadow-sm"
              >
                <img
                  src={src}
                  alt={`${primarySeoLabel} — ${i + 2}`}
                  className="w-full object-cover max-h-80"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showSalesLetterSection && !useImportedPageMirror ? (
        <section
          id={storefrontMirrorLightBody ? "presell-story" : undefined}
          className={cn(
            "mx-auto py-8 md:py-12",
            storefrontMirrorLightBody
              ? "max-w-none bg-white text-slate-900 border-t border-slate-200/90 scroll-mt-14"
              : "max-w-3xl px-4",
          )}
        >
          <div
            className={cn(
              "shadow-sm",
              storefrontMirrorLightBody
                ? "max-w-3xl mx-auto px-4 md:px-6 py-2 md:py-4 [&_h3]:text-slate-900 [&_h3]:border-slate-200/70 [&_p]:text-slate-800 [&_li]:text-slate-800"
                : "rounded-2xl border border-border/40 bg-card/30 px-4 py-8 md:px-10 md:py-10",
            )}
          >
            <SalesBlocks
              blocks={textBlocks}
              midInsert={
                <div
                  className={cn(
                    "my-6 sm:my-8 rounded-2xl border p-6 sm:p-8 shadow-inner",
                    storefrontMirrorLightBody
                      ? "border-slate-200/90 bg-slate-50/90"
                      : "border-border/50 bg-gradient-to-b from-muted/50 via-card/80 to-muted/30",
                  )}
                >
                  <div className="flex flex-col items-center gap-4 sm:gap-5 max-w-lg mx-auto text-center">
                    <p
                      className={cn(
                        "text-sm sm:text-base font-medium leading-relaxed px-1",
                        storefrontMirrorLightBody ? "text-slate-800" : "text-foreground/85",
                      )}
                    >
                      {getPresellUiStrings(uiLang).midCta}
                    </p>
                    <PresellCta
                      href={href}
                      disabled={!ctaEnabled}
                      surface={storefrontLayout ? "commerce" : "light"}
                    >
                      {ctaText}
                    </PresellCta>
                  </div>
                </div>
              }
            />
          </div>
        </section>
      ) : null}

      <section
        id={storefrontMirrorLightBody && !showSalesLetterSection ? "presell-story" : undefined}
        className={cn(
          "max-w-3xl mx-auto px-3 sm:px-4 pb-12 sm:pb-16 pt-6 sm:pt-8",
          storefrontMirrorLightBody && "bg-slate-50/80 scroll-mt-14",
        )}
      >
        <div
          className={cn(
            "rounded-2xl border px-4 py-8 sm:px-8 sm:py-10 text-center space-y-5 shadow-sm",
            storefrontMirrorLightBody
              ? "border-slate-200/80 bg-white text-slate-900"
              : "border-border/40 bg-card/40 backdrop-blur-[2px]",
          )}
        >
          <PresellCta
            href={href}
            disabled={!ctaEnabled}
            surface={storefrontLayout ? "commerce" : "light"}
          >
            {ctaText}
          </PresellCta>
          <p
            className={cn(
              "text-xs sm:text-sm max-w-md mx-auto leading-relaxed",
              storefrontMirrorLightBody ? "text-slate-600" : "text-muted-foreground",
            )}
          >
            {getPresellUiStrings(uiLang).footerNote}
          </p>
          {page.footer_branding ? (
            <p
              className={cn(
                "text-[11px] pt-3 border-t max-w-md mx-auto",
                storefrontMirrorLightBody
                  ? "text-slate-500 border-slate-200/80"
                  : "text-muted-foreground/75 border-border/30",
              )}
              dir={isRtlLocale(uiLang) ? "rtl" : "ltr"}
            >
              {getPresellUiStrings(uiLang).footerBrandingPrefix}
              <a
                href="https://www.dclickora.com"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "font-medium underline underline-offset-2 hover:text-primary",
                  storefrontMirrorLightBody ? "text-slate-800" : "text-foreground/80",
                )}
              >
                dclickora
              </a>
              {getPresellUiStrings(uiLang).footerBrandingSuffix}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );

  return (
    <div
      className={cn(
        "min-h-screen w-full max-w-[100vw] overflow-x-hidden pb-12",
        useImportedPageMirror || storefrontMirrorLightBody ? "bg-white" : "bg-background",
      )}
    >
      <PresellMarketingOverlays
        pageId={page.id}
        settings={settings}
        trackHref={href}
        language={uiLang}
      />
      <PresellLanguageSelector override={override} onModeChange={setMode} />
      {/* Montagem de scripts “início do corpo” (pixels, scripts de terceiros, etc.) */}
      <div
        ref={bodyCodeMountRef}
        className="sr-only pointer-events-none absolute h-0 w-0 overflow-hidden"
        aria-hidden
        data-presell-inject="body-start"
      />
      {isDiscount ? (
        <DiscountPresellOverlay
          language={uiLang}
          headline={discountHeadline}
          socialProof={socialProofLine.trim() ? socialProofLine : discountSocialFallback(uiLang)}
          ratingValue={ratingValue}
          ratingStars={ratingStars}
          initialTimerSeconds={urgencyTimerSeconds}
          ctaText={ctaText}
          href={href}
        >
          {pageBody}
        </DiscountPresellOverlay>
      ) : (
        pageBody
      )}
    </div>
  );
}
