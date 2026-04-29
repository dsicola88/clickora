import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
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

/** Teto de orçamento diário guardado em BD (guardrails) — edição por admins do workspace. */
export function DpilotGuardrailsCeilingCard() {
  const { projectId, overview, reload } = useDpilotPaid();
  const gr = overview?.guardrails as Gr | undefined;
  const [usdStr, setUsdStr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gr) return;
    const usd = Number(gr.max_daily_budget_micros) / 1_000_000;
    setUsdStr(Number.isFinite(usd) ? String(usd) : "");
  }, [gr]);

  const onSave = async () => {
    if (!gr) {
      toast.error("Guardrails ainda não carregados.");
      return;
    }
    const n = parseFloat(usdStr.replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Indique um teto diário válido em USD (ex.: 100).");
      return;
    }

    const maxDailyBudgetMicros = Math.round(n * 1_000_000);
    setSaving(true);
    try {
      const { error } = await paidAdsService.upsertGuardrails({
        projectId,
        max_daily_budget_micros: maxDailyBudgetMicros,
        max_monthly_spend_micros: gr.max_monthly_spend_micros,
        max_cpc_micros: gr.max_cpc_micros,
        allowed_countries: gr.allowed_countries,
        blocked_keywords: gr.blocked_keywords,
        require_approval_above_micros: gr.require_approval_above_micros,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Teto de orçamento diário actualizado.", {
        description: "Este valor será usado nas aprovações e no botão para alinhar orçamentos.",
      });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const previewMicros =
    gr?.max_daily_budget_micros != null && Number.isFinite(Number(gr.max_daily_budget_micros))
      ? Number(gr.max_daily_budget_micros)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Limites de segurança</CardTitle>
        <CardDescription>Orçamento máximo diário por campanha (guardrails neste projecto)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewMicros != null ? (
          <p className="text-sm text-muted-foreground">
            Actualmente registado como{" "}
            <strong className="font-medium tabular-nums text-foreground">{formatUsdFromMicros(previewMicros)}</strong>{" "}
            por dia.
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="guardrails-daily-usd">Novo teto diário máximo (USD)</Label>
          <Input
            id="guardrails-daily-usd"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex.: 150"
            value={usdStr}
            onChange={(e) => setUsdStr(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            O montante aparece como limite nas aprovações e nos botões de alinhamento rápido — definido pelo{" "}
            <strong className="font-medium text-foreground">workspace</strong> (não vale fixado na «aplicação»). Novos
            projectos podem começar com um valor inicial na base de dados até ser alterado aqui. Apenas administradores do
            workspace podem gravar guardrails completos via API — se vir erro de permissão, peça ao responsável pela equipa.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving || !gr}>
          {saving ? "A guardar…" : "Guardar teto diário"}
        </Button>
      </CardContent>
    </Card>
  );
}
