import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Layers, LineChart, Shield, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel } from "@/components/enterprise/ProShell";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { SyncHealthBanner } from "@/components/SyncHealthBanner";
import { BrandKitProCard } from "@/components/BrandKitProCard";
import { plansService } from "@/services/plansService";
import { enterpriseService } from "@/services/enterpriseService";
import { analyticsService } from "@/services/analyticsService";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { MessageKey } from "@/i18n";
import type { AppLocale } from "@/i18n/types";

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

function numberLocale(locale: AppLocale): string {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "pt") return "pt-PT";
  if (locale === "es") return "es-ES";
  return "en-US";
}

const ONBOARDING_LABEL_KEYS: Record<string, MessageKey> = {
  plan_active: "pages.onboardingSteps.plan_active",
  presell: "pages.onboardingSteps.presell",
  presell_published: "pages.onboardingSteps.presell_published",
  domain: "pages.onboardingSteps.domain",
  domain_https: "pages.onboardingSteps.domain_https",
  webhook: "pages.onboardingSteps.webhook",
  postback_macros: "pages.onboardingSteps.postback_macros",
  first_click: "pages.onboardingSteps.first_click",
  first_sale: "pages.onboardingSteps.first_sale",
  agency_path: "pages.onboardingSteps.agency_path",
  mfa: "pages.onboardingSteps.mfa",
  api_key: "pages.onboardingSteps.api_key",
  white_label: "pages.onboardingSteps.white_label",
  rotator: "pages.onboardingSteps.rotator",
  r2: "pages.onboardingSteps.r2",
};

/**
 * Go-to-market Agency (Fase 2): pricing real dos planos + checklist + dual-pillar.
 */
