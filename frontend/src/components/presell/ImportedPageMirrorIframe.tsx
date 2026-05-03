import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  srcDoc: string;
  title?: string;
};

/**
 * Iframe com `srcDoc` da página importada (sem scripts). Altura ajustada ao conteúdo.
 */
export function ImportedPageMirrorIframe({ srcDoc, title = "Página do produto" }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(960);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const doc = el.contentDocument;
      const b = doc?.body;
      const root = doc?.documentElement;
      const h = Math.max(
        720,
        Math.min(
          48_000,
          Math.ceil(Math.max(b?.scrollHeight ?? 0, root?.scrollHeight ?? 0, 720) + 40),
        ),
      );
      setHeight(h);
    } catch {
      setHeight(2600);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [srcDoc, measure]);

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={srcDoc}
      onLoad={measure}
      className="w-full border-0 block bg-white"
      style={{ height }}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
