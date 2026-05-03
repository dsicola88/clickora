import { Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDpilotPaid } from "./DpilotPaidContext";

/**
 * Narrativa única para o utilizador — o que é o piloto e o que esperar, sem jargão de engenharia.
 */
export function DpilotAutopilotSimpleBanner() {
  const mode = useDpilotPaid().overview?.project?.paid_mode ?? "";
  const isAutopilot = mode === "autopilot";
  const isCopilot = mode === "copilot";

  const modeBadge = isAutopilot ? (
    <Badge className="bg-blue-600 text-white hover:bg-blue-600/90 dark:bg-blue-600">Piloto automático</Badge>
  ) : isCopilot ? (
    <Badge variant="secondary">Com a sua confirmação</Badge>
  ) : (
    <Badge variant="outline">{mode.replace(/_/g, " ") || "Modo padrão"}</Badge>
  );

  return (
    <Card className="overflow-hidden border-blue-500/18 bg-gradient-to-br from-blue-500/[0.06] via-card to-card dark:border-blue-400/22 dark:from-blue-400/[0.08]">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600/12 dark:bg-blue-400/15"
          aria-hidden
        >
          <Gauge className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Piloto na prática</h2>
            {modeBadge}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isAutopilot ? (
              <>
                O servidor pode <strong className="font-medium text-foreground">criar ou ajustar</strong> campanhas na
                conta ligada, respeitando os{" "}
                <strong className="font-medium text-foreground">limites configurados neste projeto</strong>. Quando tudo está
                alinhado com os guardrails, não precisa rever cada pedido.
              </>
            ) : (
              <>
                As alterações significativas chegam primeiro a{" "}
                <strong className="font-medium text-foreground">Aprovações</strong>. Use{" "}
                <strong className="font-medium text-foreground">Aplicar na rede</strong> apenas após rever o resumo mostrado.
              </>
            )}
          </p>
          <ul className="grid gap-2.5 text-sm sm:grid-cols-3">
            <li className="rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm">
              <span className="font-semibold text-foreground">1.</span>{" "}
              <span className="text-muted-foreground">Defina só o </span>
              <span className="font-medium text-foreground">teto de gasto</span>
              <span className="text-muted-foreground"> — é a sua rede de segurança.</span>
            </li>
            <li className="rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm">
              <span className="font-semibold text-foreground">2.</span>{" "}
              <span className="text-muted-foreground">Crie campanhas com os </span>
              <span className="font-medium text-foreground">assistentes</span>
              <span className="text-muted-foreground">; a plataforma trata dos detalhes técnicos.</span>
            </li>
            <li className="rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm">
              <span className="font-semibold text-foreground">3.</span>{" "}
              <span className="text-muted-foreground">
                {isAutopilot
                  ? "Com os limites bem definidos, o fluxo automatiza dentro dos guardrails."
                  : "Abra «Aprovações» antes de usar «Aplicar na rede»."}
              </span>
            </li>
          </ul>
          <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border/50 pt-3">
            Registo de decisões: menu <strong className="font-medium text-foreground/90">Auditoria</strong>. Facturação e métricas
            oficiais permanecem nas contas das redes publicitárias.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
