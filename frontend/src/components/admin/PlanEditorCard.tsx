import { useEffect, useState } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdminPlanRow } from "@/types/api";
import { adminService } from "@/services/adminService";
import { toast } from "sonner";
import { formatPlanPrice, mergeWithDefaultLabels } from "@/lib/planDisplayLabels";
import { freeTextEmbedsNumericQuota } from "@/lib/planCommercialText";

type Props = {
  plan: AdminPlanRow;
  onSaved: () => void;
  /** Moeda e formatação alinhadas com a landing /planos (opcional). */
  priceLabels?: Record<string, string> | null;
};

export function PlanEditorCard({ plan, onSaved, priceLabels }: Props) {
  const { t } = useAppLocale();
  const lb = mergeWithDefaultLabels(priceLabels ?? undefined);
  const [name, setName] = useState(plan.name);
  const [priceInput, setPriceInput] = useState((plan.price_cents / 100).toFixed(2));
  const [maxPages, setMaxPages] = useState(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
  const [maxClicks, setMaxClicks] = useState(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
  const [maxCustomDomains, setMaxCustomDomains] = useState(String(plan.max_custom_domains ?? 0));
  const [maxPresellAi, setMaxPresellAi] = useState(
    plan.max_presell_ai_generations != null ? String(plan.max_presell_ai_generations) : "",
  );
  const [maxWorkspaceMembers, setMaxWorkspaceMembers] = useState(
    plan.max_workspace_members != null ? String(plan.max_workspace_members) : "",
  );
  const [maxTrafficRotators, setMaxTrafficRotators] = useState(
    plan.max_traffic_rotators != null ? String(plan.max_traffic_rotators) : "",
  );
  const [hasBranding, setHasBranding] = useState(plan.has_branding);
  const [affiliateWebhook, setAffiliateWebhook] = useState(plan.affiliate_webhook_enabled ?? false);
  const [dpilotAds, setDpilotAds] = useState(plan.dpilot_ads_enabled ?? false);
  const [featuresText, setFeaturesText] = useState(() => (plan.features ?? []).join("\n"));
  const [ctaLabel, setCtaLabel] = useState(plan.cta_label ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(plan.name);
    setPriceInput((plan.price_cents / 100).toFixed(2));
    setMaxPages(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
    setMaxClicks(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
    setMaxCustomDomains(String(plan.max_custom_domains ?? 0));
    setMaxPresellAi(plan.max_presell_ai_generations != null ? String(plan.max_presell_ai_generations) : "");
    setMaxWorkspaceMembers(plan.max_workspace_members != null ? String(plan.max_workspace_members) : "");
    setMaxTrafficRotators(plan.max_traffic_rotators != null ? String(plan.max_traffic_rotators) : "");
    setHasBranding(plan.has_branding);
    setAffiliateWebhook(plan.affiliate_webhook_enabled ?? false);
    setDpilotAds(plan.dpilot_ads_enabled ?? false);
    setFeaturesText((plan.features ?? []).join("\n"));
    setCtaLabel(plan.cta_label ?? "");
  }, [plan]);

  const reset = () => {
    setName(plan.name);
    setPriceInput((plan.price_cents / 100).toFixed(2));
    setMaxPages(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
    setMaxClicks(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
    setMaxCustomDomains(String(plan.max_custom_domains ?? 0));
    setMaxPresellAi(plan.max_presell_ai_generations != null ? String(plan.max_presell_ai_generations) : "");
    setMaxWorkspaceMembers(plan.max_workspace_members != null ? String(plan.max_workspace_members) : "");
    setMaxTrafficRotators(plan.max_traffic_rotators != null ? String(plan.max_traffic_rotators) : "");
    setHasBranding(plan.has_branding);
    setAffiliateWebhook(plan.affiliate_webhook_enabled ?? false);
    setDpilotAds(plan.dpilot_ads_enabled ?? false);
    setFeaturesText((plan.features ?? []).join("\n"));
    setCtaLabel(plan.cta_label ?? "");
  };

  const save = async () => {
    const parsed = parseFloat(priceInput.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error(t("pages.admin.plan.invalidPrice"));
      return;
    }
    const price_cents = Math.round(parsed * 100);
    let max_presell_pages: number | null = null;
    if (maxPages.trim() !== "") {
      const n = parseInt(maxPages, 10);
      if (Number.isNaN(n) || n < 0) {
        toast.error(t("pages.admin.plan.invalidPages"));
        return;
      }
      max_presell_pages = n;
    }
    let max_clicks_per_month: number | null = null;
    if (maxClicks.trim() !== "") {
      const n = parseInt(maxClicks, 10);
      if (Number.isNaN(n) || n < 0) {
        toast.error(t("pages.admin.plan.invalidClicks"));
        return;
      }
      max_clicks_per_month = n;
    }
    const mcd = parseInt(maxCustomDomains, 10);
    if (Number.isNaN(mcd) || mcd < 0 || mcd > 50) {
      toast.error(t("pages.admin.plan.invalidDomains"));
      return;
    }
    let max_presell_ai_generations: number | null = null;
    if (maxPresellAi.trim() !== "") {
      const n = parseInt(maxPresellAi, 10);
      if (Number.isNaN(n) || n < 0 || n > 10_000) {
        toast.error(t("pages.admin.plan.invalidAi"));
        return;
      }
      max_presell_ai_generations = n;
    }
    let max_workspace_members: number | null = null;
    if (maxWorkspaceMembers.trim() !== "") {
      const n = parseInt(maxWorkspaceMembers, 10);
      if (Number.isNaN(n) || n < 0 || n > 500) {
        toast.error(t("pages.admin.plan.invalidMembers"));
        return;
      }
      max_workspace_members = n;
    }
    let max_traffic_rotators: number | null = null;
    if (maxTrafficRotators.trim() !== "") {
      const n = parseInt(maxTrafficRotators, 10);
      if (Number.isNaN(n) || n < 0 || n > 10_000) {
        toast.error(t("pages.admin.plan.invalidRotators"));
        return;
      }
      max_traffic_rotators = n;
    }

    const features = featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (features.some((line) => freeTextEmbedsNumericQuota(line))) {
      toast.error(t("pages.admin.plan.numericQuota"));
      return;
    }
    if (plan.type !== "free_trial" && price_cents === 0) {
      toast.error(t("pages.admin.plan.paidZero"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await adminService.updatePlan(plan.id, {
        name,
        price_cents,
        max_presell_pages,
        max_clicks_per_month,
        max_custom_domains: mcd,
        max_presell_ai_generations,
        max_workspace_members,
        max_traffic_rotators,
        has_branding: hasBranding,
        affiliate_webhook_enabled: affiliateWebhook,
        dpilot_ads_enabled: dpilotAds,
        features,
        cta_label: ctaLabel.trim() === "" ? null : ctaLabel.trim(),
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(t("pages.admin.plan.updated"));
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>{plan.name}</span>
          <code className="text-xs font-normal bg-muted px-2 py-0.5 rounded">{plan.type}</code>
        </CardTitle>
        <CardDescription>
          {fill(t("pages.admin.plan.preview"), { price: formatPlanPrice(plan.price_cents, lb) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`n-${plan.id}`}>{t("pages.admin.plan.commercialName")}</Label>
            <Input id={`n-${plan.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`p-${plan.id}`}>{t("pages.admin.plan.priceShown")}</Label>
            <Input
              id={`p-${plan.id}`}
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("pages.admin.plan.priceHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mp-${plan.id}`}>{t("pages.admin.plan.maxPages")}</Label>
            <Input
              id={`mp-${plan.id}`}
              placeholder="—"
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mc-${plan.id}`}>{t("pages.admin.plan.clicksQuota")}</Label>
            <Input
              id={`mc-${plan.id}`}
              placeholder="—"
              value={maxClicks}
              onChange={(e) => setMaxClicks(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("pages.admin.plan.quotaHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mcd-${plan.id}`}>{t("pages.admin.plan.maxDomains")}</Label>
            <Input
              id={`mcd-${plan.id}`}
              inputMode="numeric"
              value={maxCustomDomains}
              onChange={(e) => setMaxCustomDomains(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("pages.admin.plan.maxDomainsHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mai-${plan.id}`}>{t("pages.admin.plan.maxAi")}</Label>
            <Input
              id={`mai-${plan.id}`}
              inputMode="numeric"
              placeholder={t("pages.admin.plan.maxAiPlaceholder")}
              value={maxPresellAi}
              onChange={(e) => setMaxPresellAi(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("pages.admin.plan.maxAiHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mwm-${plan.id}`}>{t("pages.admin.plan.maxMembers")}</Label>
            <Input
              id={`mwm-${plan.id}`}
              inputMode="numeric"
              placeholder={t("pages.admin.plan.maxMembersPlaceholder")}
              value={maxWorkspaceMembers}
              onChange={(e) => setMaxWorkspaceMembers(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("pages.admin.plan.maxMembersHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mtr-${plan.id}`}>{t("pages.admin.plan.maxRotators")}</Label>
            <Input
              id={`mtr-${plan.id}`}
              inputMode="numeric"
              placeholder={t("pages.admin.plan.maxRotatorsPlaceholder")}
              value={maxTrafficRotators}
              onChange={(e) => setMaxTrafficRotators(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("pages.admin.plan.maxRotatorsHint")}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`f-${plan.id}`}>{t("pages.admin.plan.extraText")}</Label>
          <Textarea
            id={`f-${plan.id}`}
            rows={6}
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            className="resize-y font-mono text-sm"
            placeholder={t("pages.admin.plan.extraPlaceholder")}
          />
          <p className="text-[11px] text-muted-foreground leading-snug">
            {t("pages.admin.plan.extraHint")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cta-${plan.id}`}>{t("pages.admin.plan.cta")}</Label>
          <Input
            id={`cta-${plan.id}`}
            placeholder={t("pages.admin.plan.ctaPlaceholder")}
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <Label htmlFor={`br-${plan.id}`} className="cursor-pointer">
            {t("pages.admin.plan.branding")}
          </Label>
          <Switch id={`br-${plan.id}`} checked={hasBranding} onCheckedChange={setHasBranding} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <div className="pr-3">
            <Label htmlFor={`wh-${plan.id}`} className="cursor-pointer">
              {t("pages.admin.plan.webhook")}
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {t("pages.admin.plan.webhookHint")}
            </p>
          </div>
          <Switch id={`wh-${plan.id}`} checked={affiliateWebhook} onCheckedChange={setAffiliateWebhook} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <div className="pr-3">
            <Label htmlFor={`dp-${plan.id}`} className="cursor-pointer">
              {t("pages.admin.plan.ads")}
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {t("pages.admin.plan.adsHint")}
            </p>
          </div>
          <Switch id={`dp-${plan.id}`} checked={dpilotAds} onCheckedChange={setDpilotAds} />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={reset} disabled={loading}>
            {t("pages.admin.plan.reset")}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={loading || !name.trim()}>
            {loading ? t("common.saving") : t("pages.admin.plan.savePlan")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
