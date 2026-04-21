import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearCachedRootPresellId,
  readCachedRootPresellId,
  writeCachedRootPresellId,
} from "@/lib/customDomainRootPresellCache";
import { presellService } from "@/services/presellService";
import Plans from "@/pages/Plans";

/** Hosts onde a raiz `/` mostra a landing de planos (site principal ou dev/preview). */
function isMainProductHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  return h === "dclickora.com" || h === "www.dclickora.com";
}

/**
 * Domínio personalizado: pede à API qual presell publicada está ligada a este host e redireciona para `/p/{id}`.
 * Várias presells no mesmo domínio → a mais recentemente atualizada.
 */
function CustomDomainRootRedirect() {
  const mainSite =
    import.meta.env.VITE_PUBLIC_SITE_ORIGIN?.trim()?.replace(/\/+$/, "") || "https://www.dclickora.com";

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const cachedId = hostname ? readCachedRootPresellId(hostname) : null;

  const { data, isPending, isError } = useQuery({
    queryKey: ["public-custom-domain-root-presell", hostname],
    queryFn: async () => {
      const { data: payload, error } = await presellService.getRootPresellIdForHost();
      if (payload?.id) {
        if (hostname) writeCachedRootPresellId(hostname, payload.id);
        return payload.id;
      }
      if (hostname) clearCachedRootPresellId(hostname);
      if (error) throw new Error(error);
      return null;
    },
    initialData: cachedId ?? undefined,
    /** Com cache em sessionStorage, força refetch no mount para refletir mudanças no painel. */
    initialDataUpdatedAt: cachedId ? 0 : undefined,
    staleTime: 60_000,
    retry: 1,
  });

  if (isPending && !cachedId) {
    return <div className="min-h-screen bg-background" aria-busy="true" aria-label="A carregar" />;
  }

  if (data) {
    return <Navigate to={`/p/${data}`} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Domínio ativo</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isError
            ? "Não foi possível carregar a página. Verifica a ligação ou tenta o link com /p/ e o identificador (UUID) copiado no painel."
            : "Nenhuma presell publicada neste domínio. No painel, associa a presell a este domínio (Domínio nos links públicos) e publica a página."}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Gerir contas e presells em{" "}
          <a href={mainSite} className="text-primary underline underline-offset-2 font-medium">
            dclickora
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Rota `/`: landing de planos no site principal; no domínio personalizado verificado redireciona para a presell
 * ligada a esse domínio (`/p/{uuid}`).
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
    return <CustomDomainRootRedirect />;
  }

  if (user) return <Navigate to="/inicio" replace />;

  return <Plans />;
}
