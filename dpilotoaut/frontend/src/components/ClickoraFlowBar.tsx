import { FileText, LayoutDashboard, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClickoraEmbed } from "@/hooks/useClickoraEmbed";
import { navigateClickoraParent } from "@/lib/parentNavigate";

/**
 * Atalhos para presell, links e painel — navegam no shell Clickora (parece uma única app).
 */
export function ClickoraFlowBar() {
  const embed = useClickoraEmbed();
  if (!embed) return null;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Presell, link e resultados
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Campanha pronta: presell, link rastreado e métricas no painel Clickora.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => navigateClickoraParent("/presell/templates/editor")}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Criar presell
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => navigateClickoraParent("/tracking/links")}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          Obter link automático
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => navigateClickoraParent("/tracking/dashboard")}
        >
          <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
          Ver resultados
        </Button>
      </div>
    </div>
  );
}
