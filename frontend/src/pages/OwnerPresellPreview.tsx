import { lazy, Suspense, useEffect, useState } from "react";
import { PUBLIC_DOMAIN_REQUIRED_MESSAGE } from "@/lib/publicPresellOrigin";

const PublicPresell = lazy(() => import("./PublicPresell"));

/**
 * Preview privado da presell para o dono (rota autenticada no painel).
 * O domínio da plataforma não serve presells nem saltos para ofertas: os CTAs ficam inertes aqui
 * e impressões/cliques não são contabilizados.
 */
export default function OwnerPresellPreview() {
  const [ctaNotice, setCtaNotice] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      const href = a?.getAttribute("href") || "";
      if (!/\/track\/(r|rot)\//i.test(href)) return;
      e.preventDefault();
      e.stopPropagation();
      setCtaNotice(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
        <PublicPresell ownerPreview />
      </Suspense>
      <div
        role="status"
        className="fixed inset-x-0 bottom-0 z-[2147483000] border-t border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 shadow-lg sm:text-sm"
      >
        <strong>Pré-visualização privada</strong> — só visível com a sua sessão. Impressões e cliques não são
        contabilizados e os botões não abrem a oferta neste domínio.
        {ctaNotice ? <span className="block font-medium">{PUBLIC_DOMAIN_REQUIRED_MESSAGE}</span> : null}
      </div>
    </>
  );
}