export default function AgencyReadyPage() {
  const { t, locale } = useAppLocale();
  const {
    data: plans = [],
    isLoading: plansLoading,
    isError: plansError,
  } = useQuery({
    queryKey: ["plans", "agency"],
    queryFn: async () => {
      const { data, error } = await plansService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: onboarding } = useQuery({
    queryKey: ["enterprise-onboarding", "agency"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.getOnboardingStatus();
      if (error) throw new Error(error);
      return data!;
    },
  });

  const from = isoDaysAgo(30);
  const to = isoDaysAgo(0);
  const { data: dash } = useQuery({
    queryKey: ["agency", "proof", from, to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from, to });
      if (error) throw new Error(error);
      return data!;
    },
  });

  const pillars = [
    {
      icon: LineChart,
      title: t("pages.agency.pillarTrackingTitle"),
      desc: t("pages.agency.pillarTrackingDesc"),
      href: "/resultados",
    },
    {
      icon: Layers,
      title: t("pages.agency.pillarPresellTitle"),
      desc: t("pages.agency.pillarPresellDesc"),
      href: "/presells/nova",
    },
    {
      icon: Shield,
      title: t("pages.agency.pillarTrustTitle"),
      desc: t("pages.agency.pillarTrustDesc"),
      href: "/integracoes",
    },
  ];

  const arms = dash?.rotator_arm_performance ?? [];
  const clicks = dash?.total_clicks ?? 0;
  const sales = dash?.approved_sales_count ?? dash?.total_conversions ?? 0;
  const onboardingPctLive = onboarding?.progress?.total
    ? Math.round((onboarding.progress.done / onboarding.progress.total) * 100)
    : null;

  const cases = [
    {
      niche: t("pages.agency.proofAccountNiche"),
      result: dash
        ? fill(t("pages.agency.proofAccountResult"), {
            clicks,
            sales,
            arms: arms.length,
          })
        : t("pages.agency.proofAccountLoading"),
    },
    {
      niche: t("pages.agency.proofRotatorNiche"),
      result:
        arms.length > 0
          ? arms
              .slice(0, 2)
              .map((a) => {
                let line = fill(t("pages.agency.proofRotatorClicks"), {
                  label: a.arm_label,
                  clicks: a.clicks,
                });
                if (a.max_clicks != null) {
                  line += fill(t("pages.agency.proofRotatorLimit"), {
                    delivered: a.clicks_delivered,
                    max: a.max_clicks,
                  });
                }
                return line;
              })
              .join(" · ")
          : t("pages.agency.proofRotatorEmpty"),
    },
    {
      niche: t("pages.agency.proofOnboardingNiche"),
      result: onboarding?.complete
        ? fill(t("pages.agency.proofOnboardingDone"), {
            pct: onboardingPctLive != null ? ` (${onboardingPctLive}%)` : "",
          })
        : fill(t("pages.agency.proofOnboardingProgress"), {
            done: onboarding?.progress?.done ?? "…",
            total: onboarding?.progress?.total ?? "…",
          }),
    },
  ];

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString(numberLocale(locale), {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });

  const paidPlans = plans
    .filter((p) => (p.price_cents ?? 0) > 0 || p.name.toLowerCase().includes("pro"))
    .slice(0, 4);

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader title={t("pages.agency.title")} subtitle={t("pages.agency.subtitle")} />

      <SyncHealthBanner className="mb-4" syncHealth={dash?.sync_health} />
      <TrackPathStatus className="mb-6" />

      {onboarding ? (
        <div className="mb-6 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {onboarding.complete
                ? t("pages.agency.onboardingComplete")
                : t("pages.agency.onboardingAccount")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {fill(t("pages.agency.onboardingStepsLine"), {
                done: onboarding.progress.done,
                total: onboarding.progress.total,
              })}
              {onboardingPctLive != null ? ` · ${onboardingPctLive}%` : ""}
              {onboarding.complete
                ? t("pages.agency.onboardingReadyScale")
                : t("pages.agency.onboardingUnder30")}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to={onboarding.complete ? "/resultados" : "/"}>
              {onboarding.complete
                ? t("pages.agency.viewResults")
                : t("pages.agency.openChecklist")}
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {pillars.map((p) => (
          <ProPanel key={p.title} title={p.title}>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{p.desc}</p>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to={p.href}>
                  {t("common.open")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </ProPanel>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        <ProPanel title={t("pages.agency.plansTitle")} description={t("pages.agency.plansDesc")}>
          <div className="px-4 py-3 space-y-3">
            {plansLoading ? (
              <p className="text-xs text-muted-foreground">{t("pages.agency.plansLoading")}</p>
            ) : plansError ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">{t("pages.agency.plansError")}</p>
            ) : paidPlans.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("pages.agency.plansEmpty")}</p>
            ) : (
              paidPlans.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border/50 px-3 py-2.5 flex justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {p.has_branding === false ? `${t("pages.agency.whiteLabel")} · ` : ""}
                      {p.affiliate_webhook_enabled ? `${t("pages.agency.postback")} · ` : ""}
                      {p.max_presell_pages != null
                        ? fill(t("pages.agency.pagesCount"), { n: p.max_presell_pages })
                        : t("pages.agency.pagesLabel")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {(p.price_cents ?? 0) > 0
                      ? formatPrice(p.price_cents!)
                      : t("pages.agency.onRequest")}
                  </p>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/planos">{t("pages.agency.plansCompare")}</Link>
            </Button>
          </div>
        </ProPanel>

        <ProPanel title={t("pages.agency.proofTitle")} description={t("pages.agency.proofDesc")}>
          <div className="px-4 py-3 space-y-3">
            {cases.map((c) => (
              <div key={c.niche} className="rounded-lg border border-border/50 px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">{c.niche}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.result}</p>
              </div>
            ))}
          </div>
        </ProPanel>
      </div>

      <div className="mb-8">
        <BrandKitProCard />
      </div>

      <ProPanel
        title={t("pages.agency.checklistTitle")}
        description={t("pages.agency.checklistDesc")}
      >
        <div className="px-4 py-3 space-y-4">
          <ol className="space-y-2">
            {(onboarding?.steps?.filter((s) => !s.optional).slice(0, 6) ?? []).map((step, i) => {
              const key = ONBOARDING_LABEL_KEYS[step.id];
              const label = key ? t(key) : step.label;
              return (
                <li key={step.id} className="flex items-start gap-2 text-sm">
                  <CheckCircle2
                    className={`h-4 w-4 mt-0.5 shrink-0 ${step.done ? "text-emerald-600" : "text-muted-foreground"}`}
                  />
                  <Link to={step.href} className="hover:underline">
                    <span className="text-muted-foreground tabular-nums mr-1">{i + 1}.</span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/presells/nova">{t("pages.agency.startPresell")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/planos">{t("pages.agency.viewPlans")}</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/integracoes">{t("pages.agency.integrations")}</Link>
            </Button>
          </div>
        </div>
      </ProPanel>
    </div>
  );
}
