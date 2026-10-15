import { createContext, useContext, type ReactNode } from "react";

const PresellPublicLocaleContext = createContext<string | undefined>(undefined);

/** Idioma da presell para widgets que não guardam o texto (aviso de cookies). */
export function PresellPublicLocaleProvider({
  language,
  children,
}: {
  language: string | undefined;
  children: ReactNode;
}) {
  return (
    <PresellPublicLocaleContext.Provider value={language}>
      {children}
    </PresellPublicLocaleContext.Provider>
  );
}

export function usePresellPublicLocale(): string | undefined {
  return useContext(PresellPublicLocaleContext);
}
