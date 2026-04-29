import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { optimizerRuleCodeLabel } from "@/lib/paidAdsUi";
import { paidAdsService, type OptimizerDecisionRow } from "@/services/paidAdsService";

const FETCH_LIMIT = 250;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function cutoffISO(): string {
  return new Date(Date.now() - WEEK_MS).toISOString();
}

/** Agrega decisões do motor nos últimos 7 dias (para Visão geral). */
export function DpilotWeeklyMotorDigestCard({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<OptimizerDecisionRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void paidAdsService.listOptimizerDecisions(projectId, { limit: FETCH_LIMIT }).then(({ data, error }) => {
      if (cancelled) return;
      if (data?.decisions) {
        setRows(data.decisions);
      } else {
        setErr(error ?? "Indisponível");
        setRows([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const cutoff = useMemo(() => cutoffISO(), []);

  const weekly = useMemo(() => {
    if (!rows) return [];
    const c = Date.parse(cutoff);
    return rows.filter((r) => Number.isFinite(c) && Date.parse(r.created_at) >= c);
  }, [rows, cutoff]);

  const countsByRule = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of weekly) {
      const k = r.rule_code || "(sem código)";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [weekly]);

  const auditoriaHref = `/tracking/dpilot/p/${projectId}/auditoria`;

  return (
    <Card className="border-teal-500/15 bg-gradient-to-br from-teal-500/[0.04] via-transparent to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          Motor automático — última semana
        </CardTitle>
        <CardDescription>
          Contagem por tipo de regra (decisões registadas nos últimos 7 dias). Os números ajudam a perceber onde o
          sistema interveio com mais frequência.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows === null ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-10 w-full max-w-md" />
          </div>
        ) : err ? (
          <p className="text-sm text-muted-foreground">{err}</p>
        ) : weekly.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sem decisões do motor na última semana — ou o optimizer ainda não correu para este projecto.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {countsByRule.map(([code, n]) => (
              <li
                key={code}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/70 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-muted-foreground" title={code}>
                  {optimizerRuleCodeLabel(code)}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{n}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] text-muted-foreground">
            {weekly.length > 0 ? (
              <>
                Total na janela: <strong className="text-foreground">{weekly.length}</strong> decisão(ões).
              </>
            ) : rows && rows.length > 0 ? (
              <>Pedidos mais antigos que 7 dias na amostra — ver auditoria completa.</>
            ) : null}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link to={auditoriaHref}>Auditoria completa</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
