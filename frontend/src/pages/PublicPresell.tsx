import {
  lazy,
  Suspense,
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
  mergeParamsIntoAffiliateUrl,
  PresellGateFields,
  useCookieAcceptedState,
  isCookieRedirectToOfferEnabled,
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
  isMirrorChromePresellType,
  isReviewPresellType,
  isVideoPresellType,
  isVslOnlyPresellType,
} from "@/lib/presellTypeMeta";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { bakePublicOfferHrefs, resolvePresellPageDocument } from "@/lib/presellVisualEdit";
import { policyUrlsFromPresellContent, resolvePresellFooterPolicies } from "@/lib/presellFooterPolicies";
import { PresellPublicLocaleProvider } from "@/lib/presellPublicLocale";
const PublicBuilderPresellView = lazy(() =>
  import("@/components/presell/PublicBuilderPresellView").then((m) => ({
    default: m.PublicBuilderPresellView,
  })),
);
import { getTrackApiBaseUrl, resolveApiUrl } from "@/lib/apiOrigin";
import { buildClickoraEmbedScriptHtml, stripClickoraEmbedScripts } from "@/lib/clickoraEmbedScript";
import { isRealNetworkClickId } from "@/lib/networkClickId";
import {
  getPublicPresellPrefetchResult,
  startPublicPresellPrefetchForParam,
} from "@/lib/publicPresellEarlyPrefetch";
import { isPresellUuidParam } from "@/lib/publicPresellOrigin";
import { DiscountPresellOverlay } from "@/components/presell/DiscountPresellOverlay";
import { PresellCta } from "@/components/presell/PresellCta";
import { VslProductVideoFallback } from "@/components/presell/VslProductVideoFallback";
import { coerceTrackingSnippetToHtml, injectWithCleanup } from "@/lib/injectPresellCustomCode";
import { buildPresellOptionalSettingsMarketing } from "@/lib/presellOptionalSettingsMarketing";
import { PresellMarketingOverlays } from "@/components/presell/PresellMarketingOverlays";
import { isYoutubeUrl, resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";
import { applyPublicPresellHeadMetadata } from "@/lib/publicPresellSeo";
import { getPresellSeoPrimaryTitle } from "@/lib/publicPresellDocumentTitle";
import { usePresellUiLanguage } from "@/lib/presellUiLanguage";
import { PresellLanguageSelector } from "@/components/presell/PresellLanguageSelector";
import { ImportedPageMirrorIframe } from "@/components/presell/ImportedPageMirrorIframe";
import { MirrorTypeChrome } from "@/components/presell/MirrorTypeChrome";
import {
  darkStorefrontNavLabels,
  getPresellUiStrings,
  htmlLangForLocale,
  isRtlLocale,
} from "@/lib/presellUiStrings";
import { buildMirrorSrcDocWithTrackHref } from "@/lib/presellMirrorMarkers";
import { bakeHtmlOfferHrefs } from "@/lib/presellOfferHrefBake";
import { preserveNavHashCtaAppearance } from "@/lib/presellMirrorPreserveNav";
import { cn } from "@/lib/utils";
import { PresellProductHero, PresellSecondaryImage } from "@/components/presell/PresellProductHero";
import { rankPresellProductImages } from "@/lib/presellProductImagesRank";
import { looksLikeVariantCode, presellHeadline } from "@/lib/presellDisplayName";
import { stripStockSocialClaim } from "@/lib/presellSocialClaim";
import { plainTextFromMaybeHtml } from "@/lib/plainTextFromMaybeHtml";
import { usePresellHeroImageWithFallback } from "@/lib/presellHeroImageFallback";
import { PresellTrustFooter } from "@/components/presell/PresellTrustFooter";
import { presellComplianceLanguage } from "@/lib/presellPublicComplianceCopy";
import { PresellTypeFrame } from "@/components/presell/PresellTypeFrame";
import { PresellHealthArticle } from "@/components/presell/PresellHealthArticle";
import { resolveHealthArticle } from "@/lib/presellHealthArticle";
import { getPresellTypeTheme } from "@/lib/presellTypeTheme";

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
  /** Descarta macros literais `{gclid}` / `{keyword}` copiadas do template Ads. */
  const adParam = (key: string) => {
    const v = queryParam(search, key);
    return v && isRealNetworkClickId(v) ? v : "";
  };
  const utmParam = (key: string) => {
    const v = queryParam(search, key);
    if (!v || /^\{[\w.]+\}$/.test(v) || /^\{\{/.test(v)) return "";
    return v;
  };
  const gclid = adParam("gclid");
  const fbclid = adParam("fbclid");
  const ttclid = adParam("ttclid");
  const msclkid = adParam("msclkid");
  const gbraid = adParam("gbraid");
  const wbraid = adParam("wbraid");
  const utmTerm = utmParam("utm_term");
  const utmContent = utmParam("utm_content");
  const utmSourceExplicit = utmParam("utm_source");
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
  /** Clique do rotador A/B (gravado na URL da lander) → atribuição por braço no abStats. */
  const parentClick =
    queryParam(search, "clickora_click_id") || queryParam(search, "parent_click_id");
  if (parentClick && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parentClick)) {
    clickUrl.searchParams.set("parent_click_id", parentClick);
  }
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
  try {
    const ck = typeof document !== "undefined" ? document.cookie || "" : "";
    const fbp = ck.match(/(?:^|;)\s*_fbp=([^;]+)/);
    if (fbp?.[1]) params.set("fbp", decodeURIComponent(fbp[1].trim()));
    const ttp = ck.match(/(?:^|;)\s*_ttp=([^;]+)/);
    if (ttp?.[1]) params.set("ttp", decodeURIComponent(ttp[1].trim()));
  } catch {
    /* ignore */
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

/** Linha curta em maiúsculas (título de secção importado), sem inventar texto. */
function isShoutHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 12 || t.length > 90) return false;
  if (/[.!?]$/.test(t)) return false;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-ZÀ-Ý]/g, "");
  return upper.length / letters.length >= 0.85;
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
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.some(isShoutHeading)) {
    return (
      <div className="space-y-3">
        {lines.map((line, i) =>
          isShoutHeading(line) ? (
            <h3
              key={i}
              className="text-xl md:text-2xl font-bold tracking-tight text-foreground pt-2"
            >
              {line}
            </h3>
          ) : (
            <p key={i} className="text-base md:text-lg leading-[1.7] text-foreground/90">
              {line}
            </p>
          ),
        )}
      </div>
    );
  }
  return <p className="text-base md:text-lg leading-[1.7] text-foreground/90 whitespace-pre-line">{t}</p>;
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

