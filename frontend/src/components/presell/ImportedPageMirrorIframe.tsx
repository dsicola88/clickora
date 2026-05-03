import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  srcDoc: string;
  title?: string;
};

/**
 * Iframe com `srcDoc` da página importada (sem scripts).
 * Altura segue o conteúdo; reage a resize / visualViewport / ResizeObserver (rotação, fonts).
 */
export function ImportedPageMirrorIframe({ srcDoc, title = "Página do produto" }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const debounceRef = useRef<number>(0);
  const [height, setHeight] = useState(960);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const doc = el.contentDocument;
      const b = doc?.body;
      const root = doc?.documentElement;
      const h = Math.max(
        480,
        Math.min(
          48_000,
          Math.ceil(
            Math.max(
              b?.scrollHeight ?? 0,
              root?.scrollHeight ?? 0,
              b?.offsetHeight ?? 0,
              root?.offsetHeight ?? 0,
              480,
            ) + 48,
          ),
        ),
      );
      setHeight(h);
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
  }, [measureDebounced]);

  useEffect(() => {
    return () => {
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
        className="w-full max-w-full border-0 block bg-white min-h-[min(72vh,520px)]"
        style={{ height, width: "100%", maxWidth: "100%" }}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
