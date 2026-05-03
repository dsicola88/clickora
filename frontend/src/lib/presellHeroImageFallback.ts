import { useCallback, useEffect, useState } from "react";

/**
 * Quando a URL hero falha (hotlink, 404), tenta a seguinte na lista sem mudar a galeria.
 */
export function usePresellHeroImageWithFallback(productImages: string[], selectedIdx: number) {
  const [skip, setSkip] = useState(0);
  const sig = productImages.join("\0");

  useEffect(() => {
    setSkip(0);
  }, [selectedIdx, sig]);

  const last = Math.max(0, productImages.length - 1);
  const idx = Math.min(Math.max(0, selectedIdx + skip), last);
  const src = productImages[idx] ?? "";

  const onError = useCallback(() => {
    setSkip((s) => {
      const maxSkip = Math.max(0, productImages.length - 1 - selectedIdx);
      if (s >= maxSkip) return s;
      return s + 1;
    });
  }, [productImages.length, selectedIdx]);

  return { src, onError, effectiveIndex: idx };
}
