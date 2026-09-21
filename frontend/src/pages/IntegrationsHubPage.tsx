import { Link } from "react-router-dom";
import { ArrowRight, Megaphone, Plug } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { Badge } from "@/components/ui/badge";

/**
 * Hub Integrações — atalhos claros sem embutir páginas inteiras (evita headers duplicados).
 */
export default function IntegrationsHubPage() {
  const { user, isSuperAdmin } = useAuth();
  const dpilot = userCanAccessDpilotAds(user, isSuperAdmin);

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Integrações"
        description="Ligue vendas da rede de afiliados e, se quiser, o envio às plataformas de anúncios."
      />

      <div className="grid gap-4 max-w-2xl">
        <Link
          to="/tracking/plataformas-legacy"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">Vendas da rede</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              URL para a Hotmart, Digistore e outras redes avisarem vendas. Necessário para ver conversões.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Configurar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <Link
          to="/tracking/integrations-legacy"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">Anúncios (Google / Meta / TikTok)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enviar vendas aprovadas de volta às contas de anúncios. Opcional.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Configurar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {dpilot ? (
          <Link
            to="/tracking/dpilot"
            className="rounded-xl border border-dashed border-border/70 px-5 py-4 text-sm text-muted-foreground hover:bg-muted/30"
          >
            Gestão de campanhas paid (Google / Meta / TikTok) →
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground px-1">
            Gestão de campanhas paid:{" "}
            <Badge variant="secondary" className="text-[10px] mx-1">
              Premium
            </Badge>
            <Link to="/planos" className="text-primary underline-offset-2 hover:underline">
              Ver planos
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
