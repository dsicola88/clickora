import { useEffect, useState } from "react";
import { Globe, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleAdsCountriesSelect } from "@/components/dpilot/GoogleAdsTargetingSelect";
import { GOOGLE_ADS_COUNTRY_OPTIONS } from "@/lib/googleAdsTargeting";
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
};

function microsToUsdInput(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(Number(m))) return "";
  const usd = Number(m) / 1_000_000;
  return Number.isFinite(usd) ? String(usd) : "";
}

/** Países permitidos, palavras bloqueadas e limites complementares (mensal, CPC, aprovação). Apenas admins do workspace. */
export function DpilotGuardrailsScopeCard() {
  const { t } = useAppLocale();
  const { projectId, overview, reload } = useDpilotPaid();
  const gr = overview?.guardrails as Gr | undefined;

  const [countries, setCountries] = useState<string[]>([]);
  const [blockedText, setBlockedText] = useState("");
  const [monthlyUsd, setMonthlyUsd] = useState("");
  const [maxCpcUsd, setMaxCpcUsd] = useState("");
  const [approvalUsd, setApprovalUsd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gr) return;
    setCountries(
      Array.isArray(gr.allowed_countries)
        ? gr.allowed_countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
        : [],
    );
    setBlockedText(Array.isArray(gr.blocked_keywords) ? gr.blocked_keywords.join("\n") : "");
    setMonthlyUsd(microsToUsdInput(gr.max_monthly_spend_micros));
    setMaxCpcUsd(microsToUsdInput(gr.max_cpc_micros ?? null));
    setApprovalUsd(microsToUsdInput(gr.require_approval_above_micros ?? null));
  }, [gr]);

  const onSave = async () => {
    if (!gr) {
      toast.error(t("pages.dpilot.common.guardrailsNotLoaded"));
      return;
    }
    const monthly = parseFloat(monthlyUsd.replace(",", ".").trim());
    if (!Number.isFinite(monthly) || monthly <= 0) {
      toast.error(t("pages.dpilot.guardrails.scope.monthlyInvalid"));
      return;
    }

    let maxCpcMicros: number | null = null;
    if (maxCpcUsd.trim() !== "") {
      const x = parseFloat(maxCpcUsd.replace(",", "."));
      if (!Number.isFinite(x) || x <= 0) {
        toast.error(t("pages.dpilot.guardrails.scope.cpcInvalid"));
        return;
      }
      maxCpcMicros = Math.round(x * 1_000_000);
    }

    let requireApprovalAboveMicros: number | null = null;
    if (approvalUsd.trim() !== "") {
      const x = parseFloat(approvalUsd.replace(",", "."));
      if (!Number.isFinite(x) || x < 0) {
        toast.error(t("pages.dpilot.guardrails.scope.approvalInvalid"));
        return;
      }
      requireApprovalAboveMicros = Math.round(x * 1_000_000);
    }

    const blockedArr = blockedText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);

    const allowedNorm = countries.map((c) => c.trim().toUpperCase()).filter(Boolean).slice(0, 50);

    setSaving(true);
    try {
      const { error } = await paidAdsService.upsertGuardrails({
        projectId,
        max_daily_budget_micros: gr.max_daily_budget_micros,
        max_monthly_spend_micros: Math.round(monthly * 1_000_000),
        max_cpc_micros: maxCpcMicros,
        allowed_countries: allowedNorm,
        blocked_keywords: blockedArr,
        require_approval_above_micros: requireApprovalAboveMicros,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(t("pages.dpilot.guardrails.scope.saved"), {
        description:
          allowedNorm.length === 0
            ? t("pages.dpilot.guardrails.scope.savedOpen")
            : t("pages.dpilot.guardrails.scope.savedClosed"),
      });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const dailyPreview =
    gr?.max_daily_budget_micros != null && Number.isFinite(Number(gr.max_daily_budget_micros))
      ? Number(gr.max_daily_budget_micros)
      : null;

  return (
    <Card id="dpilot-guardrails-scope" className="border-violet-500/15 bg-violet-500/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          {t("pages.dpilot.guardrails.scope.title")}
        </CardTitle>
        <CardDescription>
          {t("pages.dpilot.guardrails.scope.descBefore")}
          <strong>{t("pages.dpilot.guardrails.scope.dailyCap")}</strong>
          {t("pages.dpilot.guardrails.scope.descAfter")}
        </CardDescription>
        {dailyPreview != null ? (
          <p className="text-xs text-muted-foreground pt-1">
            {t("pages.dpilot.guardrails.scope.dailyRef")}{" "}
            <strong className="tabular-nums text-foreground">{formatUsdFromMicros(dailyPreview)}</strong>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <GoogleAdsCountriesSelect
          label={t("pages.dpilot.guardrails.scope.countriesLabel")}
          hint={t("pages.dpilot.guardrails.scope.countriesHint")}
          searchPlaceholder={t("pages.dpilot.guardrails.scope.searchPlaceholder")}
          emptyText={t("pages.dpilot.guardrails.scope.emptyCountries")}
          options={GOOGLE_ADS_COUNTRY_OPTIONS}
          value={countries}
          onChange={setCountries}
          max={50}
        />

        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] text-muted-foreground w-full">{t("pages.dpilot.guardrails.scope.shortcuts")}</span>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCountries([])}>
            {t("pages.dpilot.guardrails.scope.allCountries")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCountries(["BR", "PT"])}>
            {t("pages.dpilot.guardrails.scope.brPt")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCountries(["US"])}>
            {t("pages.dpilot.guardrails.scope.usOnly")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCountries(["BR", "PT", "US", "GB", "DE", "FR", "ES"])}
          >
            BR · PT · US · UK · DE · FR · ES
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="gr-blocked">{t("pages.dpilot.guardrails.scope.blockedLabel")}</Label>
            <Textarea
              id="gr-blocked"
              value={blockedText}
              onChange={(e) => setBlockedText(e.target.value)}
              rows={4}
              placeholder={t("pages.dpilot.guardrails.scope.blockedPlaceholder")}
              className="font-mono text-xs sm:text-sm"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("pages.dpilot.guardrails.scope.blockedHelp")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gr-monthly">{t("pages.dpilot.guardrails.scope.monthlyLabel")}</Label>
            <Input
              id="gr-monthly"
              inputMode="decimal"
              autoComplete="off"
              value={monthlyUsd}
              onChange={(e) => setMonthlyUsd(e.target.value)}
              placeholder={t("pages.dpilot.guardrails.scope.monthlyPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gr-approval">{t("pages.dpilot.guardrails.scope.approvalLabel")}</Label>
            <Input
              id="gr-approval"
              inputMode="decimal"
              autoComplete="off"
              value={approvalUsd}
              onChange={(e) => setApprovalUsd(e.target.value)}
              placeholder={t("pages.dpilot.guardrails.scope.approvalPlaceholder")}
            />
            <p className="text-[11px] text-muted-foreground">{t("pages.dpilot.guardrails.scope.approvalHelp")}</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="gr-cpc">{t("pages.dpilot.guardrails.scope.cpcLabel")}</Label>
            <Input
              id="gr-cpc"
              inputMode="decimal"
              autoComplete="off"
              value={maxCpcUsd}
              onChange={(e) => setMaxCpcUsd(e.target.value)}
              placeholder={t("pages.dpilot.guardrails.scope.cpcPlaceholder")}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <Globe className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
          <p className="leading-relaxed">{t("pages.dpilot.guardrails.scope.footnote")}</p>
        </div>

        <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving || !gr}>
          {saving ? t("pages.dpilot.common.saving") : t("pages.dpilot.guardrails.scope.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
