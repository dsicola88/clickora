import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  mirrorAnchorLooksCommercial,
  resolveMirrorAnchorNavigateHref,
} from "@/lib/presellMirrorIframeNav";

function repairMirrorOfferAnchors(doc: Document, trackHref: string): void {
  doc.querySelectorAll("a").forEach((a) => {
    const href = (a.getAttribute("href") || "").trim();
    if (!href || href.startsWith("#") || /^mailto:|^tel:/i.test(href)) return;
    const isTracked =
      (trackHref && href === trackHref) ||
      href.includes("/track/") ||
      href.includes("clickora.invalid/__TRACK");
    if (!mirrorAnchorLooksCommercial(a) && !isTracked) return;
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length < 2) {
      const labelBlob = `${a.textContent || ""} ${a.getAttribute("aria-label") || ""} ${a.className || ""}`;
      const fallback =
        a.getAttribute("aria-label")?.trim() ||
        a.getAttribute("title")?.trim() ||
        (mirrorAnchorLooksCommercial(a) ? "Order Now" : "");
      if (fallback) a.textContent = fallback;
    }
  });
}

type Props = {
  srcDoc: string;
  title?: string;
  /** Chamado se o `<body>` parecer vazio (texto mínimo e sem media/tabelas) — permite cair no layout React. */
  onMirrorProbablyEmpty?: () => void;
  /** URL rastreada `/track/r/…` — todos os CTAs comerciais devem abrir na janela principal. */
  offerHref?: string;
  /** Hoplink bruto (mwebkivo, buygoods…) — classificar links no espelho. */
  affiliateHref?: string;
  interactionLocked?: boolean;
};

/**
 * Iframe com `srcDoc` da página importada (sem scripts).
 * Altura segue o conteúdo; reage a resize / visualViewport / ResizeObserver (rotação, fonts).
 */
export function ImportedPageMirrorIframe({
  srcDoc,
  title = "Página do produto",
  onMirrorProbablyEmpty,
  interactionLocked = false,
  offerHref,
  affiliateHref = "",
}: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const debounceRef = useRef<number>(0);
  const emptyCbRef = useRef(onMirrorProbablyEmpty);
  emptyCbRef.current = onMirrorProbablyEmpty;
  const [height, setHeight] = useState(960);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const b = el.contentDocument?.body;
      // Só o conteúdo. A altura do <html> acompanha o iframe e, se entrar na conta, cresce até ao tecto.
      const contentH = Math.max(b?.scrollHeight ?? 0, b?.offsetHeight ?? 0, 480);
      const next = Math.min(48_000, Math.ceil(contentH + 8));
      setHeight((prev) => (Math.abs(prev - next) <= 2 ? prev : next));
    } catch {
      setHeight(2600);
    }
  }, []);

  const measureDebounced = useCallback(() => {
    window.clearTimeout(debounceRef.current);
    measure();
    debounceRef.current = window.setTimeout(() => {
      measure();
      debounceRef.current = window.setTimeout(measure, 350);
    }, 90);
  }, [measure]);

  const checkProbablyEmpty = useCallback(() => {
    try {
      const doc = ref.current?.contentDocument;
      if (!doc?.body) return;
      const text = doc.body.innerText?.replace(/\s+/g, " ").trim() ?? "";
      const hasMedia = doc.body.querySelector(
        "img, picture, video, svg, canvas, table, iframe, [role='img']",
      );
      const scrollH = Math.max(
        doc.body.scrollHeight,
        doc.documentElement?.scrollHeight ?? 0,
      );
      const looksLikeBareShell = scrollH < 200 && !hasMedia;
      if ((!hasMedia && text.length < 55) || looksLikeBareShell) {
        emptyCbRef.current?.();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    measureDebounced();
    return () => window.clearTimeout(debounceRef.current);
  }, [srcDoc, measureDebounced]);

  useEffect(() => {
    const onWin = () => measureDebounced();
    window.addEventListener("resize", onWin);
    window.visualViewport?.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("resize", onWin);
      window.visualViewport?.removeEventListener("resize", onWin);
    };
  }, [measureDebounced]);

  const offerHrefRef = useRef(offerHref);
  offerHrefRef.current = offerHref;
  const affiliateHrefRef = useRef(affiliateHref);
  affiliateHrefRef.current = affiliateHref;
  const mirrorClickCleanup = useRef<(() => void) | null>(null);

  const onLoad = useCallback(() => {
    measureDebounced();
    const el = ref.current;
    const doc = el?.contentDocument;
    const target = doc?.documentElement;
    roRef.current?.disconnect();
    roRef.current = null;
    if (target && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => measureDebounced());
      ro.observe(target);
      roRef.current = ro;
    }
    window.setTimeout(checkProbablyEmpty, 320);
    window.setTimeout(checkProbablyEmpty, 1400);
    window.setTimeout(checkProbablyEmpty, 2800);
    try {
      const repairDoc = el?.contentDocument;
      if (repairDoc) repairMirrorOfferAnchors(repairDoc, offerHrefRef.current || "");
    } catch {
      /* cross-origin guard */
    }
    mirrorClickCleanup.current?.();
    mirrorClickCleanup.current = null;
    const offer = (offerHrefRef.current || "").trim();
    const clickDoc = el?.contentDocument;
    if (!offer || offer === "#" || !clickDoc) return;
    const onClick = (e: MouseEvent) => {
      const node = e.target;
      if (!(node instanceof Element)) return;
      const a = node.closest("a");
      if (!a) return;
      const dest = resolveMirrorAnchorNavigateHref(
        a,
        offer,
        affiliateHrefRef.current || "",
      );
      if (!dest) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(dest);
    };
    clickDoc.addEventListener("click", onClick, true);
    mirrorClickCleanup.current = () => clickDoc.removeEventListener("click", onClick, true);
  }, [measureDebounced, checkProbablyEmpty]);

  useEffect(() => {
    return () => {
      mirrorClickCleanup.current?.();
      roRef.current?.disconnect();
      roRef.current = null;
    };
  }, []);

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      <iframe
        ref={ref}
        title={title}
        srcDoc={srcDoc}
        onLoad={onLoad}
        className={cn(
          "w-full max-w-full border-0 block bg-white min-h-[min(72vh,520px)]",
          interactionLocked && "pointer-events-none select-none",
        )}
        style={{ height, width: "100%", maxWidth: "100%" }}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin allow-presentation allow-top-navigation-by-user-activation"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
