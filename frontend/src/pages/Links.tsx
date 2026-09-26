import { Link } from "react-router-dom";
import { Link2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";

/**
 * Rota legada `/tracking/links-legacy`.
 * Já não há CRUD em memória — o fluxo real é URL Builder ou Rotadores.
 */
export default function Links() {
  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Links guardados (legado)"
        description="Esta página foi descontinuada. Os links em memória locais já não são suportados."
      />

      <div className="mx-auto max-w-lg rounded-xl border border-border/50 bg-card p-6 shadow-card text-center space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para criar e copiar URLs de tracking, use o{" "}
          <strong className="font-medium text-foreground">URL Builder</strong>. Para distribuir tráfego
          entre destinos, use os <strong className="font-medium text-foreground">Rotadores</strong>.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button type="button" className="gap-2 w-full sm:w-auto" asChild>
            <Link to="/tracking/url-builder">
              <Link2 className="h-4 w-4" /> Ir ao URL Builder
            </Link>
          </Button>
          <Button type="button" variant="outline" className="gap-2 w-full sm:w-auto" asChild>
            <Link to="/tracking/rotadores">
              <Shuffle className="h-4 w-4" /> Ir aos Rotadores
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
