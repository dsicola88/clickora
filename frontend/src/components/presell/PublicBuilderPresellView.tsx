import { useEffect, useRef } from "react";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import type { PageDocument } from "@/page-builder/types";
import { applyTrackingToDocument } from "@/page-builder/tracking";

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

      const isOfferIntent = (() => {
        if (marked) return true;
        if (hashOnly || hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) return false;
        if (!offerNorm) return false;
        try {
          const absolute = new URL(hrefAttr, window.location.href).href;
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

      if (marked && hashOnly) {
        e.preventDefault();
        e.stopPropagation();
        window.location.assign(track);
        return;
      }
      if (hashOnly || hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) {
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
          : undefined
      }
    >
      <PageRenderer doc={doc} device="desktop" />
    </div>
  );
}
