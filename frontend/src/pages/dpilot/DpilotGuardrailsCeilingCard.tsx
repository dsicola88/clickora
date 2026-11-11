import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
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

/** Teto diário por campanha — base para todas as propostas de orçamento neste projeto (automático ou com aprovação). */
export function DpilotGuardrailsCeilingCard() {
  const { t } = useAppLocale();
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
      toast.error(t("pages.dpilot.common.guardrailsNotLoaded"));
      return;
    }
    const n = parseFloat(usdStr.replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t("pages.dpilot.guardrails.ceiling.invalid"));
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
      toast.success(t("pages.dpilot.guardrails.ceiling.updated"), {
        description: t("pages.dpilot.guardrails.ceiling.updatedDesc"),
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
    <Card className="border-blue-600/14 shadow-sm dark:border-blue-400/22">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("pages.dpilot.guardrails.ceiling.title")}</CardTitle>
        <CardDescription>{t("pages.dpilot.guardrails.ceiling.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewMicros != null ? (
          <p className="text-sm text-muted-foreground">
            {t("pages.dpilot.guardrails.ceiling.current")}{" "}
            <strong className="font-semibold tabular-nums text-foreground">{formatUsdFromMicros(previewMicros)}</strong>
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="guardrails-daily-usd">{t("pages.dpilot.guardrails.ceiling.label")}</Label>
          <Input
            id="guardrails-daily-usd"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("pages.dpilot.guardrails.ceiling.placeholder")}
            value={usdStr}
            onChange={(e) => setUsdStr(e.target.value)}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("pages.dpilot.guardrails.ceiling.help")}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving || !gr}>
          {saving ? t("pages.dpilot.common.saving") : t("pages.dpilot.guardrails.ceiling.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
