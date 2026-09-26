import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/authService";
import type { User, UserPlan } from "@/types/api";

export type SignInResult = {
  error: string | null;
  mfa?: { mfa_token: string; email: string };
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userPlan: UserPlan | null;
  presellCount: number;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  verifyMfa: (mfa_token: string, code: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (idToken: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    acceptPolicies: boolean,
  ) => Promise<{ error: string | null }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(authService.getStoredUser());
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";
  const userPlan = user?.plan ?? null;
  const presellCount = 0; // Will be fetched from API when needed

  const refreshUser = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setUser(null);
      setLoading(false);
      return;
    }

    const { data, error } = await authService.me();
    if (data) {
      setUser((current) => {
        if (current?.id && data.id !== current.id) {
          queryClient.clear();
        }
        return data;
      });
      localStorage.setItem("clickora_user", JSON.stringify(data));
    } else if (error) {
      setUser(null);
      authService.logout();
      queryClient.clear();
    }
    setLoading(false);
  }, [queryClient]);

  useEffect(() => {
    refreshUser();

    // Listen for forced logout (401 from API)
    const handleLogout = () => {
      queryClient.clear();
      setUser(null);
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [refreshUser, queryClient]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const { data, error } = await authService.login({ email, password });
      if (error) return { error };
      if (data && "mfa_required" in data && data.mfa_required) {
        return {
          error: null,
          mfa: { mfa_token: data.mfa_token, email: data.email },
        };
      }
      if (data && "token" in data && data.token) {
        queryClient.clear();
        setUser(data.user);
      }
      return { error: null };
    },
    [queryClient],
  );

  const verifyMfa = useCallback(
    async (mfa_token: string, code: string) => {
      const { data, error } = await authService.verifyMfaLogin(mfa_token, code);
      if (data?.token) {
        queryClient.clear();
        setUser(data.user);
      }
      return { error };
    },
    [queryClient],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const { data, error } = await authService.loginWithGoogle(idToken);
      if (data) {
        queryClient.clear();
        setUser(data.user);
      }
      return { error };
    },
    [queryClient],
  );

  const signUp = async (email: string, password: string, fullName: string, acceptPolicies: boolean) => {
    const { data, error } = await authService.register({
      email,
      password,
      full_name: fullName,
      accept_policies: acceptPolicies,
    });
    if (data) {
      queryClient.clear();
      setUser(data.user);
    }
    return { error };
  };

  const signOut = async () => {
    await authService.logout();
    queryClient.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isSuperAdmin,
        userPlan,
        presellCount,
        signOut,
        signIn,
        verifyMfa,
        signInWithGoogle,
        signUp,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
