import { useEffect, useState } from "react";

/** Equivale ao breakpoint Tailwind `lg:` (desktop). */
export const VIEWPORT_LG_MIN_PX = 1024;

/** `true` quando `window.matchMedia('(min-width: minWidthPx)')` coincide. SSR / 1.º paint: conservador com `false`. */
export function useViewportMinWidth(minWidthPx: number) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(min-width: ${minWidthPx}px)`).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidthPx}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [minWidthPx]);

  return matches;
}
