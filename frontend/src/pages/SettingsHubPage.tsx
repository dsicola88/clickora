import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel } from "@/components/enterprise/ProShell";
import { EnterpriseApiKeysPanel } from "@/components/settings/EnterpriseApiKeysPanel";
import { EnterpriseTenantBrandingPanel } from "@/components/settings/EnterpriseTenantBrandingPanel";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { BrandKitProCard } from "@/components/BrandKitProCard";

const ADVANCED_LINKS = [
  { to: "/tracking/rotadores", label: "Rotadores" },
  { to: "/tracking/tools", label: "Diagnóstico" },
  { to: "/tracking/blacklist", label: "IP e protecções" },
  { to: "/tracking/logs", label: "Registos" },
  { to: "/tracking/url-builder", label: "URL manual" },
  { to: "/agency", label: "Agency / dual-pillar" },
  { to: "/aulas", label: "Aulas" },
  { to: "/ajuda", label: "Ajuda" },
] as const;

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

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Link
          to="/tracking/settings-legacy"
          className="group flex h-full items-start gap-4 rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
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
              Configurar domínio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <div className="min-w-0">
          <EnterpriseApiKeysPanel />
        </div>
      </div>

      <TrackPathStatus className="mb-2" />

      <div className="min-w-0 space-y-4">
        <EnterpriseTenantBrandingPanel />
        {/* Brand kit local (email suporte / rascunho Free) — sync com white-label acima quando Pro. */}
        <BrandKitProCard />
      </div>

      <ProPanel
        title="Configurações avançadas"
        description="Só se precisar. O tracking diário não depende destas telas. Também pesquisáveis com ⌘K."
        className={highlightAdv ? "border-primary/50" : undefined}
      >
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 px-4 pb-4">
          {ADVANCED_LINKS.map((x) => (
            <Button key={x.to} variant="outline" className="justify-start h-9 text-xs" asChild>
              <Link to={x.to}>{x.label}</Link>
            </Button>
          ))}
        </div>
      </ProPanel>
    </div>
  );
}
