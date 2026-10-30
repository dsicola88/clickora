import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearCachedRootPresellId,
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

  const { data, isPending, isError, isFetched } = useQuery({
    queryKey: ["public-custom-domain-root-presell", hostname],
    queryFn: async () => {
      const { data: payload, error } = await presellService.getRootPresellIdForHost();
      if (payload && typeof payload === "object" && "purpose" in payload && (payload as { purpose?: string }).purpose === "tracking") {
        if (hostname) clearCachedRootPresellId(hostname);
        return { kind: "tracking" as const };
      }
      const id = payload && typeof payload === "object" && "id" in payload ? (payload as { id?: string | null }).id : null;
      if (id) {
        if (hostname) writeCachedRootPresellId(hostname, id);
        return { kind: "presell" as const, id };
      }
      if (hostname) clearCachedRootPresellId(hostname);
      if (error) throw new Error(error);
      return { kind: "empty" as const };
    },
    staleTime: 60_000,
    retry: 1,
  });

  /**
   * Não redirecionar só com sessionStorage: se o host passou a purpose=tracking,
   * um id em cache falharia a abrir lander no domínio de tracking.
   */
  if (isPending || !isFetched) {
    return <div className="min-h-screen bg-background" aria-busy="true" aria-label="A carregar" />;
  }

  if (data?.kind === "presell" && data.id) {
    return <Navigate to={`/p/${data.id}`} replace />;
  }

  if (data?.kind === "tracking") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Domínio de tracking</h1>
          <p className="text-sm text-muted-foreground">
            Este hostname serve <code className="text-xs">/api/track/…</code> (pixel e redirects). A lander
            publica-se no domínio de hosting.
          </p>
          <p className="text-sm text-muted-foreground">
            Conta em{" "}
            <a href={mainSite} className="text-primary underline underline-offset-2 font-medium">
              dclickora
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Domínio ativo</h1>
        <p className="text-sm text-muted-foreground">
          {isError
            ? "Erro ao carregar. Publique a página no painel ou contacte o suporte."
            : "Nenhuma página publicada aqui — associe o domínio e publique no painel."}
        </p>
        <p className="text-sm text-muted-foreground">
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
