import { createContext, useContext, useRef, type ReactNode } from "react";

const LcpMediaContext = createContext<(() => boolean) | null>(null);

/** A primeira imagem da página pede o ficheiro já (LCP); vídeos não reivindicam. */
export function LcpMediaScope({ children }: { children: ReactNode }) {
  const claimed = useRef(false);
  const claim = () => {
    if (claimed.current) return false;
    claimed.current = true;
    return true;
  };
  return <LcpMediaContext.Provider value={claim}>{children}</LcpMediaContext.Provider>;
}

export function useClaimLcpMedia(active = true): boolean {
  const claim = useContext(LcpMediaContext);
  const won = useRef<boolean | null>(null);
  if (won.current === null) {
    won.current = active && claim ? claim() : false;
  }
  return won.current;
}
