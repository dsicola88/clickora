import { createContext, useContext, type ReactNode } from "react";

export type PresellBuilderEmbedContextValue = {
  /** Guardar documento na API Clickora (criar ou atualizar presell). */
  onRequestSave: () => void;
  isSaving: boolean;
  /** Quando false, desactiva «Guardar na conta» (ex.: papel só leitura). */
  canSave?: boolean;
};

const PresellBuilderEmbedContext = createContext<PresellBuilderEmbedContextValue | null>(null);

export function PresellBuilderEmbedProvider({
  value,
  children,
}: {
  value: PresellBuilderEmbedContextValue;
  children: ReactNode;
}) {
  return (
    <PresellBuilderEmbedContext.Provider value={value}>{children}</PresellBuilderEmbedContext.Provider>
  );
}

export function usePresellBuilderEmbedOptional() {
  return useContext(PresellBuilderEmbedContext);
}
