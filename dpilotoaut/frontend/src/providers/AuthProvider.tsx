import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getSession, signOut as signOutFn } from "@/server/auth.functions";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  /** Administrador comercial (Hotmart, métricas de produto). */
  isPlatformAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Após signIn/signUp: aplica o utilizador devolvido e reconcilia com getSession.
   * Evita que `getSession` ainda vazio (cookie ainda não no próximo fetch) apague a sessão
   * e o `/app` redirecione de volta para o login sem reação visível.
   */
  afterCredentialLogin: (fallbackUser: AuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const res = await getSession();
    setUser(res.user);
  };

  const afterCredentialLogin = async (fallbackUser: AuthUser) => {
    setUser(fallbackUser);
    try {
      const res = await getSession();
      if (res.user) {
        setUser(res.user);
      }
    } catch (e) {
      console.error("[auth] getSession após credenciais", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getSession();
        if (!cancelled) setUser(res.user);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    await signOutFn();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signOut, refresh, afterCredentialLogin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
