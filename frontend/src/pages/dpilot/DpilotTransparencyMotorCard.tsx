import { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { explainOptimizerDecision } from "@/lib/paidAdsTransparency";
import { paidAdsService, type OptimizerDecisionRow } from "@/services/paidAdsService";

const PREVIEW_LIMIT = 5;

/** Pré-visualização na Visão geral: últimas decisões do motor com texto «porque». */
export function DpilotTransparencyMotorCard({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<OptimizerDecisionRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void paidAdsService.listOptimizerDecisions(projectId, { limit: PREVIEW_LIMIT, offset: 0 }).then(({ data, error }) => {
      if (cancelled) return;
      if (data?.decisions) {
        setRows(data.decisions);
        setTotal(data.pagination?.total ?? data.decisions.length);
      } else {
        setErr(error ?? "Indisponível");
        setRows([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const auditoriaHref = `/tracking/dpilot/p/${projectId}/auditoria`;

  return (
    <Card className="border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuit className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Porque o sistema agiu — motor automático
        </CardTitle>
        <CardDescription>
          Cada decisão inclui motivo persistido pelo servidor e uma sugestão de próximo passo. As redes continuam a licitar;
          nós orquestramos, limitamos e explicamos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows === null ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full max-w-lg" />
          </div>
        ) : err ? (
          <p className="text-sm text-muted-foreground">{err}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ainda não há decisões do optimizer neste projecto. Quando{" "}
            <code className="rounded bg-muted px-1 text-[11px]">PAID_OPTIMIZER_ENABLED=true</code> estiver activo no
            servidor, os eventos aparecem aqui com explicação legível.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const ex = explainOptimizerDecision(row);
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pt-PT", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}{" "}
                    · {row.campaign_name ?? "Campanha"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{ex.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ex.why}</p>
                  {ex.signals.length > 0 ? (
                    <ul className="mt-1.5 list-inside list-disc text-[11px] text-muted-foreground">
                      {ex.signals.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : null}
                  {ex.nextSuggestedAction ? (
                    <p className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[11px] leading-snug text-emerald-950 dark:text-emerald-50/95">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-200">Próxima acção sugerida:</span>{" "}
                      {ex.nextSuggestedAction}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] text-muted-foreground">
            {total > PREVIEW_LIMIT ? (
              <>
                A mostrar {Math.min(PREVIEW_LIMIT, total)} de <strong className="text-foreground">{total}</strong>{" "}
                decisões.
              </>
            ) : rows && rows.length > 0 ? (
              <>{total} decisão(ões) recente(s).</>
            ) : null}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link to={auditoriaHref}>
              Auditoria completa
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
