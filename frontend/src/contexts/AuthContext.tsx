import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { authService } from "@/services/authService";
import type { User, UserPlan } from "@/types/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userPlan: UserPlan | null;
  presellCount: number;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (idToken: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
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
      setUser(data);
      localStorage.setItem("clickora_user", JSON.stringify(data));
    } else if (error) {
      setUser(null);
      authService.logout();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();

    // Listen for forced logout (401 from API)
    const handleLogout = () => {
      setUser(null);
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await authService.login({ email, password });
    if (data) {
      setUser(data.user);
    }
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    const { data, error } = await authService.loginWithGoogle(idToken);
    if (data) {
      setUser(data.user);
    }
    return { error };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await authService.register({ email, password, full_name: fullName });
    if (data) {
      setUser(data.user);
    }
    return { error };
  };

  const signOut = async () => {
    await authService.logout();
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
