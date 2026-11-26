import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { measureMirrorDocumentContentHeight } from "@/lib/presellMirrorTailTrim";

type Props = {
  srcDoc: string;
  title?: string;
  /** Chamado se o `<body>` parecer vazio (texto mínimo e sem media/tabelas) — permite cair no layout React. */
  onMirrorProbablyEmpty?: () => void;
  /**
   * @deprecated Sem efeito. Os CTAs já vêm como `<a href="/track/r/…" target="_top">` nativos
   * no `srcDoc` (ver `bakeHtmlOfferHrefs`); o iframe não intercepta cliques nem usa postMessage.
   */
  offerHref?: string;
  /** @deprecated Sem efeito (ver `offerHref`). */
  affiliateHref?: string;
  interactionLocked?: boolean;
};

/**
 * Iframe com `srcDoc` da página importada (sem scripts).
 * Navegação para a oferta = âncoras nativas `target="_top"` (UTMs/GCLID já no href rastreado):
 * sem listeners de clique, sem postMessage, sem `window.location.assign`.
 * Altura segue o conteúdo; reage a resize / visualViewport / ResizeObserver (rotação, fonts).
 */
export function ImportedPageMirrorIframe({
  srcDoc,
  title = "Página do produto",
  onMirrorProbablyEmpty,
  interactionLocked = false,
}: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const debounceRef = useRef<number>(0);
  const emptyCbRef = useRef(onMirrorProbablyEmpty);
  emptyCbRef.current = onMirrorProbablyEmpty;
  const [height, setHeight] = useState(960);
  const [blobFrameSrc, setBlobFrameSrc] = useState("");

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const doc = el.contentDocument;
      const contentH = doc ? measureMirrorDocumentContentHeight(doc) : 480;
      const next = Math.min(48_000, Math.max(480, Math.ceil(contentH)));
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
    const trimmed = srcDoc.trim();
    if (trimmed.length < 80) {
      setBlobFrameSrc("");
      return;
    }
    const blob = new Blob([trimmed], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setBlobFrameSrc(url);
    return () => {
      URL.revokeObjectURL(url);
      setBlobFrameSrc("");
    };
  }, [srcDoc]);

  useEffect(() => {
    measureDebounced();
    return () => window.clearTimeout(debounceRef.current);
  }, [srcDoc, blobFrameSrc, measureDebounced]);

  useEffect(() => {
    const onWin = () => measureDebounced();
    window.addEventListener("resize", onWin);
    window.visualViewport?.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("resize", onWin);
      window.visualViewport?.removeEventListener("resize", onWin);
    };
  }, [measureDebounced]);

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
  }, [measureDebounced, checkProbablyEmpty]);

  useEffect(() => {
    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
    };
  }, []);

  if (!blobFrameSrc) {
    return (
      <div
        className="w-full min-h-[min(72vh,520px)] bg-white"
        aria-busy="true"
        aria-label={title}
      />
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden">
      <iframe
        ref={ref}
        title={title}
        src={blobFrameSrc}
        onLoad={onLoad}
        className={cn(
          "w-full max-w-full border-0 block bg-white",
          height < 520 ? "min-h-[min(72vh,520px)]" : "min-h-0",
          interactionLocked && "pointer-events-none select-none",
        )}
        style={{ height, width: "100%", maxWidth: "100%" }}
        /** Sem allow-scripts: nada executa no iframe. Só cliques reais (user activation) navegam o topo. */
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin allow-presentation allow-top-navigation-by-user-activation"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
