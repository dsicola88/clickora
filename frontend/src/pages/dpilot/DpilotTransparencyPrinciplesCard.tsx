import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TRANSPARENCY_TAGLINE } from "@/lib/paidAdsTransparency";

/** Princípios de produto — confiança e papéis (Visão geral). */
export function DpilotTransparencyPrinciplesCard() {
  return (
    <Card className="border-dashed border-primary/25 bg-muted/15">
      <CardContent className="flex gap-3 pt-5">
        <Quote className="h-5 w-5 shrink-0 text-primary/70" aria-hidden />
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground/95">
            O piloto trabalha até ao limite que definir nas regras; detalhes técnicos ficam sempre auditáveis no produto,
            quando necessário.
          </p>
          <p className="text-xs italic opacity-90">{TRANSPARENCY_TAGLINE}</p>
        </div>
      </CardContent>
    </Card>
  );
}
