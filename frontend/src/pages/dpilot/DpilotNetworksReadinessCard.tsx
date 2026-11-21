/**
 * Cockpit multi-rede: ligações, inventário, landings, Autopilot (só leitura).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Gauge, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { paidAdsService } from "@/services/paidAdsService";

export function DpilotNetworksReadinessCard({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["paid-networks-readiness", projectId],
    queryFn: async () => {
      const { data: body, error } = await paidAdsService.getNetworksReadiness(projectId);
      if (error) throw new Error(error);
      return body;
    },
    staleTime: 45_000,
    enabled: Boolean(projectId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prontidão multi-rede</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> A avaliar Google · Meta · TikTok…
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prontidão multi-rede</CardTitle>
          <CardDescription>Falha ao carregar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const score = data.score.value;
  const row = (
    label: string,
    href: string,
    n: {
      connected: boolean;
      linked: number;
      campaigns: number;
      live: number;
      manager_ready: boolean;
      missing_landing?: number;
      missing_ad?: number;
    },
  ) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {n.connected ? "OAuth OK" : "Sem OAuth"} · {n.linked}/{n.campaigns} ligadas · {n.live} live
          {typeof n.missing_landing === "number" && n.missing_landing > 0
            ? ` · ${n.missing_landing} sem landing Clickora`
            : ""}
          {typeof n.missing_ad === "number" && n.missing_ad > 0
            ? ` · ${n.missing_ad} sem anúncio`
            : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={n.manager_ready ? "secondary" : "outline"}>
          {n.manager_ready ? "Manager pronto" : "Ligar conta"}
        </Badge>
        <Button size="sm" variant="outline" asChild>
          <Link to={href}>Abrir</Link>
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-primary" aria-hidden />
          Prontidão multi-rede
          <Badge variant="outline" className="ml-auto tabular-nums">
            {score}/100
          </Badge>
        </CardTitle>
        <CardDescription>
          Ligações + inventário + landings Clickora. Autopilot:{" "}
          {data.optimizer.enabled
            ? data.optimizer.dry_run
              ? "ligado (dry-run)"
              : `live · ${data.optimizer.rules_phase}`
            : "desligado no servidor"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {row("Google Ads", `/tracking/dpilot/p/${projectId}/google/visao`, data.google)}
        {row("Meta Ads", `/tracking/dpilot/p/${projectId}/meta/visao`, data.meta)}
        {row("TikTok Ads", `/tracking/dpilot/p/${projectId}/tiktok/visao`, data.tiktok)}
        {(data.tiktok.missing_ad > 0 || data.meta.missing_landing > 0) && (
          <Alert>
            <AlertTitle>Acções recomendadas</AlertTitle>
            <AlertDescription className="text-xs">
              {data.tiktok.missing_ad > 0
                ? `${data.tiktok.missing_ad} campanha(s) TikTok sem anúncio — anexe vídeo/imagem no manager. `
                : null}
              {data.meta.missing_landing > 0
                ? `${data.meta.missing_landing} Meta sem landing Clickora — importe com landing ou edite o criativo.`
                : null}
            </AlertDescription>
          </Alert>
        )}
        <p className="text-[11px] text-muted-foreground">{data.optimizer.note}</p>
      </CardContent>
    </Card>
  );
}