/** Hero opcional acima do espelho — desligado por defeito (fidelidade 1:1 à página clonada). Activar só com content.mirrorShowSpotlight === true. */
function ImportedMirrorProductSpotlight({
  productImages,
  storefrontMainIdx,
  setStorefrontMainIdx,
  primarySeoLabel,
  productNameLabel,
  title,
  subtitle,
  showStorefrontRating,
  ratingValue,
  ratingStars,
  useDarkTheme,
  useTintedTheme,
  href,
  ctaEnabled,
  ctaText,
  language,
}: {
  productImages: string[];
  storefrontMainIdx: number;
  setStorefrontMainIdx: (i: number) => void;
  primarySeoLabel: string;
  productNameLabel: string;
  title: string;
  subtitle: string;
  showStorefrontRating: boolean;
  ratingValue: string;
  ratingStars: number;
  useDarkTheme: boolean;
  useTintedTheme: boolean;
  href: string;
  ctaEnabled: boolean;
  ctaText: string;
  language: string;
}) {
  const { src: mainSrc, onError: heroImgOnError, effectiveIndex } = usePresellHeroImageWithFallback(
    productImages,
    storefrontMainIdx,
  );
  const midCta = getPresellUiStrings(language).midCta;

  const imageBlock = (
    <div className="space-y-4 md:sticky md:top-6">
      <div
        className={cn(
          "rounded-2xl p-4 sm:p-5 shadow-lg",
          useDarkTheme && "border border-amber-500/35 bg-black/35 shadow-[0_0_56px_-8px_rgba(251,191,36,0.22)]",
          useTintedTheme &&
            "border border-white/50 bg-white/30 shadow-[0_16px_48px_-12px_rgba(91,33,182,0.28)] backdrop-blur-[2px]",
          !useDarkTheme &&
            !useTintedTheme &&
            "border border-slate-200/90 bg-white shadow-md dark:border-border/60 dark:bg-card",
        )}
      >
        <PresellProductHero
          src={mainSrc}
          alt={primarySeoLabel}
          onError={heroImgOnError}
          emphasis="primary"
          tone={useDarkTheme ? "dark" : useTintedTheme ? "tint" : "light"}
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
                "shrink-0 snap-start rounded-lg border-2 overflow-hidden transition-shadow focus-visible:outline-none focus-visible:ring-2",
                useDarkTheme && "focus-visible:ring-amber-400/90",
                useTintedTheme && "focus-visible:ring-white/90",
                !useDarkTheme && !useTintedTheme && "focus-visible:ring-orange-500/80",
                useDarkTheme &&
                  (i === effectiveIndex
                    ? "border-amber-400 ring-2 ring-amber-400/40 shadow-md"
                    : "border-white/20 opacity-90 hover:opacity-100"),
                useTintedTheme &&
                  (i === effectiveIndex
                    ? "border-white ring-2 ring-white/55 shadow-md"
                    : "border-white/45 opacity-95 hover:opacity-100"),
                !useDarkTheme &&
                  !useTintedTheme &&
                  (i === effectiveIndex
                    ? "border-orange-500 ring-2 ring-orange-500/35 shadow-sm"
                    : "border-border/60 opacity-90 hover:opacity-100"),
              )}
              aria-label={`Imagem ${i + 1}`}
            >
              <PresellSecondaryImage src={src} alt="" className="h-20 w-20 sm:h-24 sm:w-24 object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const copyBlock = (
    <div className="text-left space-y-4 lg:space-y-5 pt-1 md:pt-2">
      {productNameLabel ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            useDarkTheme && "text-amber-500/95",
            useTintedTheme && "text-white/95 drop-shadow-sm",
            !useDarkTheme && !useTintedTheme && "text-muted-foreground",
          )}
        >
          {productNameLabel}
        </p>
      ) : null}
      <h1
        className={cn(
          "text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold leading-tight break-words tracking-tight",
          useDarkTheme && "font-sans uppercase text-white",
          useTintedTheme &&
            "font-sans font-bold text-white leading-[1.15] drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
          !useDarkTheme && !useTintedTheme && "font-serif font-bold text-foreground",
        )}
      >
        {title}
      </h1>
      {showStorefrontRating ? (
        <StorefrontRatingRow
          value={ratingValue}
          stars={ratingStars}
          variant={useDarkTheme ? "darkHero" : useTintedTheme ? "tintHero" : "default"}
        />
      ) : null}
      {subtitle ? (
        useDarkTheme ? (
          <StorefrontDarkSubtitle subtitle={subtitle} />
        ) : useTintedTheme ? (
          <StorefrontTintSubtitle subtitle={subtitle} />
        ) : (
          <p className="text-base text-muted-foreground leading-relaxed">{subtitle}</p>
        )
      ) : null}
      <div className="pt-1">
        <PresellCta
          href={href}
          disabled={!ctaEnabled}
          stretch
          surface={
            useDarkTheme ? "dark" : useTintedTheme ? "tintHero" : "commerce"
          }
        >
          {ctaText}
        </PresellCta>
      </div>
      <p
        className={cn(
          "text-xs leading-relaxed border-t pt-4",
          useDarkTheme && "text-slate-500 border-white/10",
          useTintedTheme && "text-violet-950/75 border-violet-400/35",
          !useDarkTheme && !useTintedTheme && "text-muted-foreground border-border/50",
        )}
      >
        {midCta}
      </p>
    </div>
  );

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b",
        useDarkTheme && "border-amber-900/30",
        useTintedTheme && "border-violet-400/25",
        !useDarkTheme && !useTintedTheme && "border-border/40 bg-muted/25",
      )}
      style={
        useDarkTheme
          ? {
              backgroundColor: "#070b14",
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.022) 2px, rgba(255,255,255,0.022) 4px)`,
            }
          : useTintedTheme
            ? {
                background:
                  "linear-gradient(155deg, #a78bfa 0%, #c4b5fd 18%, #ddd6fe 48%, #ede9fe 78%, #f5f3ff 100%)",
              }
            : undefined
      }
    >
      {useTintedTheme ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_75%_at_15%_10%,rgba(255,255,255,0.38),transparent_58%)]" />
      ) : null}
      <div className="relative w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 md:pb-12">
        <div className="grid md:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] gap-8 lg:gap-10 items-start">
          {imageBlock}
          {copyBlock}
        </div>
      </div>
    </section>
  );
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
    /** Após editar/publicar, remount da mesma /p/… tem de ir à API — não servir cache stale. */
    staleTime: 0,
    refetchOnMount: "always",
    /** Railway a acordar: 502/timeout no 1.º pedido — repetir antes de mostrar erro. */
    retry: 3,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
  });

  useEffect(() => {
    if (!page) return;
    return applyPublicPresellHeadMetadata(page);
  }, [page]);

  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const apiBase = useMemo(() => getTrackApiBaseUrl(), []);

  const { cookieAccepted, setCookieAccepted } = useCookieAcceptedState();
  const [fieldGate, setFieldGate] = useState<GatePayload>({ params: {}, ctaEnabled: false });

  const { resolved: uiLang, setMode, override } = usePresellUiLanguage(page?.id, page?.language);

  useEffect(() => {
    document.documentElement.lang = htmlLangForLocale(uiLang);
    document.documentElement.dir = isRtlLocale(uiLang) ? "rtl" : "ltr";
  }, [uiLang]);

  useEffect(() => {
    setCookieAccepted(false);
    // Gates interativos começam bloqueados até PresellGateFields reportar válido.
    setFieldGate({ params: {}, ctaEnabled: !getInteractiveGateKind(page?.type || "") });
  }, [page?.id, page?.type, setCookieAccepted]);

  const [storefrontMainIdx, setStorefrontMainIdx] = useState(0);
  useEffect(() => {
    setStorefrontMainIdx(0);
  }, [page?.id]);

  const handleFieldPayload = useCallback((p: GatePayload) => {
    setFieldGate(p);
  }, []);

  /** Pixel o mais cedo possível (layout) — impressão Ads antes de paint pesado. */
  useLayoutEffect(() => {
    if (!page?.id || page.cloak_safe === true) return;
    const pixel = new Image();
    pixel.decoding = "async";
    pixel.src = buildImpressionPixelUrl(apiBase, page.id, search);
    // Uma visita = uma impressão; mudanças de query na mesma página não recontam.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só page.id
  }, [page?.id, page?.cloak_safe, apiBase]);

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
    if (!page?.id || page.cloak_safe === true) return;
    const s = (page.settings || {}) as Record<string, unknown>;
    const conversionTrackingScript = coerceTrackingSnippetToHtml(
      String(s.conversionTrackingScript ?? ""),
    );
    /** Remove clickora duplicado/localhost do head guardado — injectamos o canónico abaixo. */
    const headerCode = coerceTrackingSnippetToHtml(stripClickoraEmbedScripts(String(s.headerCode ?? "")));
    const bodyCode = coerceTrackingSnippetToHtml(String(s.bodyCode ?? ""));
    const footerCode = coerceTrackingSnippetToHtml(String(s.footerCode ?? ""));
    const customCss = String(s.customCss ?? "").trim();
    const optionalMarketing = buildPresellOptionalSettingsMarketing(s);
    const clickoraHead = buildClickoraEmbedScriptHtml({
      apiBase,
      presellId: page.id,
    });

    const cleanups: (() => void)[] = [];

    if (customCss) {
      const style = document.createElement("style");
      style.setAttribute("data-presell-custom-css", page.id);
      style.textContent = customCss;
      document.head.appendChild(style);
      cleanups.push(() => style.remove());
    }
    /** Sempre no &lt;head&gt;, async + data-presell-id — pageview Ads fiável e sem bloquear LCP. */
    if (clickoraHead) cleanups.push(injectWithCleanup(clickoraHead, document.head));
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
  }, [page?.id, page?.cloak_safe, settingsInjectKey, apiBase]);

  const content = (page?.content || {}) as Record<string, unknown>;
  const tracking = (page?.tracking || {}) as Record<string, unknown>;
  /** Hoplink: content.affiliateLink; fallback tracking.offerUrl (wizard antigo). */
  const affiliateLinkRaw =
    (typeof content.affiliateLink === "string" && content.affiliateLink.trim()) ||
    (typeof tracking.offerUrl === "string" && tracking.offerUrl.trim()) ||
    "";
  const affiliateLink = affiliateLinkRaw || "#";
  const settings = (page?.settings || {}) as Record<string, unknown>;

  const productImages = rankPresellProductImages(
    Array.isArray(content.productImages)
      ? (content.productImages as string[]).filter((u) => typeof u === "string" && u.length > 0)
      : [],
  );
  const heroImageFallback = usePresellHeroImageWithFallback(productImages, storefrontMainIdx);

  const showCookieModal = getPresellGateKind(page?.type || "") === "cookies" && !cookieAccepted;

  useEffect(() => {
    // Tipo cookies: o CookieBannerWidget (documento) gere o overflow.
    // CookieConsentModal quase nunca monta neste path — este lock deixava scroll preso após Allow.
    if (getPresellGateKind(page?.type || "") === "cookies") return;
    if (showCookieModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showCookieModal, page?.type]);

  const ctaEnabled = useMemo(() => {
    const gk = getPresellGateKind(page?.type || "");
    const ik = getInteractiveGateKind(page?.type || "");
    // Cookies: o modal só desbloqueia a leitura (black) ou leva à oferta (white).
    // CTAs do documento: cookies não bloqueiam; gates interativos sim até estarem válidos.
    if (gk === "cookies") return true;
    if (ik) return fieldGate.ctaEnabled;
    return true;
  }, [page?.type, fieldGate.ctaEnabled]);

  const href = useMemo(() => {
    if (!page?.id) return "";
    let dest = affiliateLink.trim();
    if (!dest || dest === "#" || !/^https?:\/\//i.test(dest)) return "";
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
    const withTrack = buildMirrorSrcDocWithTrackHref(importMirrorSrcDocRaw, href);
    const baked = bakeHtmlOfferHrefs(withTrack, href, affiliateLink.trim());
    return preserveNavHashCtaAppearance(baked);
  }, [importMirrorSrcDocRaw, href, affiliateLink]);

  const [mirrorUseTemplateFallback, setMirrorUseTemplateFallback] = useState(false);
  useEffect(() => {
    setMirrorUseTemplateFallback(false);
  }, [page?.id, mirrorSrcDoc]);

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
    window.addEventListener("pointerdown", go);
    window.addEventListener("click", go);
    window.addEventListener("keydown", go);
    window.addEventListener("mousemove", go, opts);
    window.addEventListener("touchstart", go, opts);
    window.addEventListener("touchmove", go, opts);
    window.addEventListener("scroll", go, opts);
    window.addEventListener("wheel", go, opts);
    window.addEventListener("pointermove", go, opts);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("click", go);
      window.removeEventListener("keydown", go);
      window.removeEventListener("mousemove", go);
      window.removeEventListener("touchstart", go);
      window.removeEventListener("touchmove", go);
      window.removeEventListener("scroll", go);
      window.removeEventListener("wheel", go);
      window.removeEventListener("pointermove", go);
    };
  }, [page?.id, page?.type, href]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background flex flex-col items-center justify-center gap-3"
        aria-busy="true"
        aria-label="A carregar página"
      >
        <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">A abrir a página…</p>
      </div>
    );
  }
  if (isError || !page) {
    const raw =
      loadError instanceof Error ? loadError.message : "Página indisponível.";
    let msg = raw;
    if (/Failed to fetch|NetworkError|load failed/i.test(raw)) {
      msg = "Não foi possível carregar a página. Verifique a ligação e tente de novo.";
    } else if (
      raw.trim() === "Página não encontrada" ||
      /^Página não encontrada\.?$/i.test(raw.trim())
    ) {
      msg = "Esta página não está disponível.";
      if (id && !isPresellUuidParam(id)) {
        msg =
          "Em dclickora.com o link público usa /p/<UUID>. O slug só funciona no teu domínio personalizado verificado.";
      }
    } else if (/domínio personalizado|PRESHELL_SLUG|identificador \(UUID\)/i.test(raw)) {
      msg =
        "Em dclickora.com o link público usa /p/<UUID>. O slug só funciona no teu domínio personalizado verificado.";
    }
    const isNotFound =
      raw.trim() === "Página não encontrada" ||
      /^Página não encontrada\.?$/i.test(raw.trim()) ||
      msg === "Esta página não está disponível.";
    return <ErrorState message={msg} onRetry={isNotFound ? undefined : () => refetch()} />;
  }

  if (page.cloak_safe === true) {
    const safeContent = (page.content || {}) as Record<string, unknown>;
    const safeTitle =
      (typeof safeContent.title === "string" && safeContent.title.trim()) ||
      page.title ||
      "Informação";
    const safeBody =
      (typeof safeContent.salesText === "string" && safeContent.salesText.trim()) ||
      "Conteúdo informativo.";
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{safeTitle}</h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">{safeBody}</p>
        </main>
      </div>
    );
  }

  const gateKind = getPresellGateKind(page.type);
  const interactiveKind = getInteractiveGateKind(page.type);
  const isReviewPage = isReviewPresellType(page.type);

  const titleRaw = plainTextFromMaybeHtml((content.title as string) || page.title);
  const subtitleRaw = plainTextFromMaybeHtml((content.subtitle as string) || "");
  const salesTextRaw = (content.salesText as string) || "";
  const productLabelEarly = plainTextFromMaybeHtml(
    typeof content.productName === "string" ? content.productName.trim() : "",
  );
  const importedClone =
    importMirrorSrcDocRaw.length > 800 || content.importMode === "mirror";
  const title = presellHeadline({
    importedClone,
    productName: productLabelEarly,
    contentTitle: titleRaw,
    pageTitle: page.title || "",
  });
  const subtitle = importedClone ? "" : subtitleRaw;
  const salesText = importedClone ? "" : salesTextRaw;
  const ctaTextRaw = (content.ctaText as string) || "Visitar o Site Oficial do Fabricante";

  const contentPolicyUrls = policyUrlsFromPresellContent(content as Record<string, unknown>);
  const footerPolicies = resolvePresellFooterPolicies(
    settings as Record<string, unknown>,
    contentPolicyUrls,
  );
  const cookiePolicyUrl = footerPolicies.operator.cookies;
  const footerSettingsProps = {
    settings: settings as Record<string, unknown>,
    contentPolicyUrls,
  };

  const primarySeoLabel = getPresellSeoPrimaryTitle(page);

  const heroImage = productImages[0];
  const galleryImages = productImages.slice(1, 10);

  const showVideo = isVideoPresellType(page.type) && !!page.video_url;
  const showVslFallback = isVideoPresellType(page.type) && !page.video_url;
  const hideHeroImageForVslFallback = showVslFallback;
  const typeTheme = getPresellTypeTheme(page.type);
  const isVslLayout = isVideoPresellType(page.type);

  const isDiscount = isDiscountPresellType(page.type);
  const discountHeadline = (content.discountHeadline as string) || title;
  const socialProofLine = stripStockSocialClaim(
    typeof content.socialProofLine === "string" ? content.socialProofLine : "",
  );
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
  /** Espelho da página de produto: activo em qualquer tipo de presell quando o import guardou HTML (~Playwright). Cookies, desconto, fantasma, formulário interactivo e CTAs aplicam-se em paralelo (ver `pageBody`). */
  const mirrorEligible =
    importMirrorSrcDocRaw.length > 800 && mirrorSrcDoc.length > 800;

  /**
   * O espelho importado mantém-se visível com o aviso de cookies.
   * A folha fica em baixo; fechar não troca a landing pelo modelo React nem sai para a oferta.
   */
  const generationNiche =
    content.generationNiche === "white" || content.generation_niche === "white" ? "white" : "black";
  const hasGenerationNiche =
    content.generationNiche === "black" ||
    content.generationNiche === "white" ||
    content.generation_niche === "black" ||
    content.generation_niche === "white";
  /** Divulgação de afiliado em todas as presells públicas (inclui antigas sem nicho), excepto fantasma. */
  /** Conformidade no idioma da presell (anúncio/criação), não no idioma escolhido pelo visitante. */
  const complianceLang = presellComplianceLanguage(page.language, uiLang);
  /** Só White espelha a sales page. Black (promessas fortes) não clona claims — artigo informativo. */
  const showImportedMirror = mirrorEligible && !isGhostPage && generationNiche === "white";

  const darkNav = darkStorefrontNavLabels(uiLang);
  const productNameRaw = plainTextFromMaybeHtml(
    typeof content.productName === "string"
      ? content.productName.trim()
      : typeof (content as { product_name?: unknown }).product_name === "string"
        ? String((content as { product_name: string }).product_name).trim()
        : "",
  );
  const productNameLabel =
    productNameRaw &&
    !looksLikeVariantCode(productNameRaw) &&
    productNameRaw.toLowerCase() !== title.toLowerCase()
      ? productNameRaw
      : "";
  const healthProductName = productNameRaw || title || "o produto";
  /** Storefront: artigo portal (anti-bridge Ads). Páginas antigas com junk também caem aqui. */
  const healthArticle = resolveHealthArticle({
    content: content as Record<string, unknown>,
    productName: healthProductName,
    language: uiLang || page.language || "pt-BR",
    salesText,
    ctaText: ctaTextRaw,
  });
  const ctaText =
    storefrontLayout && !hasGenerationNiche ? healthArticle.ctaLabel : ctaTextRaw;
  const useHealthArticleBody =
    storefrontLayout && !showImportedMirror && !isVslLayout && !hasGenerationNiche;
  const textBlocks = useHealthArticleBody
    ? []
    : salesText
        .split(/\n\n+/)
        .map((b) => b.trim())
        .filter(Boolean);
  const vslExcerpt = (() => {
    const first = textBlocks[0] || "";
    if (!first) return "";
    return first.length > 300 ? `${first.slice(0, 297)}…` : first;
  })();
  const showSalesLetterSection =
    !useHealthArticleBody && textBlocks.length > 0 && !isVslOnlyPresellType(page.type);
  const ratingFromSource = content.ratingFromSource === true;
  const showStorefrontRating =
    ratingFromSource &&
    !isDiscount &&
    typeof content.ratingStars === "number" &&
    content.ratingStars > 0 &&
    typeof content.ratingValue === "string" &&
    content.ratingValue.trim().length > 0;

  const builderDoc = parsePresellBuilderPageDocument(page.content);
  /** Presell manual: só o editor, salvo quando não há espelho importado para mostrar. */
  if (page.type === "builder" && !showImportedMirror) {
    if (!builderDoc) {
      return (
        <ErrorState
          message="Esta presell manual não tem um documento válido. Edite-a de novo no painel ou contacte o suporte."
          onRetry={() => refetch()}
        />
      );
    }
    const builderCookieRedirect = isCookieRedirectToOfferEnabled(settings);
    const builderHasCookieBanner = builderDoc.sections.some((section) =>
      section.columns.some((column) => column.widgets.some((widget) => widget.type === "cookieBanner")),
    );
    const bakedBuilderDoc = bakePublicOfferHrefs(
      builderDoc,
      href,
      affiliateLink.trim() && affiliateLink.trim() !== "#" ? affiliateLink.trim() : "",
      cookiePolicyUrl,
      {
        unlockCookieOnly: builderHasCookieBanner && !builderCookieRedirect,
        cookieRedirectToOffer: builderHasCookieBanner && builderCookieRedirect,
      },
    );
    return (
      <PresellPublicLocaleProvider language={uiLang}>
      <div className="min-h-screen bg-background pb-12">
        <PresellMarketingOverlays
          pageId={page.id}
          settings={settings}
          trackHref={href}
          language={uiLang}
          suppressWhileCookieGate={builderHasCookieBanner && builderCookieRedirect}
        />
        <div
          ref={bodyCodeMountRef}
          className="sr-only pointer-events-none absolute h-0 w-0 overflow-hidden"
          aria-hidden
          data-presell-inject="body-start"
        />
        <Suspense fallback={null}>
          <PublicBuilderPresellView
            doc={bakedBuilderDoc}
            trackOfferHref={href || undefined}
            offerUrl={
              affiliateLink.trim() && affiliateLink.trim() !== "#"
                ? affiliateLink.trim()
                : undefined
            }
          />
        </Suspense>
        <PresellTrustFooter language={complianceLang} {...footerSettingsProps} />
      </div>
      </PresellPublicLocaleProvider>
    );
  }

  if (!isGhostPage) {
    const cookiesGate = getPresellGateKind(page.type) === "cookies";
    const cookieRedirectToOffer = cookiesGate && isCookieRedirectToOfferEnabled(settings);
    const visualDoc = bakePublicOfferHrefs(
      resolvePresellPageDocument(page.content, {
        title: page.title,
        type: page.type,
        videoUrl: page.video_url,
        language: uiLang || page.language,
        content: content as Record<string, unknown>,
      }),
      href,
      affiliateLink.trim() && affiliateLink.trim() !== "#" ? affiliateLink.trim() : "",
      cookiePolicyUrl,
      {
        unlockCookieOnly: cookiesGate && !cookieRedirectToOffer,
        cookieRedirectToOffer,
      },
    );
    const mirrorHtmlFold =
      visualDoc.sections[0]?.columns[0]?.widgets[0]?.type === "html";
    /** White = página independente completa; chrome/selector PT no topo poluem o espelho EN. */
    const suppressMirrorChrome = generationNiche === "white" || mirrorHtmlFold;
    const offerUrl =
      affiliateLink.trim() && affiliateLink.trim() !== "#" ? affiliateLink.trim() : undefined;
    const inner = (
      <>
        {interactiveKind ? (
          <section className="sticky top-0 z-[35] w-full border-b border-border/60 bg-muted/95 px-3 py-5 sm:px-4 backdrop-blur-md">
            <div className="mx-auto max-w-3xl text-center">
              <PresellGateFields
                gateKind={interactiveKind}
                language={uiLang}
                settings={settings}
                onPayload={handleFieldPayload}
              />
            </div>
          </section>
        ) : null}
        {/* Espelho white já traz header/CTA próprios — chrome PT em cima desalinha e confunde. */}
        {isMirrorChromePresellType(page.type) && !suppressMirrorChrome ? (
          <MirrorTypeChrome
            type={page.type}
            ctaText={ctaText}
            href={href}
            ctaEnabled={ctaEnabled}
            ratingValue={ratingFromSource ? ratingValue : ""}
            ratingStars={ratingFromSource ? ratingStars : 0}
            productLabel={productNameLabel || title}
            videoUrl={showVideo ? page.video_url : null}
            language={uiLang}
            className={isDiscount ? "top-[5.25rem]" : undefined}
          />
        ) : null}
        <Suspense fallback={null}>
          <PublicBuilderPresellView
            doc={visualDoc}
            trackOfferHref={href || undefined}
            offerUrl={offerUrl}
            interactionLocked={Boolean(interactiveKind && !ctaEnabled)}
          />
        </Suspense>
        <PresellTrustFooter
          language={complianceLang}
          {...footerSettingsProps}
          portalMode={generationNiche === "black"}
          businessName={typeof settings.businessName === "string" ? settings.businessName : undefined}
          operatorDocument={
            typeof settings.operatorDocument === "string"
              ? settings.operatorDocument
              : typeof settings.cnpj === "string"
                ? settings.cnpj
                : undefined
          }
          supportEmail={
            typeof settings.supportEmail === "string"
              ? settings.supportEmail
              : typeof settings.contactEmail === "string"
                ? settings.contactEmail
                : undefined
          }
        />
      </>
    );
    return (
      <PresellPublicLocaleProvider language={uiLang}>
        <div
          className={`min-h-screen w-full max-w-[100vw] overflow-x-hidden pb-0 ${
            generationNiche === "black" ? "bg-slate-50" : "bg-white pb-12"
          }`}
        >
          <PresellMarketingOverlays
            pageId={page.id}
            settings={settings}
            trackHref={href}
            language={uiLang}
            suppressWhileCookieGate={gateKind === "cookies"}
          />
          {suppressMirrorChrome ? null : (
            <PresellLanguageSelector override={override} onModeChange={setMode} />
          )}
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
              socialProof={socialProofLine.trim()}
              ratingValue={ratingFromSource ? ratingValue : ""}
              ratingStars={ratingFromSource ? ratingStars : 0}
              initialTimerSeconds={urgencyTimerSeconds === 649 ? 0 : urgencyTimerSeconds}
              ctaText={ctaText}
              href={href}
            >
              {inner}
            </DiscountPresellOverlay>
          ) : (
            inner
          )}
        </div>
      </PresellPublicLocaleProvider>
    );
  }

  const sourceUrlRaw = typeof content.sourceUrl === "string" ? content.sourceUrl.trim() : "";
  const cookieConsentFallbackHref =
    affiliateLink.trim() && affiliateLink.trim() !== "#"
      ? affiliateLink.trim()
      : sourceUrlRaw;

  const pageBody = (
    <>
      {gateKind === "cookies" && showCookieModal ? (
        <CookieConsentModal
          language={complianceLang}
          policyUrl={cookiePolicyUrl}
          redirectHref={href}
          fallbackHref={cookieConsentFallbackHref}
          accepted={cookieAccepted}
          onAccept={() => setCookieAccepted(true)}
          navigateOnAccept={isCookieRedirectToOfferEnabled(settings)}
        />
      ) : null}

      {showImportedMirror && isMirrorChromePresellType(page.type) ? (
        <MirrorTypeChrome
          type={page.type}
          ctaText={ctaText}
          href={href}
          ctaEnabled={ctaEnabled}
          ratingValue={ratingValue}
          ratingStars={ratingStars}
          productLabel={productNameLabel || title}
          videoUrl={showVideo ? page.video_url : null}
          language={uiLang}
          className={isDiscount ? "top-[5.25rem]" : undefined}
        />
      ) : null}

      {showImportedMirror && interactiveKind ? (
        <section
          className={cn(
            "sticky z-[35] w-full border-b border-border/60 bg-muted/95 px-3 py-5 sm:px-4 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.05)]",
            isDiscount && isMirrorChromePresellType(page.type)
              ? "top-[9.5rem]"
              : isDiscount || isMirrorChromePresellType(page.type)
                ? "top-[5.25rem]"
                : "top-0",
            isVslLayout &&
              "border-white/10 bg-slate-900/95 text-slate-100 shadow-[0_1px_0_rgba(255,255,255,0.06)] [&_label]:text-slate-100 [&_p]:text-slate-200",
          )}
        >
          <div className="max-w-3xl mx-auto text-center [&_.space-y-2]:text-left sm:[&_.space-y-2]:text-left">
            <PresellGateFields
              gateKind={interactiveKind}
              language={uiLang}
              settings={settings}
              onPayload={handleFieldPayload}
            />
          </div>
        </section>
      ) : null}

      {/**
       * Espelho 1:1 — a landing clonada é a UI completa.
       * Gates (idade/sexo/…) ficam sticky acima; VSL/hero React NÃO se injectam por cima.
       */}
      {showImportedMirror ? (
        <ImportedPageMirrorIframe
          srcDoc={mirrorSrcDoc}
          title={primarySeoLabel}
          onMirrorProbablyEmpty={() => setMirrorUseTemplateFallback(true)}
          interactionLocked={Boolean(interactiveKind && !ctaEnabled)}
          offerHref={href}
          affiliateHref={affiliateLink.trim()}
        />
      ) : null}


      {!showImportedMirror && storefrontLayout ? (
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

                <div className="grid md:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] gap-8 lg:gap-10 items-start">
                  <div className="space-y-4 md:sticky md:top-6">
                    <div className="rounded-2xl border border-amber-500/25 bg-black/25 shadow-[0_0_48px_-12px_rgba(251,191,36,0.12)] p-2 sm:p-3">
                      <PresellProductHero
                        src={heroImageFallback.src}
                        onError={heroImageFallback.onError}
                        alt={primarySeoLabel}
                        tone="dark"
                        emphasis="primary"
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
                              i === heroImageFallback.effectiveIndex
                                ? "border-amber-400 ring-2 ring-amber-400/35 shadow-sm"
                                : "border-white/15 opacity-90 hover:opacity-100",
                            )}
                            aria-label={`Imagem ${i + 1}`}
                          >
                            <PresellSecondaryImage
                              src={src}
                              alt=""
                              className="h-20 w-20 sm:h-24 sm:w-24 object-cover"
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

                <div className="grid md:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] gap-8 lg:gap-10 items-start">
                  <div className="space-y-4 md:sticky md:top-6">
                    <div className="rounded-2xl border border-white/55 bg-white/25 shadow-[0_12px_40px_-12px_rgba(91,33,182,0.25)] backdrop-blur-[2px] p-2 sm:p-3">
                      <PresellProductHero
                        src={heroImageFallback.src}
                        onError={heroImageFallback.onError}
                        alt={primarySeoLabel}
                        tone="tint"
                        emphasis="primary"
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
                              i === heroImageFallback.effectiveIndex
                                ? "border-white ring-2 ring-white/50 shadow-md"
                                : "border-white/40 opacity-95 hover:opacity-100",
                            )}
                            aria-label={`Imagem ${i + 1}`}
                          >
                            <PresellSecondaryImage
                              src={src}
                              alt=""
                              className="h-20 w-20 sm:h-24 sm:w-24 object-cover"
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
          <>
            <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1b1e27]">
              <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
                <span className="min-w-0 truncate text-lg font-extrabold uppercase tracking-[0.14em] text-white sm:text-2xl">
                  {title}
                </span>
                <a
                  href={href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-md sm:px-4 sm:text-sm",
                    !ctaEnabled && "pointer-events-none opacity-50",
                  )}
                >
                  {ctaText}
                </a>
              </div>
            </header>
            <section className="relative overflow-hidden bg-gradient-to-br from-[#0a5ea8] via-[#0a3f86] to-[#07264f] text-white">
              <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10">
                {interactiveKind ? (
                  <div className="mb-6 w-full max-w-xl text-center text-white [&_label]:text-white [&_p]:text-white/80">
                    <PresellGateFields
                      gateKind={interactiveKind}
                      language={uiLang}
                      settings={settings}
                      onPayload={handleFieldPayload}
                    />
                  </div>
                ) : null}
                <h1 className="sr-only">{title}</h1>
                <div className="w-full max-w-md">
                  <PresellProductHero
                    src={heroImageFallback.src}
                    onError={heroImageFallback.onError}
                    alt={title || primarySeoLabel}
                    tone="plain"
                    emphasis="showcase"
                  />
                </div>
              </div>
            </section>
          </>
        )
      ) : !showImportedMirror ? (
        <section
          className={cn(
            "relative overflow-hidden border-b border-border/30",
            typeTheme.heroBg,
          )}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent dark:from-white/5" aria-hidden />
          <div className="relative w-full max-w-[min(100%,72rem)] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-8 sm:pt-10 md:pt-12 pb-10 md:pb-14 text-center space-y-5 sm:space-y-6 md:space-y-8">
            <PresellTypeFrame type={page.type} language={uiLang} variant="hero" />

            {interactiveKind ? (
              <PresellGateFields
                gateKind={interactiveKind}
                language={uiLang}
                settings={settings}
                onPayload={handleFieldPayload}
              />
            ) : null}

            {heroImage && !hideHeroImageForVslFallback ? (
              <div className="rounded-2xl bg-white/70 dark:bg-card/50 p-2 sm:p-3 shadow-md border border-border/40 mx-auto w-full max-w-4xl ring-1 ring-black/5">
                <PresellProductHero
                  src={heroImageFallback.src}
                  onError={heroImageFallback.onError}
                  alt={primarySeoLabel}
                  tone="plain"
                  emphasis={showVideo ? "support" : "primary"}
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

      {galleryImages.length > 0 && !showVslFallback && !storefrontLayout && !showImportedMirror ? (
        <section className="max-w-5xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {galleryImages.map((src, i) => (
              <div
                key={`${i}-${src.slice(0, 40)}`}
                className="rounded-xl overflow-hidden border border-border/50 bg-muted/30 shadow-sm"
              >
                <PresellSecondaryImage
                  src={src}
                  alt={`${primarySeoLabel} — ${i + 2}`}
                  className="w-full object-contain max-h-[min(70vh,36rem)] min-h-[12rem] bg-white"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!showImportedMirror && !useHealthArticleBody ? (
        <div className="mx-auto max-w-3xl px-4 pt-6 md:pt-8">
          <PresellTypeFrame type={page.type} language={uiLang} variant="aside" />
        </div>
      ) : null}

      {useHealthArticleBody ? (
        <div className="border-t border-slate-200 bg-white">
          <PresellHealthArticle article={healthArticle} href={href} ctaEnabled={ctaEnabled} />
        </div>
      ) : null}

      {showSalesLetterSection && !showImportedMirror ? (
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

      {!useHealthArticleBody && !(storefrontLayout && !showSalesLetterSection) ? (
        <section
          id={storefrontMirrorLightBody && !showSalesLetterSection ? "presell-story" : undefined}
          className={cn(
            "max-w-3xl mx-auto px-3 sm:px-4 pb-6 sm:pb-8 pt-6 sm:pt-8",
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
          </div>
        </section>
      ) : null}
      <PresellTrustFooter
        language={complianceLang}
        {...footerSettingsProps}
        businessName={
          typeof settings.businessName === "string" ? settings.businessName : undefined
        }
        portalMode={useHealthArticleBody}
        operatorDocument={
          typeof settings.operatorDocument === "string"
            ? settings.operatorDocument
            : typeof settings.cnpj === "string"
              ? settings.cnpj
              : undefined
        }
        supportEmail={
          typeof settings.supportEmail === "string"
            ? settings.supportEmail
            : typeof settings.contactEmail === "string"
              ? settings.contactEmail
              : undefined
        }
        tone={useDarkMirrorStorefront ? "dark" : useHealthArticleBody ? "portal" : "light"}
      />
    </>
  );

  return (
    <div
      className={cn(
        "min-h-screen w-full max-w-[100vw] overflow-x-hidden pb-12",
        showImportedMirror || storefrontMirrorLightBody ? "bg-white" : "bg-background",
      )}
    >
      <PresellMarketingOverlays
        pageId={page.id}
        settings={settings}
        trackHref={href}
        language={uiLang}
        suppressWhileCookieGate={showCookieModal}
      />
      {!useHealthArticleBody ? (
        <PresellLanguageSelector override={override} onModeChange={setMode} />
      ) : null}
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
          socialProof={socialProofLine.trim()}
          ratingValue={ratingFromSource ? ratingValue : ""}
          ratingStars={ratingFromSource ? ratingStars : 0}
          initialTimerSeconds={urgencyTimerSeconds === 649 ? 0 : urgencyTimerSeconds}
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
