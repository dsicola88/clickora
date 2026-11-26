import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { userHasSubscriptionAccess } from "@/lib/subscriptionAccess";
import {
  clearCachedRootPresellId,
  writeCachedRootPresellId,
} from "@/lib/customDomainRootPresellCache";
import { ROBOTS_NOINDEX, isMainMarketingHostname } from "@/lib/seoHostPolicy";
import { isPresellUuidParam } from "@/lib/publicPresellOrigin";
import { presellService } from "@/services/presellService";
import Plans from "@/pages/Plans";

/** Hosts onde a raiz `/` mostra a landing de planos (site principal ou dev/preview). */
function isMainProductHostname(hostname: string): boolean {
  return isMainMarketingHostname(hostname);
}

/** Domínios de assinantes / tracking: nunca indexar (Google, Bing, Edge). */
function useTenantNoindexHead() {
  useEffect(() => {
    const prev =
      document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null;
    let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "robots");
      document.head.appendChild(el);
    }
    el.setAttribute("content", ROBOTS_NOINDEX);
    document.title = document.title?.trim() ? document.title : "\u00A0";
    return () => {
      if (prev == null) el?.remove();
      else el?.setAttribute("content", prev);
    };
  }, []);
}

/**
 * Domínio personalizado: pede à API qual presell publicada está ligada a este host e redireciona para `/p/{id}`.
 * Várias presells no mesmo domínio → a mais recentemente atualizada.
 */
function CustomDomainRootRedirect() {
  useTenantNoindexHead();
  const location = useLocation();

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
      const slug =
        payload && typeof payload === "object" && "slug" in payload
          ? (payload as { slug?: string | null }).slug
          : null;
      if (id) {
        if (hostname) writeCachedRootPresellId(hostname, id);
        return { kind: "presell" as const, id, slug: slug ?? null };
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
    const slug = (data as { slug?: string | null }).slug?.trim() ?? "";
    const bare =
      slug && !isPresellUuidParam(slug) ? `/${encodeURIComponent(slug)}` : `/p/${data.id}`;
    return <Navigate to={`${bare}${location.search}${location.hash}`} replace />;
  }

  /** Tracking, sem página publicada ou erro: página neutra — sem marca da plataforma nem descrição de redirects. */
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        {isError ? "Page temporarily unavailable." : "No page is published at this address."}
      </p>
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
