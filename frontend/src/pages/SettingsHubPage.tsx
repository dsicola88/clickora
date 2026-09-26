import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel } from "@/components/enterprise/ProShell";
import { EnterpriseApiKeysPanel } from "@/components/settings/EnterpriseApiKeysPanel";
import { EnterpriseTenantBrandingPanel } from "@/components/settings/EnterpriseTenantBrandingPanel";

/**
 * Configurações: domínio, API keys, white-label e atalhos avançados.
 */
export default function SettingsHubPage() {
  const [params] = useSearchParams();
  const highlightAdv = params.get("avancado") === "1";

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Configurações"
        subtitle="Domínio da conta, API keys, marca white-label e ferramentas avançadas."
      />

      <div className="grid gap-4 max-w-2xl">
        <Link
          to="/tracking/settings-legacy"
          className="group flex items-start gap-4 rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-md bg-primary/10 p-2.5">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm">Domínio</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Ligue o seu domínio às páginas publicadas. SSL tratado pela Clickora após o DNS.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Configurar domínio <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        <EnterpriseApiKeysPanel />
        <EnterpriseTenantBrandingPanel />

        <ProPanel
          title="Configurações avançadas"
          description="Só se precisar. O tracking diário não depende destas telas."
          className={highlightAdv ? "border-primary/50" : undefined}
        >
          <div className="grid gap-2 sm:grid-cols-2 px-4 pb-4">
            {[
              { to: "/tracking/rotadores", label: "Rotadores" },
              { to: "/tracking/tools", label: "Diagnóstico" },
              { to: "/tracking/blacklist", label: "IP e protecções" },
              { to: "/tracking/logs", label: "Logs" },
              { to: "/tracking/url-builder", label: "URL manual" },
              { to: "/ajuda", label: "Ajuda" },
            ].map((x) => (
              <Button key={x.to} variant="outline" className="justify-start h-9 text-xs" asChild>
                <Link to={x.to}>{x.label}</Link>
              </Button>
            ))}
          </div>
        </ProPanel>
      </div>
    </div>
  );
}
