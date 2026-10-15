import { createContext, useContext, type ReactNode } from "react";

const BuilderSurfaceContext = createContext(false);

/** Marca a árvore do construtor (edição e pré-visualização). Ausente na página pública. */
export function BuilderSurfaceProvider({ children }: { children: ReactNode }) {
  return <BuilderSurfaceContext.Provider value={true}>{children}</BuilderSurfaceContext.Provider>;
}

export function useBuilderSurface(): boolean {
  return useContext(BuilderSurfaceContext);
}
