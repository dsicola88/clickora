import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, HelpCircle, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";
import { cn } from "@/lib/utils";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { useAuth } from "@/contexts/AuthContext";
import {
  presellService,
  type PresellComplianceAuditDto,
  type PresellComplianceResultDto,
  type PresellComplianceSuggestionDto,
} from "@/services/presellService";
import { customDomainService } from "@/services/customDomainService";
import { trafficRotatorsService } from "@/services/trafficRotatorsService";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";
import type { PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { isAffiliateTrustFooterEnabled } from "@/lib/presellAffiliateTrustFooter";

type Props = {
  presellId: string | null;
  configSettings: PresellConfigSettings;
  setConfigSettings: React.Dispatch<React.SetStateAction<PresellConfigSettings>>;
  affiliateDisclosureInContent?: string;
  onAffiliateDisclosureChange?: (value: string) => void;
  /** Nicho black: identidade não se preenche à mão. */
  lockIdentityFromSource?: boolean;
};

function gateLabel(
  t: ReturnType<typeof useAppLocale>["t"],
  gate: string | null | undefined,
  opts?: { warningCount?: number; notCheckedCount?: number },
): string {
  switch (gate) {
    case "ready_for_review": {
      const w = opts?.warningCount ?? 0;
      const n = opts?.notCheckedCount ?? 0;
      if (w > 0 || n > 0) return t("pages.presells.compliance.gateReadyWarnings");
      return t("pages.presells.compliance.gateReady");
    }
    case "needs_review":
      return t("pages.presells.compliance.gateNeedsReview");
    case "blocked":
      return t("pages.presells.compliance.gateBlocked");
    case "checking":
      return t("pages.presells.compliance.gateChecking");
    default:
      return t("pages.presells.compliance.gateUnchecked");
  }
}

function statusIcon(status: string) {
  if (status === "PASS") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  if (status === "FAIL") return <ShieldAlert className="h-3.5 w-3.5 text-destructive" aria-hidden />;
  if (status === "WARNING") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
  return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
}

function RuleRow({
  r,
  onDispute,
}: {
  r: PresellComplianceResultDto;
  onDispute?: (ruleId: string) => void;
}) {
  const { t } = useAppLocale();
  return (
    <li className="rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        {statusIcon(r.status)}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{r.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.ruleId}</span>
            <span className="text-[10px] text-muted-foreground">{r.status}</span>
            <span className="text-[10px] text-muted-foreground">{r.severity}</span>
          </div>
          <p className="text-xs text-muted-foreground">{r.evidence?.summary}</p>
          {r.status !== "PASS" ? (
            <p className="text-xs text-foreground/90">
              <span className="font-medium">{t("pages.presells.compliance.fixLabel")} </span>
              {r.remediation}
            </p>
          ) : null}
          {r.sourceIds?.length ? (
            <p className="text-[10px] text-muted-foreground">
              {fill(t("pages.presells.compliance.sources"), {
                sources: r.sourceIds.join(", "),
                date: r.sourceReviewedAt,
              })}
            </p>
          ) : null}
          {r.status === "FAIL" && onDispute ? (
            <Button type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={() => onDispute(r.ruleId)}>
              {t("pages.presells.compliance.disputeFalsePositive")}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function PresellAdsCompliancePanel({
  presellId,
  configSettings,
  setConfigSettings,
  affiliateDisclosureInContent,
  onAffiliateDisclosureChange,
  lockIdentityFromSource = false,
}: Props) {
  const { t } = useAppLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [disputeRuleId, setDisputeRuleId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disapprovalText, setDisapprovalText] = useState("");
  const [disapprovalHints, setDisapprovalHints] = useState<
    Array<{ code: string; title: string; steps: string[] }>
  >([]);

  const tenantKey = tenantQueryKey(user);
  const queryKey = ["presell-compliance", tenantKey, presellId] as const;
  const quotaKey = ["presell-ai-quota", tenantKey] as const;

  const { data, isLoading, error } = useQuery({
    queryKey,
    enabled: Boolean(presellId),
    queryFn: async () => {
      const { data: body, error: err } = await presellService.getCompliance(presellId!);
      if (err || !body) throw new Error(err || t("pages.presells.compliance.loadFail"));
      return body;
    },
  });

  const { data: aiQuota } = useQuery({
    queryKey: quotaKey,
    enabled: Boolean(presellId),
    queryFn: async () => {
      const { data: body, error: err } = await presellService.getAiQuota();
      if (err || !body) throw new Error(err || t("pages.presells.compliance.quotaFail"));
      return body;
    },
    staleTime: 30_000,
  });

  const auditMutation = useMutation({
    mutationFn: async () => {
      const { data: body, error: err } = await presellService.runComplianceAudit(presellId!);
      if (err || !body) throw new Error(err || t("pages.presells.compliance.auditFail"));
      return body;
    },
    onSuccess: () => {
      toast.success(t("pages.presells.compliance.auditDone"));
      void qc.invalidateQueries({ queryKey: [...queryKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: async (force: boolean) => {
      const { data: body, error: err } = await presellService.generateReviewCopy(presellId!, {
        force,
      });
      if (err || !body) throw new Error(err || t("pages.presells.compliance.reviewFail"));
      return body;
    },
    onSuccess: (body) => {
      toast.success(
        body.copy.source === "llm"
          ? t("pages.presells.compliance.reviewLlm")
          : t("pages.presells.compliance.reviewDeterministic"),
      );
      void qc.invalidateQueries({ queryKey: [...queryKey] });
      void qc.invalidateQueries({ queryKey: [...quotaKey] });
      void qc.invalidateQueries({ queryKey: ["presells"] });
    },
    onError: (e: Error) => {
      if (/texto longo|force=true|CONTENT_EXISTS/i.test(e.message)) {
        if (window.confirm(t("pages.presells.compliance.replaceLongCopy"))) {
          generateMutation.mutate(true);
        }
        return;
      }
      toast.error(e.message);
    },
  });

  const disapprovalMutation = useMutation({
    mutationFn: async () => {
      const { data: body, error: err } = await presellService.analyzeDisapproval(
        presellId!,
        disapprovalText.trim(),
      );
      if (err || !body) throw new Error(err || t("pages.presells.compliance.disapprovalFail"));
      return body;
    },
    onSuccess: (body) => {
      setDisapprovalHints(body.hints || []);
      toast.success(t("pages.presells.compliance.fixPlanReady"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const packMutation = useMutation({
    mutationFn: async () => {
      const { data: body, error: err } = await presellService.spawnVariantPack(presellId!, {
        create_rotator: true,
      });
      if (err || !body) throw new Error(err || t("pages.presells.compliance.packFail"));

      const packPages = [body.pages.landing, body.pages.review, body.pages.advertorial];
      for (const p of packPages) {
        if (p.status !== "published") {
          await presellService.update(p.id, { status: "published" } as never);
        }
      }

      const { data: domains } = await customDomainService.list();
      const customDomains = domains ?? [];
      const loaded = await Promise.all(
        packPages.map(async (p) => {
          const { data } = await presellService.getById(p.id);
          return data;
        }),
      );
      const byId = new Map(loaded.filter(Boolean).map((p) => [p!.id, p!] as const));
      const basePage = byId.get(presellId!) || loaded[0];
      if (!basePage) {
        return { ...body, rotator_url: null as string | null, rotator_error: t("pages.presells.compliance.basePageMissing") };
      }

      const armFor = (p: { id: string }, label: string, order: number, weight: number) => {
        const full = byId.get(p.id) || basePage;
        return {
          destination_url: getPublicPresellFullUrl(
            customDomains,
            full.custom_domain_id ?? basePage.custom_domain_id ?? null,
            full,
          ),
          label,
          order_index: order,
          weight,
        };
      };
      const rotSlug = `pack-${Date.now().toString(36).slice(-7)}`;
      const { data: rotator, error: rotErr } = await trafficRotatorsService.create({
        name: `3 variantes · ${basePage.title || "presell"}`.slice(0, 120),
        slug: rotSlug,
        mode: "weighted",
        context_presell_id: presellId!,
        is_active: true,
        sticky_session: true,
        arms: [
          armFor(body.pages.landing, "Landing · TSL", 0, 33),
          armFor(body.pages.review, "Review", 1, 33),
          armFor(body.pages.advertorial, "Advertorial", 2, 34),
        ],
      });
      return {
        ...body,
        rotator_url: rotErr ? null : rotator?.public_click_url ?? null,
        rotator_error: rotErr || null,
      };
    },
    onSuccess: (body) => {
      if (body.rotator_url) {
        toast.success(
          fill(t("pages.presells.compliance.packReady"), { source: body.source }),
          { duration: 9000 },
        );
      } else {
        toast.warning(
          fill(t("pages.presells.compliance.packRotatorFail"), {
            source: body.source,
            detail: body.rotator_error ? `: ${body.rotator_error}` : "",
          }),
          { duration: 10000 },
        );
      }
      void qc.invalidateQueries({ queryKey: [...queryKey] });
      void qc.invalidateQueries({ queryKey: [...quotaKey] });
      void qc.invalidateQueries({ queryKey: ["presells"] });
      void qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideMutation = useMutation({
    mutationFn: async () => {
      const auditId = data?.latest_audit?.id;
      if (!auditId || !disputeRuleId) throw new Error(t("pages.presells.compliance.decisionMissing"));
      const { data: body, error: err } = await presellService.submitComplianceDecision(presellId!, {
        audit_id: auditId,
        rule_id: disputeRuleId,
        decision: "override_pass",
        reason: disputeReason.trim(),
      });
      if (err || !body) throw new Error(err || t("pages.presells.compliance.decisionFail"));
      return body;
    },
    onSuccess: () => {
      toast.success(t("pages.presells.compliance.decisionSaved"));
      setDisputeRuleId(null);
      setDisputeReason("");
      void qc.invalidateQueries({ queryKey: [...queryKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setField = useCallback(
    (key: keyof PresellConfigSettings, value: string | boolean) => {
      setConfigSettings((prev) => ({ ...prev, [key]: value }));
    },
    [setConfigSettings],
  );

  const audit = data?.latest_audit as PresellComplianceAuditDto | null | undefined;
  const results = (audit?.results || []) as PresellComplianceResultDto[];
  const suggestions = (data?.suggestions || []) as PresellComplianceSuggestionDto[];
  const critical = results.filter((r) => r.status === "FAIL");
  const warnings = results.filter((r) => r.status === "WARNING");
  const notChecked = results.filter((r) => r.status === "NOT_CHECKED");
  const destinationRules = results.filter((r) => /^DT-/i.test(r.ruleId));
  const destinationOk =
    destinationRules.length > 0 &&
    destinationRules.every((r) => r.status === "PASS" || r.status === "WARNING" || r.status === "NOT_CHECKED") &&
    !destinationRules.some((r) => r.status === "FAIL");
  const destinationFail = destinationRules.some((r) => r.status === "FAIL");
  const gate = data?.compliance_gate || "unchecked";
  const gateOpts = { warningCount: warnings.length, notCheckedCount: notChecked.length };
  const adsScore = data?.ads_page_score ?? null;

  if (!presellId) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {t("pages.presells.compliance.saveFirst")}
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {t("pages.presells.compliance.title")}
          </h3>
          <p className="max-w-2xl text-xs text-muted-foreground">
            {t("pages.presells.compliance.intro")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate(false)}
          >
            {t("pages.presells.compliance.generateReview")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={packMutation.isPending}
            onClick={() => packMutation.mutate()}
          >
            {t("pages.presells.compliance.triplePack")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={auditMutation.isPending}
            onClick={() => auditMutation.mutate()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", auditMutation.isPending && "animate-spin")} />
            {t("pages.presells.compliance.runAudit")}
          </Button>
        </div>
      </div>

      {aiQuota ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {fill(t("pages.presells.compliance.quotaLine"), {
            used: String(aiQuota.used),
            limit: aiQuota.limit == null ? "" : ` / ${aiQuota.limit}`,
            remaining:
              aiQuota.remaining != null
                ? fill(t("pages.presells.compliance.quotaRemaining"), { n: aiQuota.remaining })
                : t("pages.presells.compliance.quotaAdmin"),
            openai: aiQuota.openai_configured
              ? t("pages.presells.compliance.quotaOn")
              : t("pages.presells.compliance.quotaOff"),
          })}
        </p>
      ) : null}

      <div
        className={cn(
          "rounded-md border px-3 py-2 text-sm",
          gate === "blocked" && "border-destructive/40 bg-destructive/5",
          gate === "needs_review" && "border-amber-500/40 bg-amber-500/5",
          gate === "ready_for_review" && "border-emerald-600/30 bg-emerald-600/5",
          (gate === "unchecked" || gate === "checking") && "border-border/60 bg-muted/20",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{gateLabel(t, gate, gateOpts)}</p>
          {adsScore != null ? (
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {fill(t("pages.presells.compliance.adsScore"), { n: adsScore })}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{fill(t("pages.presells.compliance.google"), { gate: gateLabel(t, audit?.google_gate || data?.compliance_gate, gateOpts) })}</span>
          <span>{fill(t("pages.presells.compliance.microsoft"), { gate: gateLabel(t, audit?.microsoft_gate || data?.compliance_gate, gateOpts) })}</span>
          {data?.last_compliance_audit_at ? (
            <span>{fill(t("pages.presells.compliance.lastAudit"), { when: new Date(data.last_compliance_audit_at).toLocaleString() })}</span>
          ) : null}
        </div>
      </div>

      {destinationRules.length ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            destinationFail && "border-destructive/40 bg-destructive/5",
            !destinationFail && destinationOk && "border-emerald-600/30 bg-emerald-600/5",
            !destinationFail && !destinationOk && "border-border/60 bg-muted/15",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {t("pages.presells.compliance.destinationTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {t("pages.presells.compliance.destinationBody")}
          </p>
          <ul className="mt-2 space-y-1">
            {destinationRules.map((r) => (
              <li key={r.ruleId} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    r.status === "PASS" && "text-emerald-700 dark:text-emerald-400",
                    r.status === "FAIL" && "text-destructive",
                    r.status === "WARNING" && "text-amber-700 dark:text-amber-300",
                    r.status === "NOT_CHECKED" && "text-muted-foreground",
                  )}
                >
                  {r.status}
                </span>
                <span className="text-foreground/90">
                  {r.ruleId} · {r.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-muted/15 px-3 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{t("pages.presells.compliance.footerTitle")}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t("pages.presells.compliance.footerHint")}
          </p>
        </div>
        <Switch
          checked={isAffiliateTrustFooterEnabled(configSettings)}
          onCheckedChange={(v) => setField("showAffiliateTrustFooter", v)}
          aria-label={t("pages.presells.compliance.footerAria")}
        />
      </div>

      {isAffiliateTrustFooterEnabled(configSettings) ? (
      <div className="grid gap-3 sm:grid-cols-2">
        {lockIdentityFromSource ? (
          <div className="sm:col-span-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {t("pages.presells.compliance.whiteIdentity")}
          </div>
        ) : (
          <>
        <div className="space-y-1.5">
          <Label htmlFor="compliance-business">{t("pages.presells.compliance.identityLabel")}</Label>
          <Input
            id="compliance-business"
            value={String(configSettings.businessName ?? "")}
            onChange={(e) => setField("businessName", e.target.value)}
            placeholder={t("pages.presells.compliance.identityPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compliance-email">{t("pages.presells.compliance.contactLabel")}</Label>
          <Input
            id="compliance-email"
            type="email"
            value={String(configSettings.contactEmail ?? "")}
            onChange={(e) => setField("contactEmail", e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="compliance-privacy">{t("pages.presells.compliance.privacyLabel")}</Label>
          <Input
            id="compliance-privacy"
            value={String(configSettings.privacyPolicyUrl ?? "")}
            onChange={(e) => setField("privacyPolicyUrl", e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compliance-affiliate">{t("pages.presells.compliance.disclosureLabel")}</Label>
          <Input
            id="compliance-affiliate"
            value={
              affiliateDisclosureInContent ??
              String(configSettings.affiliateDisclosure ?? "")
            }
            onChange={(e) => {
              onAffiliateDisclosureChange?.(e.target.value);
              setField("affiliateDisclosure", e.target.value);
            }}
            placeholder={t("pages.presells.compliance.disclosurePlaceholder")}
          />
        </div>
      </div>
      ) : null}

      {isLoading ? <p className="text-xs text-muted-foreground">{t("pages.presells.compliance.loadingResults")}</p> : null}
      {error ? (
        <p className="text-xs text-destructive">{error instanceof Error ? error.message : t("pages.presells.compliance.errorGeneric")}</p>
      ) : null}

      {suggestions.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {t("pages.presells.compliance.suggestedPlan")}
          </p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={`${s.ruleId}-${s.title}`}
                className="rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-sm"
              >
                <p className="font-medium text-foreground">
                  {s.title}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.ruleId}
                  </span>
                </p>
                {s.requiresUserInput.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fill(t("pages.presells.compliance.needsYou"), { items: s.requiresUserInput.join(", ") })}
                  </p>
                ) : null}
                {s.suggestedContentPatches.map((p, i) => (
                  <p key={i} className="mt-1 text-xs text-foreground/90">
                    <span className="font-medium">{p.path}: </span>
                    {p.after || p.note}
                  </p>
                ))}
                {s.warnings.map((w, i) => (
                  <p key={`w-${i}`} className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                    {w}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-muted/10 p-3">
        <p className="text-sm font-medium">{t("pages.presells.compliance.disapprovalTitle")}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t("pages.presells.compliance.disapprovalHint")}
        </p>
        <Textarea
          value={disapprovalText}
          onChange={(e) => setDisapprovalText(e.target.value)}
          placeholder={t("pages.presells.compliance.disapprovalPlaceholder")}
          rows={3}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disapprovalMutation.isPending || disapprovalText.trim().length < 8}
          onClick={() => disapprovalMutation.mutate()}
        >
          {t("pages.presells.compliance.generatePlan")}
        </Button>
        {disapprovalHints.length ? (
          <ul className="space-y-2 pt-1">
            {disapprovalHints.map((h) => (
              <li key={h.code} className="text-xs">
                <p className="font-medium text-foreground">{h.title}</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted-foreground">
                  {h.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {critical.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">{t("pages.presells.compliance.critical")}</p>
          <ul className="space-y-2">
            {critical.map((r) => (
              <RuleRow key={r.ruleId} r={r} onDispute={setDisputeRuleId} />
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{t("pages.presells.compliance.warnings")}</p>
          <ul className="space-y-2">
            {warnings.map((r) => (
              <RuleRow key={r.ruleId} r={r} />
            ))}
          </ul>
        </div>
      ) : null}

      {notChecked.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pages.presells.compliance.notChecked")}
          </p>
          <ul className="space-y-2">
            {notChecked.map((r) => (
              <RuleRow key={r.ruleId} r={r} />
            ))}
          </ul>
        </div>
      ) : null}

      {disputeRuleId ? (
        <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
          <p className="text-sm font-medium">{fill(t("pages.presells.compliance.disputeTitle"), { rule: disputeRuleId })}</p>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder={t("pages.presells.compliance.disputePlaceholder")}
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={decideMutation.isPending || disputeReason.trim().length < 8}
              onClick={() => decideMutation.mutate()}
            >
              {t("pages.presells.compliance.recordDecision")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDisputeRuleId(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {data?.decisions?.length ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pages.presells.compliance.history")}
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {data.decisions.slice(0, 8).map((d) => (
              <li key={d.id}>
                {new Date(d.created_at).toLocaleString()} · {d.rule_id} · {d.decision}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {data?.disclaimer ||
          t("pages.presells.compliance.disclaimerFallback")}
      </p>
    </section>
  );
}
