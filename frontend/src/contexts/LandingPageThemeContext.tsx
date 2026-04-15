import { createContext, useContext } from "react";
import {
  resolveLandingPageTheme,
  type ResolvedLandingPageTheme,
} from "@/lib/landingPageTheme";

const Ctx = createContext<ResolvedLandingPageTheme | null>(null);

export function LandingPageThemeProvider({
  value,
  children,
}: {
  value: ResolvedLandingPageTheme | null;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Tema da landing «vendas escuras»; se não houver contexto, devolve o resolver por defeito. */
export function useLandingSalesTheme(): ResolvedLandingPageTheme {
  const v = useContext(Ctx);
  return v ?? resolveLandingPageTheme(null);
}

/** Só dentro do provider da landing; pode ser null fora da página. */
export function useLandingSalesThemeOptional(): ResolvedLandingPageTheme | null {
  return useContext(Ctx);
}
