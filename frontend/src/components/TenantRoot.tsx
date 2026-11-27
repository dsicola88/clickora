import { Suspense, lazy, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ROBOTS_NOINDEX } from "@/lib/seoHostPolicy";
import { presellService } from "@/services/presellService";

const PublicPresell = lazy(() => import("@/pages/PublicPresell"));

/** Domínios de assinantes / tracking: nunca indexar (Google, Bing, Edge). */
function useTenantNoindexHead() {
  useEffect(() => {
    const prev = document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null;
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

/** Página neutra: sem links, sem marca da plataforma, sem redirects. */
function NeutralRootPage({ unavailable }: { unavailable: boolean }) {
  useEffect(() => {
    const prev = document.title;
    document.title = "Portal";
    return () => {
      document.title = prev;
    };
  }, []);
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 text-center"
      data-testid="tenant-root-neutral"
    >
      <h1 className="text-xl font-semibold text-foreground">Portal</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {unavailable ? "Page temporarily unavailable." : "Em construção · Under construction"}
      </p>
    </main>
  );
}

/**
 * Raiz `/` de um domínio personalizado de assinante.
 * — Sem «Presell ao abrir» escolhida (domínio novo, tracking, escolha indisponível): página neutra.
 * — Com escolha manual: a presell é renderizada AQUI, na própria `/` — sem redirecionar para `/p/…`
 *   nem `/{slug}` (o URL do browser não muda). Nunca há escolha automática («última editada»).
 */
export function TenantRoot() {
  useTenantNoindexHead();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  const { data, isPending, isFetched } = useQuery({
    queryKey: ["public-custom-domain-root-presell", hostname],
    queryFn: async () => {
      const { data: payload, error, errorCode } = await presellService.getRootPresellIdForHost();
      const id =
        payload && typeof payload === "object" && "id" in payload
          ? (payload as { id?: string | null }).id
          : null;
      if (id && (payload as { purpose?: string }).purpose !== "tracking") {
        return { kind: "presell" as const, id };
      }
      if (payload && (payload as { purpose?: string }).purpose === "tracking") {
        return { kind: "neutral" as const };
      }
      /** 404 `ROOT_PRESELL_NONE` = sem presell escolhida para a raiz: estado vazio, não erro. */
      if (error && errorCode !== "ROOT_PRESELL_NONE") throw new Error(error);
      return { kind: "neutral" as const };
    },
    staleTime: 60_000,
    retry: 1,
    retryDelay: 300,
  });

  if (isPending || !isFetched) {
    return <div className="min-h-screen bg-background" aria-busy="true" aria-label="A carregar" />;
  }

  if (data?.kind === "presell") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
        <PublicPresell presellId={data.id} />
      </Suspense>
    );
  }

  return <NeutralRootPage unavailable={data == null} />;
}
