import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { presellService } from "@/services/presellService";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import {
  CookieConsentModal,
  CookieSettingsChip,
  PresellGateFields,
  useCookieAcceptedState,
  type GatePayload,
} from "@/components/presell/PresellTypeControls";
import {
  getInteractiveGateKind,
  getPresellGateKind,
  isDiscountPresellType,
  isGhostPresellType,
  isVideoPresellType,
  isVslOnlyPresellType,
} from "@/lib/presellTypeMeta";
import { getApiBaseUrl, resolveApiUrl } from "@/lib/apiOrigin";
import {
  DiscountPresellOverlay,
  discountSocialFallback,
} from "@/components/presell/DiscountPresellOverlay";
import { PresellCta } from "@/components/presell/PresellCta";
import { VslProductVideoFallback } from "@/components/presell/VslProductVideoFallback";
import { injectWithCleanup } from "@/lib/injectPresellCustomCode";
import { isYoutubeUrl, resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";

function queryParam(search: URLSearchParams, key: string) {
  return search.get(key) || undefined;
}

/** O destino final é sempre o link guardado na presell (sem acrescentar parâmetros ao URL do afiliado). */
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
  return clickUrl.toString();
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
  return <p className="text-base md:text-[1.05rem] leading-[1.75] text-foreground/90 whitespace-pre-line">{t}</p>;
}

function langNorm(language: string) {
  const raw = (language || "pt").toLowerCase();
  if (raw === "us" || raw.startsWith("en")) return "en";
  return raw;
}

function copyMidCta(language: string) {
  const lang = langNorm(language);
  if (lang === "en") return "Continue to the official page for current pricing and secure checkout.";
  if (lang === "es") return "Continúa en la página oficial para precios y pago seguro.";
  return "Continue na página oficial para preços atualizados e checkout seguro.";
}

