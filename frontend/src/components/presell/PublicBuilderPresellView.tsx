import { useEffect, useRef } from "react";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import type { PageDocument } from "@/page-builder/types";
import { applyTrackingToDocument } from "@/page-builder/tracking";
import { hrefLooksLikeOfferLink, isCtaLabel } from "@/lib/presellOfferHrefBake";
import { useViewportBuilderDevice } from "@/page-builder/useViewportBuilderDevice";
import { BUILDER_PUBLIC_RESPONSIVE_CSS } from "@/page-builder/builderPublicCss";

function normalizeComparableUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return `${u.origin}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return null;
  }
}

type Props = {
  doc: PageDocument;
  /** URL `/track/r/…` da oferta desta presell. */
  trackOfferHref?: string;
  /** Hoplink em `content.affiliateLink` — CTAs com este destino passam pelo tracker. */
  offerUrl?: string;
  /**
   * Gates interativos (idade, país, captcha…): enquanto incompletos,
   * bloqueia qualquer navegação para a oferta no documento.
   */
  interactionLocked?: boolean;
  /**
   * Tipo cookies: GTM/GA4/Meta do documento só após Aceitar.
   * Sem gate, marketingAllowed=true (comportamento histórico).
   */
  marketingAllowed?: boolean;
  gateMarketingUntilAccept?: boolean;
};

/**
 * Vista pública do editor manual. Os CTAs são links nativos para `/track/r/` (contagem +
 * `clickora_click_id`); não há interceção nem `location.assign` — só bloqueio enquanto o gate está incompleto.
 */
export function PublicBuilderPresellView({
  doc,
  offerUrl,
  interactionLocked = false,
  marketingAllowed = true,
  gateMarketingUntilAccept = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const device = useViewportBuilderDevice();

  useEffect(() => {
    const t = doc.tracking;
    if (!t) return () => {};
    if (gateMarketingUntilAccept && !marketingAllowed) return () => {};
    const cleanup = applyTrackingToDocument(t);
    return () => cleanup();
  }, [doc, gateMarketingUntilAccept, marketingAllowed]);

  /**
   * Sem sequestro de clique: os CTAs são `<a href>` nativos já apontados a `/track/r/…`
   * (com gclid/UTMs da URL actual) por `bakePublicOfferHrefs`, e o browser navega sozinho.
   * Este handler só BLOQUEIA a compra enquanto um gate interactivo (idade, país…) está incompleto.
   */
  useEffect(() => {
    if (!interactionLocked) return;
    const offerNorm = offerUrl ? normalizeComparableUrl(offerUrl) : null;
    const root = rootRef.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      const path = e.composedPath();
      const a = path.find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement);
      if (!a) return;
      const hrefAttr = (a.getAttribute("href") || "").trim();
      const marked = a.getAttribute("data-clickora-offer") === "1";
      const labelHit = isCtaLabel(a.textContent || a.getAttribute("aria-label") || "");
      let offerLike = marked || labelHit || /\/track\/r\//i.test(hrefAttr);
      if (!offerLike && hrefAttr && !hrefAttr.startsWith("#")) {
        try {
          const absolute = new URL(hrefAttr, window.location.href).href;
          const linkNorm = normalizeComparableUrl(absolute);
          offerLike =
            hrefLooksLikeOfferLink(absolute, offerUrl || "") || Boolean(offerNorm && linkNorm === offerNorm);
        } catch {
          offerLike = false;
        }
      }
      if (!offerLike) return;
      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [offerUrl, interactionLocked]);

  return (
    <div
      ref={rootRef}
      data-clickora-builder-public="1"
      data-pb-device={device}
      data-interaction-locked={interactionLocked ? "1" : undefined}
      className={
        interactionLocked
          ? "[&_a:not([data-clickora-cookie-allow-offer])]:pointer-events-none [&_a:not([data-clickora-cookie-allow-offer])]:opacity-50 [&_button:not([data-testid=presell-cookie-allow]):not([data-testid=presell-cookie-close])]:pointer-events-none [&_button:not([data-testid=presell-cookie-allow]):not([data-testid=presell-cookie-close])]:opacity-50"
          : "[&_[data-presell-portal-photo]_img]:object-contain [&_[data-clickora-offer-primary='1']]:hover:brightness-105 [&_[data-clickora-offer-primary='1']]:active:scale-[0.99]"
      }
    >
      <style dangerouslySetInnerHTML={{ __html: BUILDER_PUBLIC_RESPONSIVE_CSS }} />
      <PageRenderer doc={doc} device={device} />
    </div>
  );
}
