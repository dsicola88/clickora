import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";

/**
 * Configurações: domínio + atalhos avançados.
 */
export default function SettingsHubPage() {
  const [params] = useSearchParams();
  const highlightAdv = params.get("avancado") === "1";

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Configurações"
        description="Domínio da conta e ferramentas avançadas."
      />

      <div className="grid gap-4 max-w-2xl">
        <Link
          to="/tracking/settings-legacy"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Domínio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ligue o seu domínio às páginas publicadas. SSL tratado pela Clickora após o DNS.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Configurar domínio <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        <section
          className={`rounded-xl border bg-card p-5 space-y-3 ${highlightAdv ? "border-primary/50" : "border-border/60"}`}
        >
          <h2 className="font-semibold text-sm">Configurações avançadas</h2>
          <p className="text-xs text-muted-foreground">
            Só se precisar. O tracking diário não depende destas telas.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { to: "/tracking/rotadores", label: "Rotadores" },
              { to: "/tracking/tools", label: "Diagnóstico" },
              { to: "/tracking/blacklist", label: "IP e protecções" },
              { to: "/tracking/logs", label: "Logs" },
              { to: "/tracking/url-builder", label: "URL manual" },
              { to: "/ajuda", label: "Ajuda" },
            ].map((x) => (
              <Button key={x.to} variant="outline" className="justify-start" asChild>
                <Link to={x.to}>{x.label}</Link>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
