import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Plans from "@/pages/Plans";

/**
 * Rota `/`: landing de planos para visitantes; utilizadores autenticados vão para o painel.
 */
export function LandingRoot() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (user) return <Navigate to="/inicio" replace />;

  return <Plans />;
}
