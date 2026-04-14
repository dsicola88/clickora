import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Plans from "@/pages/Plans";

/** Hosts onde a raiz `/` mostra a landing de planos (site principal ou dev/preview). */
function isMainProductHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  return h === "dclickora.com" || h === "www.dclickora.com";
}

/**
 * Rota `/`: landing de planos para visitantes; utilizadores autenticados vão para o painel.
 * Num domínio personalizado verificado (outro hostname), a raiz não é uma presell — mostramos
 * instruções em vez da página de planos, para não parecer que o link público «caiu no site errado».
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

  if (typeof window !== "undefined" && !isMainProductHostname(window.location.hostname)) {
    const mainSite =
      import.meta.env.VITE_PUBLIC_SITE_ORIGIN?.trim()?.replace(/\/+$/, "") || "https://www.dclickora.com";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Domínio ativo para presells</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este endereço está ligado à tua conta para páginas presell. Para veres uma página criada, tens de abrir o{" "}
            <strong className="text-foreground">URL completo</strong> copiado no painel — inclui{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/p/</code> e o identificador da página (não basta
            abrir só o domínio).
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para criar e gerir presells, acede ao painel em{" "}
            <a href={mainSite} className="text-primary underline underline-offset-2 font-medium">
              dclickora
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <Plans />;
}
