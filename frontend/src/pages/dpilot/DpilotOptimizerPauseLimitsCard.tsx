import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";

type Gr = {
  max_daily_budget_micros: number;
  max_monthly_spend_micros: number;
  max_cpc_micros: number | null;
  allowed_countries: string[];
  blocked_keywords: string[];
  require_approval_above_micros: number | null;
  optimizer_pause_spend_usd?: number | null;
  optimizer_pause_min_clicks?: number | null;
};

/**
 * Limiares por projecto para a regra «gasto sem conversão → pausa» (optimizer + guardrails).
 */
export function DpilotOptimizerPauseLimitsCard() {
  const { projectId, overview, reload } = useDpilotPaid();
  const gr = overview?.guardrails as Gr | undefined;

  const [pauseUsd, setPauseUsd] = useState("");
  const [minClicks, setMinClicks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gr) return;
    setPauseUsd(
      gr.optimizer_pause_spend_usd != null && Number.isFinite(Number(gr.optimizer_pause_spend_usd))
        ? String(gr.optimizer_pause_spend_usd)
        : "",
    );
    setMinClicks(
      gr.optimizer_pause_min_clicks != null && Number.isFinite(Number(gr.optimizer_pause_min_clicks))
        ? String(gr.optimizer_pause_min_clicks)
        : "",
    );
  }, [gr]);

  const onSave = async () => {
    if (!gr) {
      toast.error("Guardrails ainda não carregados.");
      return;
    }

    let optimizer_pause_spend_usd: number | null = null;
    if (pauseUsd.trim() !== "") {
      const n = parseFloat(pauseUsd.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Gasto mínimo: indique um número USD positivo ou deixe vazio.");
        return;
      }
      optimizer_pause_spend_usd = n;
    }

    let optimizer_pause_min_clicks: number | null = null;
    if (minClicks.trim() !== "") {
      const n = parseInt(minClicks.trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 500) {
        toast.error("Mínimo de cliques: inteiro entre 0 e 500, ou vazio.");
        return;
      }
      optimizer_pause_min_clicks = n;
    }

    setSaving(true);
    try {
      const { error } = await paidAdsService.upsertGuardrails({
        projectId,
        max_daily_budget_micros: gr.max_daily_budget_micros,
        max_monthly_spend_micros: gr.max_monthly_spend_micros,
        max_cpc_micros: gr.max_cpc_micros,
        allowed_countries: gr.allowed_countries,
        blocked_keywords: gr.blocked_keywords,
        require_approval_above_micros: gr.require_approval_above_micros,
        optimizer_pause_spend_usd,
        optimizer_pause_min_clicks,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Limites do motor guardados.");
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-sky-500/15 bg-sky-500/[0.03]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Pausa automática sem conversões
          <span className="text-[11px] font-normal text-muted-foreground">(optimizer)</span>
        </CardTitle>
        <CardDescription>
          Na janela de análise do motor, campanhas <strong className="font-medium text-foreground">live</strong> são
          pausadas quando o gasto nas redes ≥ este limiar USD e não há conversões atribuídas no tracking, com pelo menos{" "}
          <strong className="font-medium text-foreground">N</strong> cliques. Se houver conversões (ou lucro suficiente
          para ROAS), a regra de pausa não aplica dessa forma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-muted">
          <Info className="h-4 w-4 text-muted-foreground" />
          <AlertTitle className="text-sm">Opcional por projecto</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
            Campos <strong className="text-foreground font-medium">vazios</strong> revertem aos valores globais (
            variáveis <code className="text-[11px]">PAID_OPTIMIZER_PAUSE_SPEND_USD</code> e{" "}
            <code className="text-[11px]">PAID_OPTIMIZER_PAUSE_MIN_CLICKS</code>). O motor deve estar ligado (
            <code className="text-[11px]">PAID_OPTIMIZER_ENABLED=true</code>) e, para alterar mesmo na conta, modo
            Autopilot ou fluxo próprio conforme já documentado). Apenas admins do workspace podem gravar aqui.
          </AlertDescription>
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opt-pause-usd">Gasto máximo antes de pausar sem conversões (USD)</Label>
            <Input
              id="opt-pause-usd"
              inputMode="decimal"
              placeholder="Ex.: 50 — vazio = servidor"
              value={pauseUsd}
              onChange={(e) => setPauseUsd(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Comparado ao gasto reportado pela API Google/Meta/TikTok no período.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opt-min-cliques">Cliques mínimos no período</Label>
            <Input
              id="opt-min-cliques"
              inputMode="numeric"
              placeholder="Ex.: 5 — vazio = servidor"
              value={minClicks}
              onChange={(e) => setMinClicks(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Evita pausar com tráfego ainda insignificante.</p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving || !gr}>
          {saving ? "A guardar…" : "Guardar limites do motor"}
        </Button>
      </CardContent>
    </Card>
  );
}
