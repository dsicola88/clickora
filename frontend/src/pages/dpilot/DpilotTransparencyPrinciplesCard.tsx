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
            O utilizador define <strong className="font-medium text-foreground">estratégia e limites</strong>; a
            plataforma <strong className="font-medium text-foreground">decide, executa e explica</strong>; as redes{" "}
            <strong className="font-medium text-foreground">optimizam a licitação</strong> — com controlo e transparência
            para confiar no sistema.
          </p>
          <p className="text-xs italic opacity-90">{TRANSPARENCY_TAGLINE}</p>
        </div>
      </CardContent>
    </Card>
  );
}
