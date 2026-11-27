import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { userHasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { isMainMarketingHostname } from "@/lib/seoHostPolicy";
import { TenantRoot } from "@/components/TenantRoot";
import Plans from "@/pages/Plans";

/** Hosts onde a raiz `/` mostra a landing de planos (site principal ou dev/preview). */
function isMainProductHostname(hostname: string): boolean {
  return isMainMarketingHostname(hostname);
}

/**
 * Rota `/`: landing de planos no site principal; em domínio personalizado de assinante delega em
 * `TenantRoot` (presell escolhida renderizada na própria `/`, ou página neutra — nunca redirect).
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

  if (typeof window !== "undefined" && !isMainProductHostname(window.location.hostname)) {
    return <TenantRoot />;
  }

  if (user) {
    return (
      <Navigate
        to={userHasSubscriptionAccess(user) ? "/inicio" : "/planos"}
        replace
      />
    );
  }

  return <Plans />;
}
