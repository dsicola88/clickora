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
};

/**
 * Vista pública do editor manual. Intercepta cliques no hoplink para passar por `/track/r/`
 * (contagem + `clickora_click_id`); links internos / mailto / tel / outras URLs ficam intactos.
 */
export function PublicBuilderPresellView({ doc, trackOfferHref, offerUrl }: Props) {
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
    if (!track || !offerNorm) return;
    const root = rootRef.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const el = e.target;
      if (!(el instanceof Element)) return;
      const a = el.closest("a");
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      const hrefAttr = (a.getAttribute("href") || "").trim();
      if (
        !hrefAttr ||
        hrefAttr === "#" ||
        hrefAttr.startsWith("#") ||
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:")
      ) {
        return;
      }
      let absolute: string;
      try {
        absolute = new URL(hrefAttr, window.location.href).href;
      } catch {
        return;
      }
      const linkNorm = normalizeComparableUrl(absolute);
      if (!linkNorm) return;
      const marked = a.getAttribute("data-clickora-offer") === "1";
      if (!marked && linkNorm !== offerNorm) return;

      e.preventDefault();
      e.stopPropagation();
      window.location.assign(track);
    };

    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [trackOfferHref, offerUrl]);

  return (
    <div ref={rootRef} data-clickora-builder-public="1">
      <PageRenderer doc={doc} device="desktop" />
    </div>
  );
}
