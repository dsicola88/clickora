import { Fragment, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Star,
  FileStack,
  Gauge,
  Globe,
  Palette,
  Bell,
  Megaphone,
  Leaf,
  TrendingUp,
  Crown,
} from "lucide-react";
import type { Plan } from "@/types/api";
import { cn } from "@/lib/utils";
import {
  computeAnnualVersusMonthlySavings,
  formatPlanPrice,
  getPlanPriceSuffix,
  interpolatePlanLabelTemplate,
} from "@/lib/planDisplayLabels";
import { freeTextEmbedsNumericQuota } from "@/lib/planCommercialText";
import {
  SalesLandingFaq,
  SalesLandingFeatures,
  SalesLandingStats,
} from "@/components/plans/SalesLandingSections";
import type { LandingExtrasPublic } from "@/lib/plansLandingExtras";
import { LandingContentBlocks } from "@/components/plans/LandingContentBlocks";
import { LandingTestimonialsSection } from "@/components/plans/LandingTestimonialsSection";
import { LandingGallerySection } from "@/components/plans/LandingGallerySection";
import { LandingGuaranteeSection } from "@/components/plans/LandingGuaranteeSection";
import {
  resolveSectionOrder,
  resolveSectionsEnabled,
  type LandingSectionId,
} from "@/lib/landingSectionLayout";
import {
  resolveLandingPageTheme,
  resolvedAccentButtonBoxShadow,
  resolvedAccentButtonRadiusStyle,
  resolvedPlanCardRadiusStyle,
} from "@/lib/landingPageTheme";
import {
  landingTextStyleBodyClasses,
  landingTextStyleColorStyle,
  landingTextStyleTitleClasses,
  landingTextStyleLabelClasses,
} from "@/lib/plansLandingTextStyles";

function planCardCtaLabel(plan: Plan, isCurrent: boolean, labels: Record<string, string>) {
  if (isCurrent) return labels.cta_current ?? "Plano atual";
  const custom = plan.cta_label?.trim();
  if (custom) return custom;
  if (plan.price_cents === 0 || plan.type === "free_trial") return labels.cta_free ?? "Começar grátis";
  return labels.cta_upgrade ?? "Fazer upgrade";
}

function planTagline(extras: LandingPageBodySectionsProps["extras"], planType: string): string {
  const lines = extras.plan_taglines;
  if (!lines) return "";
  const value = lines[planType as keyof typeof lines];
  return typeof value === "string" ? value.trim() : "";
}

const planColors: Record<string, string> = {
  free_trial: "border-emerald-500/50",
  monthly: "border-blue-500/60 ring-2 ring-blue-500/25",
  annual: "border-violet-500/55",
};

const planIcons: Record<string, ReactNode> = {
  free_trial: <Leaf className="h-6 w-6" />,
  monthly: <TrendingUp className="h-6 w-6" />,
  annual: <Crown className="h-6 w-6" />,
};

function planVisualAccent(planType: string): {
  bar: string;
  iconLight: string;
  iconDarkWrap: string;
  check: string;
} {
  switch (planType) {
    case "free_trial":
      return {
        bar: "bg-emerald-500",
        iconLight: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
        iconDarkWrap: "bg-emerald-500/15",
        check: "text-emerald-600 dark:text-emerald-400",
      };
    case "monthly":
      return {
        bar: "bg-blue-500",
        iconLight: "bg-blue-500/12 text-blue-800 dark:text-blue-300",
        iconDarkWrap: "bg-blue-500/15",
        check: "text-blue-600 dark:text-blue-400",
      };
    case "annual":
      return {
        bar: "bg-violet-500",
        iconLight: "bg-violet-500/12 text-violet-900 dark:text-violet-300",
        iconDarkWrap: "bg-violet-500/15",
        check: "text-violet-600 dark:text-violet-400",
      };
    default:
      return {
        bar: "bg-slate-400",
        iconLight: "bg-muted text-foreground",
        iconDarkWrap: "bg-slate-100",
        check: "text-primary",
      };
  }
}

export type LandingPageBodySectionsProps = {
  extras: LandingExtrasPublic;
  plans: Plan[];
  /** Etiquetas já fundidas (moeda, sufixos, CTAs…). */
  planLabels: Record<string, string>;
  userPlan: { plan_type: string } | null;
  onSelectPlan: (plan: Plan) => void;
  /** Desativa botões dos planos (pré-visualização no admin). */
  previewMode?: boolean;
};

