import { createContext, useContext, type ReactNode } from "react";

export type CloudAutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type PresellBuilderEmbedContextValue = {
  /** Guardar documento na API Clickora (criar ou atualizar / publicar). */
  onRequestSave: () => void;
  isSaving: boolean;
  /** Quando false, desactiva «Guardar na conta» (ex.: papel só leitura). */
  canSave?: boolean;
  /** Estado do autosave na BD (não localStorage). */
  cloudAutosaveStatus?: CloudAutosaveStatus;
  /** Timestamp da última gravação bem-sucedida na conta. */
  lastCloudSavedAt?: number | null;
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
