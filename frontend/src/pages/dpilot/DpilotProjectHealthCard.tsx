import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { paidAdsService } from "@/services/paidAdsService";

/**
 * Saúde Paid por projecto — spend × conversões × decisões (roadmap curto Autopilot).
 * Não inventa funil: só agrega o que o motor já usa.
 */
export function DpilotProjectHealthCard({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["paid-project-health", projectId],
    queryFn: async () => {
      const { data: body, error } = await paidAdsService.getProjectHealthSummary(projectId);
      if (error) throw new Error(error);
      return body;
    },
    staleTime: 60_000,
    enabled: Boolean(projectId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" aria-hidden />
            Saúde do projecto
          </CardTitle>
          <CardDescription>Não foi possível carregar spend × conversões × decisões.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totals.campaigns === 0) {
    return (
      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" aria-hidden />
            Saúde do projecto
          </CardTitle>
          <CardDescription>
            Ainda sem campanhas neste projecto — publique um rascunho ou sincronize a conta de anúncios.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const t = data.totals;
  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          Saúde do projecto
        </CardTitle>
        <CardDescription>
          Últimas {data.lookback_hours}h de tracking · decisões 7d · modo {data.paid_mode}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Campanhas" value={String(t.campaigns)} />
          <Metric label="Cliques" value={String(t.clicks)} />
          <Metric label="Vendas" value={String(t.approved_conversions)} />
          <Metric label="Receita" value={`$${t.revenue_usd.toFixed(2)}`} />
          <Metric label="Spend" value={`$${t.spend_usd.toFixed(2)}`} />
          <Metric label="ROAS" value={t.roas != null ? String(t.roas) : "—"} />
          <Metric label="Decisões 7d" value={String(t.decisions_total_7d)} />
          <Metric
            label="Spend cego"
            value={String(t.spend_unknown_campaigns)}
            hint="Campanhas sem gasto da API"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground" title={hint}>
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
