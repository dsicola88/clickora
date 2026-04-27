import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { LandingRenderer } from "@/components/landing/LandingRenderer";
import { parseLandingDocument, type LandingDocument } from "@/lib/landing-document";
import { getPublishedLanding } from "@/server/landing.functions";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/branding";

type Props = {
  slug: string;
  /** Em `/l/...` o «voltar» pode ser o site; em `/` evita cair no mesmo 404. */
  notFoundLinkTo?: string;
  notFoundLinkLabel?: string;
  notFoundTitle?: string;
  notFoundDescription?: ReactNode;
};

/**
 * Renders a public published landing by slug (same as `/l/$slug` but reusable for `/` home).
 */
export function PublicLandingBySlug({
  slug,
  notFoundLinkTo = "/",
  notFoundLinkLabel = `Ir a ${APP_NAME}`,
  notFoundTitle = "Página de vendas indisponível",
  notFoundDescription,
}: Props) {
  const defaultDesc = (
    <>
      Ainda não há uma <strong>página pública ativa</strong> com o atalho{" "}
      <code className="rounded bg-muted px-1 font-mono text-xs">{slug}</code>. Na app, crie a página, escolha o mesmo
      atalho e ligue <strong>Publicar</strong> (quem gere a plataforma pode usar Operação, ou a sua equipa a área do
      projecto <strong>Páginas de venda</strong>).
    </>
  );
  const load = useServerFn(getPublishedLanding);
  const [data, setData] = useState<{
    name: string;
    document: LandingDocument;
    theme: Record<string, unknown> | null;
  } | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(undefined);
    setLoadError(false);
    void (async () => {
      try {
        const r = await load({ data: { slug } });
        if (!alive) return;
        if (!r) {
          setData(null);
          return;
        }
        setData({
          name: r.name,
          document: parseLandingDocument(r.document),
          theme: r.theme,
        });
      } catch (e) {
        console.error("[PublicLandingBySlug]", e);
        if (!alive) return;
        setLoadError(true);
        setData(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, load]);

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-xl font-semibold">{loadError ? "Erro ao carregar a página" : notFoundTitle}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {loadError
            ? "Não foi possível ligar ao servidor. Tente mais tarde ou confirme a sua ligação à internet. Se o problema continuar, contacte o suporte."
            : notFoundDescription ?? defaultDesc}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/auth/sign-up">Criar conta</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={notFoundLinkTo}>{notFoundLinkLabel}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-border/60 bg-card/30 px-3 py-2 text-sm text-muted-foreground sm:px-4 sm:py-3">
        <span className="shrink-0 font-medium text-foreground">{APP_NAME}</span>
        <span className="hidden sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/auth/sign-in" className="shrink-0 text-primary hover:underline">
          Entrar
        </Link>
        <span className="text-muted-foreground/80" aria-hidden>
          |
        </span>
        <Link to="/auth/sign-up" className="shrink-0 text-primary hover:underline">
          Criar conta
        </Link>
      </nav>
      <LandingRenderer doc={data.document} theme={data.theme} />
    </div>
  );
}
