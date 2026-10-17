import { useEffect, useRef } from "react";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import type { PageDocument } from "@/page-builder/types";
import { applyTrackingToDocument } from "@/page-builder/tracking";
import { hrefLooksLikeOfferLink, isCtaLabel } from "@/lib/presellOfferHrefBake";

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
};

/**
 * Vista pública do editor manual. Intercepta cliques no hoplink para passar por `/track/r/`
 * (contagem + `clickora_click_id`); links internos / mailto / tel / outras URLs ficam intactos.
 */
export function PublicBuilderPresellView({
  doc,
  trackOfferHref,
  offerUrl,
  interactionLocked = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = doc.tracking;
    if (!t) return () => {};
    const cleanup = applyTrackingToDocument(t);
    return () => cleanup();
  }, [doc]);

  useEffect(() => {
    const track = (trackOfferHref ?? "").trim();
    const offerNorm = offerUrl ? normalizeComparableUrl(offerUrl) : null;
    const root = rootRef.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const a = e.composedPath().find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement);
      if (!a) return;
      const hrefAttr = (a.getAttribute("href") || "").trim();
      const marked = a.getAttribute("data-clickora-offer") === "1";
      const hashOnly = !hrefAttr || hrefAttr === "#" || hrefAttr.startsWith("#");

      const labelHit = isCtaLabel(a.textContent || a.getAttribute("aria-label") || "");
      const softHash = /^#(top|content|main|inicio|topo|footer|nav)\b/i.test(hrefAttr);
      const isOfferIntent = (() => {
        if (marked) return true;
        if (labelHit && (hashOnly || !softHash)) return true;
        if (hashOnly || hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) return false;
        try {
          const absolute = new URL(hrefAttr, window.location.href).href;
          if (hrefLooksLikeOfferLink(absolute, offerUrl || "")) return true;
          if (!offerNorm) return false;
          const linkNorm = normalizeComparableUrl(absolute);
          return Boolean(linkNorm && linkNorm === offerNorm);
        } catch {
          return false;
        }
      })();

      if (!isOfferIntent) return;

      if (interactionLocked) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (!track) return;

      if (hashOnly || hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:") || softHash) {
        if (labelHit || marked) {
          e.preventDefault();
          e.stopPropagation();
          window.location.assign(track);
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(track);
    };

    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [trackOfferHref, offerUrl, interactionLocked]);

  return (
    <div
      ref={rootRef}
      data-clickora-builder-public="1"
      data-interaction-locked={interactionLocked ? "1" : undefined}
      className={
        interactionLocked
          ? "[&_a]:pointer-events-none [&_a]:opacity-50 [&_button]:pointer-events-none [&_button]:opacity-50"
          : "[&_[data-presell-portal-photo]_img]:object-contain [&_[data-clickora-offer-primary='1']]:hover:brightness-105 [&_[data-clickora-offer-primary='1']]:active:scale-[0.99]"
      }
    >
      <PageRenderer doc={doc} device="desktop" />
    </div>
  );
}