function copyFooter(language: string) {
  const lang = langNorm(language);
  if (lang === "en") return "You will be taken to the product link with affiliate tracking.";
  if (lang === "es") return "Serás enviado al enlace del producto con seguimiento de afiliado.";
  return "Ao clicar, você será direcionado ao link do produto com rastreamento do afiliado.";
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

export default function PublicPresell() {
  const { id = "" } = useParams();
  const { data: page, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ["public-presell", id],
    queryFn: async () => {
      const { data, error } = await presellService.getPublicById(id);
      if (error || !data) throw new Error(error || "Página não encontrada");
      return data;
    },
    enabled: !!id,
  });

  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const { cookieAccepted, setCookieAccepted } = useCookieAcceptedState();
  const [cookieDismissed, setCookieDismissed] = useState(false);
  const [fieldGate, setFieldGate] = useState<GatePayload>({ params: {}, ctaEnabled: true });

  useEffect(() => {
    setCookieAccepted(false);
    setCookieDismissed(false);
    setFieldGate({ params: {}, ctaEnabled: true });
  }, [page?.id, setCookieAccepted]);

  const handleFieldPayload = useCallback((p: GatePayload) => {
    setFieldGate(p);
  }, []);

  useEffect(() => {
    if (!page?.id) return;
    const pixel = new Image();
    const referrer = encodeURIComponent(document.referrer || "");
    pixel.src = `${apiBase}/track/pixel/${page.id}.gif?referrer=${referrer}`;
  }, [page?.id, apiBase]);

  const bodyCodeMountRef = useRef<HTMLDivElement>(null);
  const settingsInjectKey = useMemo(() => {
    if (!page?.settings) return "";
    const s = page.settings as Record<string, unknown>;
    return JSON.stringify({
      h: s.headerCode ?? "",
      b: s.bodyCode ?? "",
      f: s.footerCode ?? "",
      c: s.customCss ?? "",
    });
  }, [page?.settings]);

  // Re-run when serialized custom code changes (settingsInjectKey), not when page.settings object identity changes.
  useLayoutEffect(() => {
    if (!page?.id) return;
    const s = (page.settings || {}) as Record<string, unknown>;
    const headerCode = String(s.headerCode ?? "").trim();
    const bodyCode = String(s.bodyCode ?? "").trim();
    const footerCode = String(s.footerCode ?? "").trim();
    const customCss = String(s.customCss ?? "").trim();

    const cleanups: (() => void)[] = [];

    if (customCss) {
      const style = document.createElement("style");
      style.setAttribute("data-presell-custom-css", page.id);
      style.textContent = customCss;
      document.head.appendChild(style);
      cleanups.push(() => style.remove());
    }
    if (headerCode) cleanups.push(injectWithCleanup(headerCode, document.head));
    if (bodyCode && bodyCodeMountRef.current) {
      cleanups.push(injectWithCleanup(bodyCode, bodyCodeMountRef.current));
    }
    if (footerCode) cleanups.push(injectWithCleanup(footerCode, document.body));

    return () => cleanups.forEach((fn) => fn());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps above: settingsInjectKey covers page.settings fields
  }, [page?.id, settingsInjectKey]);

  const content = (page?.content || {}) as Record<string, unknown>;
  const affiliateLink = (content.affiliateLink as string) || "#";

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
    return makeTrackClickUrl(apiBase, page.id, affiliateLink, search);
  }, [apiBase, page?.id, affiliateLink, search]);

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

  if (isLoading) return <LoadingState message="Carregando página..." />;
  if (isError || !page) {
    const msg =
      loadError instanceof Error ? loadError.message : "Página indisponível.";
    return <ErrorState message={msg} onRetry={() => refetch()} />;
  }

  const gateKind = getPresellGateKind(page.type);
  const interactiveKind = getInteractiveGateKind(page.type);

  const settings = (page.settings || {}) as Record<string, unknown>;
  const title = (content.title as string) || page.title;
  const subtitle = (content.subtitle as string) || "";
  const salesText = (content.salesText as string) || "";
  const ctaText = (content.ctaText as string) || "Quero Aproveitar Agora";
  const productImages = Array.isArray(content.productImages)
    ? (content.productImages as string[]).filter((u) => typeof u === "string" && u.length > 0)
    : [];

  const cookiePolicyUrl = typeof settings.cookiePolicyUrl === "string" ? settings.cookiePolicyUrl : "";

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

  const pageBody = (
    <>
      {gateKind === "cookies" && !cookieAccepted && !cookieDismissed ? (
        <CookieConsentModal
          language={page.language}
          policyUrl={cookiePolicyUrl}
          accepted={cookieAccepted}
          redirectHref={href}
          onAccept={() => setCookieAccepted(true)}
          onDismiss={() => setCookieDismissed(true)}
        />
      ) : null}
      {gateKind === "cookies" && showCookieChip ? (
        <CookieSettingsChip
          language={page.language}
          onClick={() => {
            if (href) window.location.assign(href);
          }}
        />
      ) : null}

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
              language={page.language}
              settings={settings}
              onPayload={handleFieldPayload}
            />
          ) : null}

          {heroImage && !hideHeroImageForVslFallback ? (
            <div className="rounded-2xl bg-white/60 dark:bg-card/50 p-4 shadow-sm border border-border/40 mx-auto max-w-2xl">
              <img
                src={heroImage}
                alt=""
                className="w-full max-h-[min(420px,55vh)] object-contain mx-auto rounded-lg"
                loading="eager"
                decoding="async"
              />
            </div>
          ) : null}

          <div className="space-y-3 sm:space-y-4 max-w-4xl mx-auto px-1">
            <h1
              className={`text-2xl sm:text-4xl md:text-[2.65rem] font-extrabold leading-[1.12] tracking-tight ${
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
                    language={page.language}
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

      {galleryImages.length > 0 && !showVslFallback ? (
        <section className="max-w-5xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {galleryImages.map((src, i) => (
              <div
                key={`${i}-${src.slice(0, 40)}`}
                className="rounded-xl overflow-hidden border border-border/50 bg-muted/30 shadow-sm"
              >
                <img
                  src={src}
                  alt=""
                  className="w-full object-cover max-h-80"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showSalesLetterSection ? (
        <section className="max-w-3xl mx-auto px-4 py-8 md:py-12">
          <div className="rounded-2xl border border-border/40 bg-card/30 px-4 py-8 md:px-10 md:py-10 shadow-sm">
            <SalesBlocks
              blocks={textBlocks}
              midInsert={
                <div className="my-6 sm:my-8 rounded-2xl border border-border/50 bg-gradient-to-b from-muted/50 via-card/80 to-muted/30 p-6 sm:p-8 shadow-inner">
                  <div className="flex flex-col items-center gap-4 sm:gap-5 max-w-lg mx-auto text-center">
                    <p className="text-sm sm:text-base text-foreground/85 font-medium leading-relaxed px-1">
                      {copyMidCta(page.language)}
                    </p>
                    <PresellCta href={href} disabled={!ctaEnabled} surface="light">
                      {ctaText}
                    </PresellCta>
                  </div>
                </div>
              }
            />
          </div>
        </section>
      ) : null}

      <section className="max-w-3xl mx-auto px-3 sm:px-4 pb-12 sm:pb-16 pt-6 sm:pt-8">
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-[2px] px-4 py-8 sm:px-8 sm:py-10 text-center space-y-5 shadow-sm">
          <PresellCta href={href} disabled={!ctaEnabled} surface="light">
            {ctaText}
          </PresellCta>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {copyFooter(page.language)}
          </p>
        </div>
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Montagem de scripts “início do corpo” (pixels, SmartClick, etc.) */}
      <div
        ref={bodyCodeMountRef}
        className="sr-only pointer-events-none absolute h-0 w-0 overflow-hidden"
        aria-hidden
        data-presell-inject="body-start"
      />
      {isDiscount ? (
        <DiscountPresellOverlay
          language={page.language}
          headline={discountHeadline}
          socialProof={socialProofLine.trim() ? socialProofLine : discountSocialFallback(page.language)}
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