/**
 * Secções editáveis da landing (entre intro e rodapé de texto): blocos de mídia, destaques,
 * estatísticas, testemunhos, galeria, cartões de plano e FAQ — igual à página pública `/` / planos.
 */
export function LandingPageBodySections({
  extras,
  plans,
  planLabels: lb,
  userPlan,
  onSelectPlan,
  previewMode = false,
}: LandingPageBodySectionsProps) {
  const salesDark = extras.appearance === "sales_dark";
  const salesThemed = resolveLandingPageTheme(extras.theme);
  const numLocale = lb.locale || "pt-BR";

  const formatPagesLimit = (n: number | null) =>
    n === null || n === undefined ? lb.unlimited_pages : n.toLocaleString(numLocale);

  const formatClicksLimit = (n: number | null) =>
    n === null || n === undefined ? lb.unlimited_clicks : n.toLocaleString(numLocale);

  const plansSectionLabel =
    extras.plans_section_label?.trim() ?? (salesDark ? "PLANOS" : "");
  const plansSectionTitle =
    extras.plans_section_title?.trim() ??
    (salesDark ? "Nossas Opções de Adesão" : "Planos e assinaturas");
  const plansSectionSub =
    extras.plans_section_subtitle?.trim() ??
    (salesDark
      ? "Escolha o melhor plano para você e transforme sua operação."
      : "Escolha um plano e finalize a compra na Hotmart ou ative o grátis com a sua conta.");

  const mediaBlocks = extras.content_blocks ?? [];
  const sectionOrder = resolveSectionOrder(extras.section_order);
  const sectionsOn = resolveSectionsEnabled(extras.sections_enabled);

  const monthlyPlanForPitch = useMemo(
    () => plans.find((p) => p.type === "monthly" && p.price_cents > 0),
    [plans],
  );
  const annualPlanForPitch = useMemo(
    () => plans.find((p) => p.type === "annual" && p.price_cents > 0),
    [plans],
  );
  const annualSavingsPitch = useMemo(() => {
    if (!monthlyPlanForPitch || !annualPlanForPitch) return null;
    return computeAnnualVersusMonthlySavings(
      monthlyPlanForPitch.price_cents,
      annualPlanForPitch.price_cents,
    );
  }, [monthlyPlanForPitch, annualPlanForPitch]);

  const renderSection = (id: LandingSectionId) => {
    switch (id) {
      case "content_blocks":
        if (!sectionsOn.content_blocks || !mediaBlocks.length) return null;
        return (
          <LandingContentBlocks
            blocks={mediaBlocks}
            salesDark={salesDark}
            salesTheme={salesThemed}
            className="mb-12"
          />
        );
      case "features":
        if (!sectionsOn.features || !(extras.features?.cards?.length ?? 0)) {
          return null;
        }
        return <SalesLandingFeatures extras={extras} className="mb-12" />;
      case "stats":
        if (!sectionsOn.stats || !(extras.stats?.items?.length ?? 0)) {
          return null;
        }
        return <SalesLandingStats extras={extras} className="mb-12" />;
      case "testimonials":
        if (!sectionsOn.testimonials || extras.testimonials?.enabled === false) {
          return null;
        }
        if (!(extras.testimonials?.items?.length ?? 0)) return null;
        return (
          <LandingTestimonialsSection
            data={extras.testimonials}
            salesDark={salesDark}
            textStyles={extras.text_styles}
            className="mb-12"
          />
        );
      case "gallery":
        if (!sectionsOn.gallery || extras.gallery?.enabled === false) return null;
        if (!extras.gallery?.items?.length) return null;
        return (
          <LandingGallerySection
            data={extras.gallery}
            salesDark={salesDark}
            textStyles={extras.text_styles}
            className="mb-12"
          />
        );
      case "planos":
        if (!sectionsOn.planos) return null;
        if (!plans.length) {
          return (
            <section className="mb-12 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/15 p-4 text-center text-xs text-muted-foreground">
              {previewMode
                ? "Sem planos carregados para pré-visualizar. Verifique a API de planos."
                : "Nenhum plano disponível."}
            </section>
          );
        }
        return (
          <section id="planos" className="scroll-mt-24 space-y-6 mb-12">
            <div
              className={cn(
                "flex flex-col gap-1 pb-4",
                salesDark ? "text-center border-b max-w-3xl mx-auto" : "border-b border-border/50",
              )}
              style={salesDark ? { borderColor: salesThemed.nav_border } : undefined}
            >
              {plansSectionLabel ? (
                <p
                  className={cn(
                    "font-semibold uppercase tracking-[0.2em] mb-1",
                    extras.text_styles?.plans_section_label && landingTextStyleLabelClasses(extras.text_styles.plans_section_label),
                  )}
                  style={{
                    ...(salesDark && !extras.text_styles?.plans_section_label?.color ? { color: salesThemed.link } : {}),
                    ...landingTextStyleColorStyle(extras.text_styles?.plans_section_label),
                  }}
                >
                  {plansSectionLabel}
                </p>
              ) : null}
              <h2
                className={cn(
                  "text-2xl font-bold tracking-tight md:text-3xl",
                  !salesDark && "text-foreground",
                  extras.text_styles?.plans_section_title && landingTextStyleTitleClasses(extras.text_styles.plans_section_title),
                )}
                style={{
                  ...(salesDark && !extras.text_styles?.plans_section_title?.color
                    ? { color: salesThemed.heading_on_dark }
                    : {}),
                  ...landingTextStyleColorStyle(extras.text_styles?.plans_section_title),
                }}
              >
                {plansSectionTitle}
              </h2>
              <p
                className={cn(
                  "max-w-2xl leading-relaxed hyphens-auto",
                  salesDark ? "mx-auto [text-align-last:center]" : "[text-align-last:start]",
                  !salesDark && "text-muted-foreground",
                  extras.text_styles?.plans_section_subtitle && landingTextStyleBodyClasses(extras.text_styles.plans_section_subtitle),
                  "text-justify",
                )}
                style={{
                  ...(salesDark && !extras.text_styles?.plans_section_subtitle?.color
                    ? { color: salesThemed.muted_on_dark }
                    : {}),
                  ...landingTextStyleColorStyle(extras.text_styles?.plans_section_subtitle),
                }}
              >
                {plansSectionSub}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.type === userPlan?.plan_type;
                const isRecommended =
                  Boolean(extras.recommended_plan_type?.trim()) && plan.type === extras.recommended_plan_type;
                const tagline = planTagline(extras, plan.type);
                const featureLines = (plan.features ?? [])
                  .map((feature) => feature.trim())
                  .filter((feature) => feature.length > 0 && !freeTextEmbedsNumericQuota(feature));
                const accent = planVisualAccent(plan.type);

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex min-h-0 flex-col rounded-2xl p-6 transition-all duration-300 md:p-7",
                      salesDark
                        ? "border-0 text-slate-900 shadow-xl hover:-translate-y-1 hover:shadow-2xl"
                        : `border-2 bg-card transition-all hover:shadow-card-hover ${planColors[plan.type] ?? "border-border"}`,
                    )}
                    style={{
                      ...resolvedPlanCardRadiusStyle(salesThemed),
                      ...(salesDark
                        ? {
                            backgroundColor: salesThemed.card_surface,
                            boxShadow: isRecommended
                              ? `0 0 0 2px ${salesThemed.accent}55, 0 25px 50px -12px rgba(0,0,0,0.25)`
                              : undefined,
                          }
                        : {}),
                    }}
                  >
                    {salesDark ? (
                      <div
                        className={cn("absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl", !isRecommended && accent.bar)}
                        style={isRecommended && salesDark ? { backgroundColor: salesThemed.accent } : undefined}
                        aria-hidden
                      />
                    ) : null}
                    {isRecommended && (
                      <Badge
                        className={cn(
                          "absolute -top-3 left-1/2 -translate-x-1/2 text-white border-0",
                          !salesDark && "bg-blue-600 hover:bg-blue-600",
                        )}
                        style={salesDark ? { backgroundColor: salesThemed.accent } : undefined}
                      >
                        {lb.badge_popular}
                      </Badge>
                    )}
                    <div className="mb-4 flex items-start gap-3">
                      <div
                        className={cn(
                          "rounded-xl p-2",
                          salesDark ? accent.iconDarkWrap : accent.iconLight,
                        )}
                      >
                        {planIcons[plan.type] ?? <Star className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className={cn("text-lg font-bold", salesDark ? "text-slate-900" : "text-foreground")}>
                          {plan.name}
                        </h3>
                        {tagline ? (
                          <p
                            className={cn(
                              "mt-1 text-justify text-sm leading-snug hyphens-auto [text-align-last:start]",
                              salesDark ? "text-slate-600" : "text-muted-foreground",
                            )}
                          >
                            {tagline}
                          </p>
                        ) : null}
                        {isRecommended && extras.recommended_note?.trim() ? (
                          <p className={cn("mt-2 text-justify text-sm font-medium leading-snug hyphens-auto [text-align-last:start]", salesDark ? "text-slate-800" : "text-foreground")}>
                            {extras.recommended_note}
                          </p>
                        ) : null}
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {lb.badge_current}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mb-5 space-y-3">
                      <div>
                        <span className={cn("text-4xl font-extrabold tracking-tight md:text-5xl", salesDark ? "text-slate-900" : "text-foreground")}>
                          {formatPlanPrice(plan.price_cents, lb)}
                        </span>
                        <span className={cn("ml-1 text-base", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                          {getPlanPriceSuffix(plan.type, lb)}
                        </span>
                      </div>
                      {plan.type === "annual" && annualSavingsPitch ? (
                        <p className={cn("text-justify text-sm leading-snug hyphens-auto [text-align-last:start]", salesDark ? "text-slate-600" : "text-muted-foreground")}>
                          {interpolatePlanLabelTemplate(lb.annual_pitch_equiv, {
                            equiv: formatPlanPrice(annualSavingsPitch.equivalentMonthlyCents, lb),
                          })}
                        </p>
                      ) : null}
                    </div>

                    {featureLines.length && lb.includes_title.trim() ? (
                      <>
                    <p
                      className={cn(
                        "mb-2 text-xs font-semibold uppercase tracking-wide",
                        salesDark ? "text-slate-500" : "text-muted-foreground",
                      )}
                    >
                      {lb.includes_title}
                    </p>
                    <ul className="mb-6 flex-1 space-y-3">
                      {featureLines.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-base">
                          <Check
                            className={cn("mt-0.5 h-4 w-4 flex-shrink-0", accent.check)}
                          />
                          <span className={cn("text-justify hyphens-auto [text-align-last:start]", salesDark ? "text-slate-800" : "text-foreground")}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                      </>
                    ) : null}

                    <div
                      className={cn(
                        "mb-5 rounded-xl border p-4",
                        salesDark ? "border-slate-200 bg-slate-50" : "border-primary/15 bg-primary/5",
                      )}
                    >
                      <p
                        className={cn("mb-3 text-xs font-semibold uppercase tracking-wide", !salesDark && "text-primary/90")}
                        style={salesDark ? { color: salesThemed.accent } : undefined}
                      >
                        {lb.coverage_title}
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 rounded-lg p-1.5 shadow-sm",
                              salesDark ? "bg-white" : "bg-background/80",
                            )}
                          >
                            <FileStack
                              className={cn("h-4 w-4", !salesDark && "text-primary")}
                              style={salesDark ? { color: salesThemed.accent } : undefined}
                            />
                          </div>
                          <div>
                            <p className={cn("text-xs", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.label_presell_pages}
                            </p>
                            <p
                              className={cn(
                                "text-2xl font-bold tabular-nums",
                                salesDark ? "text-slate-900" : "text-foreground",
                              )}
                            >
                              {formatPagesLimit(plan.max_presell_pages)}
                            </p>
                            {(() => {
                              const note = (plan.max_presell_pages != null ? lb.note_pages_cap : lb.note_pages_open)?.trim();
                              return note ? (
                                <p className={cn("mt-1 text-justify text-xs leading-snug hyphens-auto [text-align-last:start]", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                                  {note}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 rounded-lg p-1.5 shadow-sm",
                              salesDark ? "bg-white" : "bg-background/80",
                            )}
                          >
                            <Gauge
                              className={cn("h-4 w-4", !salesDark && "text-primary")}
                              style={salesDark ? { color: salesThemed.accent } : undefined}
                            />
                          </div>
                          <div>
                            <p className={cn("text-xs", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.label_clicks}
                            </p>
                            <p
                              className={cn(
                                "text-2xl font-bold tabular-nums",
                                salesDark ? "text-slate-900" : "text-foreground",
                              )}
                            >
                              {formatClicksLimit(plan.max_clicks_per_month)}
                            </p>
                            {(() => {
                              const note = (plan.max_clicks_per_month != null ? lb.note_clicks_cap : lb.note_clicks_open)?.trim();
                              return note ? (
                                <p className={cn("mt-1 text-justify text-xs leading-snug hyphens-auto [text-align-last:start]", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                                  {note}
                                </p>
                              ) : null;
                            })()}
                            {plan.type === "free_trial" && extras.free_limits_note?.trim() ? (
                              <p className={cn("mt-1 text-justify text-xs leading-snug hyphens-auto [text-align-last:start]", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                                {extras.free_limits_note}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 rounded-lg p-1.5 shadow-sm",
                              salesDark ? "bg-white" : "bg-background/80",
                            )}
                          >
                            <Globe
                              className={cn("h-4 w-4", !salesDark && "text-primary")}
                              style={salesDark ? { color: salesThemed.accent } : undefined}
                            />
                          </div>
                          <div>
                            <p className={cn("text-xs", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.label_domains}
                            </p>
                            <p
                              className={cn(
                                "text-2xl font-bold tabular-nums",
                                salesDark ? "text-slate-900" : "text-foreground",
                              )}
                            >
                              {plan.max_custom_domains > 0
                                ? plan.max_custom_domains.toLocaleString(numLocale)
                                : lb.domains_none}
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "flex items-start gap-3 border-t pt-3",
                            salesDark ? "border-slate-200" : "border-border/60",
                          )}
                        >
                          <div
                            className={cn(
                              "mt-0.5 rounded-lg p-1.5 shadow-sm",
                              salesDark ? "bg-white" : "bg-background/80",
                            )}
                          >
                            <Palette
                              className={cn("h-4 w-4", !salesDark && "text-primary")}
                              style={salesDark ? { color: salesThemed.accent } : undefined}
                            />
                          </div>
                          <div>
                            <p className={cn("text-xs", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.label_branding}
                            </p>
                            <p
                              className={cn(
                                "text-sm font-semibold",
                                salesDark ? "text-slate-900" : "text-foreground",
                              )}
                            >
                              {plan.has_branding ? lb.branding_yes : lb.branding_no}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 rounded-lg p-1.5 shadow-sm",
                              salesDark ? "bg-white" : "bg-background/80",
                            )}
                          >
                            <Bell
                              className={cn("h-4 w-4", !salesDark && "text-primary")}
                              style={salesDark ? { color: salesThemed.accent } : undefined}
                            />
                          </div>
                          <div>
                            <p className={cn("text-xs", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.label_webhook}
                            </p>
                            <p className={cn("text-sm font-semibold", salesDark ? "text-slate-900" : "text-foreground")}>
                              {plan.affiliate_webhook_enabled ? lb.webhook_yes : lb.webhook_no}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 rounded-lg p-1.5 shadow-sm",
                              salesDark ? "bg-white" : "bg-background/80",
                            )}
                          >
                            <Megaphone
                              className={cn("h-4 w-4", !salesDark && "text-primary")}
                              style={salesDark ? { color: salesThemed.accent } : undefined}
                            />
                          </div>
                          <div>
                            <p className={cn("text-xs", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.label_ads}
                            </p>
                            <p className={cn("text-sm font-semibold", salesDark ? "text-slate-900" : "text-foreground")}>
                              {plan.dpilot_ads_enabled ? lb.ads_yes : lb.ads_no}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        if (!previewMode) onSelectPlan(plan);
                      }}
                      variant={isCurrent ? "outline" : isRecommended ? "default" : "secondary"}
                      className={cn(
                        "h-12 w-full text-base font-semibold",
                        salesDark && !isCurrent && isRecommended && "border-0 text-white hover:opacity-[0.92]",
                      )}
                      style={
                        salesDark && !isCurrent && isRecommended
                          ? {
                              backgroundColor: salesThemed.accent,
                              boxShadow: resolvedAccentButtonBoxShadow(salesThemed),
                              ...resolvedAccentButtonRadiusStyle(salesThemed),
                            }
                          : undefined
                      }
                      disabled={isCurrent || previewMode}
                    >
                      {planCardCtaLabel(plan, isCurrent, lb)}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      case "guarantee":
        if (!sectionsOn.guarantee) return null;
        return <LandingGuaranteeSection extras={extras} className="mb-12" />;
      case "product_demo":
      case "account_plan":
        return null;
      case "faq":
        if (!sectionsOn.faq || !(extras.faq?.items?.length ?? 0)) {
          return null;
        }
        return <SalesLandingFaq extras={extras} className="mb-12" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn(salesDark && salesThemed.sectionFontClass)}>
      {sectionOrder.map((id) => (
        <Fragment key={id}>{renderSection(id)}</Fragment>
      ))}
    </div>
  );
}
