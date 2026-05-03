import { Fragment, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Star,
  FileStack,
  Gauge,
  Palette,
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
  if (plan.type === "free_trial") return labels.cta_free ?? "Começar grátis";
  return labels.cta_upgrade ?? "Fazer upgrade";
}

const PLAN_TAGLINES: Record<string, string> = {
  free_trial: "Limites reduzidos para experimentar presells e tracking",
  monthly: "Quotas mensais para quem publica com frequência",
  annual: "Mesmas ferramentas com quotas amplas e pagamento anual",
};

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
        if (!sectionsOn.features || !salesDark || !(extras.features?.cards?.length ?? 0)) {
          return null;
        }
        return <SalesLandingFeatures extras={extras} className="mb-12" />;
      case "stats":
        if (!sectionsOn.stats || !salesDark || !(extras.stats?.items?.length ?? 0)) {
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
                  "max-w-2xl",
                  !salesDark && "text-muted-foreground",
                  salesDark && "mx-auto",
                  extras.text_styles?.plans_section_subtitle && landingTextStyleBodyClasses(extras.text_styles.plans_section_subtitle),
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
                const isPopular = plan.type === "monthly";
                const showBestValue = plan.type === "annual" && annualSavingsPitch;
                const accent = planVisualAccent(plan.type);
                const tagline = PLAN_TAGLINES[plan.type] ?? "";
                const monthlyName = monthlyPlanForPitch?.name?.trim() || "Pro";

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex min-h-0 flex-col rounded-2xl p-6 transition-all duration-300 md:min-h-[480px]",
                      salesDark
                        ? "border-0 text-slate-900 shadow-xl hover:-translate-y-1 hover:shadow-2xl"
                        : `border-2 bg-card transition-all hover:shadow-card-hover ${planColors[plan.type] ?? "border-border"}`,
                    )}
                    style={{
                      ...resolvedPlanCardRadiusStyle(salesThemed),
                      ...(salesDark
                        ? {
                            backgroundColor: salesThemed.card_surface,
                            boxShadow: isPopular
                              ? `0 0 0 2px ${salesThemed.accent}55, 0 25px 50px -12px rgba(0,0,0,0.25)`
                              : undefined,
                          }
                        : {}),
                    }}
                  >
                    {salesDark ? (
                      <div
                        className={cn("absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl", !isPopular && accent.bar)}
                        style={isPopular && salesDark ? { backgroundColor: salesThemed.accent } : undefined}
                        aria-hidden
                      />
                    ) : null}
                    {isPopular && (
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
                    {showBestValue && (
                      <Badge
                        className={cn(
                          "absolute -top-3 left-1/2 -translate-x-1/2 border-0 text-white shadow-md",
                          !salesDark && "bg-violet-600 hover:bg-violet-600",
                        )}
                        style={
                          salesDark
                            ? {
                                backgroundColor: "rgb(124 58 237)",
                                boxShadow: "0 8px 24px -6px rgb(124 58 237 / 0.55)",
                              }
                            : undefined
                        }
                      >
                        {lb.badge_best_value}
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
                        <h3 className={cn("font-bold", salesDark ? "text-slate-900" : "text-foreground")}>
                          {plan.name}
                        </h3>
                        {tagline ? (
                          <p
                            className={cn(
                              "mt-1 text-xs leading-snug",
                              salesDark ? "text-slate-600" : "text-muted-foreground",
                            )}
                          >
                            {tagline}
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
                        <span className={cn("text-3xl font-bold", salesDark ? "text-slate-900" : "text-foreground")}>
                          {formatPlanPrice(plan.price_cents, lb)}
                        </span>
                        <span className={cn("text-sm", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                          {getPlanPriceSuffix(plan.type, lb)}
                        </span>
                      </div>
                      {plan.type === "annual" && annualSavingsPitch ? (
                        <div
                          className={cn(
                            "space-y-2 rounded-xl border px-3 py-2.5",
                            salesDark
                              ? "border-violet-400/35 bg-violet-950/35"
                              : "border-violet-500/35 bg-violet-500/[0.07]",
                          )}
                        >
                          <p
                            className={cn(
                              "text-xs leading-snug",
                              salesDark ? "text-violet-100/95" : "text-slate-700",
                            )}
                          >
                            {interpolatePlanLabelTemplate(lb.annual_pitch_equiv, {
                              equiv: formatPlanPrice(annualSavingsPitch.equivalentMonthlyCents, lb),
                            })}
                          </p>
                          <p
                            className={cn(
                              "text-xs font-semibold leading-snug",
                              salesDark ? "text-white" : "text-violet-900",
                            )}
                          >
                            {interpolatePlanLabelTemplate(lb.annual_pitch_savings, {
                              save: formatPlanPrice(annualSavingsPitch.savingsCents, lb),
                              pct: String(annualSavingsPitch.percentRounded),
                              monthly_name: monthlyName,
                            })}
                          </p>
                          <p
                            className={cn(
                              "text-[11px] leading-snug opacity-90",
                              salesDark ? "text-violet-200/85" : "text-muted-foreground",
                            )}
                          >
                            {interpolatePlanLabelTemplate(lb.annual_pitch_reference, {
                              compare_yearly: formatPlanPrice(annualSavingsPitch.yearlyAtMonthlyRateCents, lb),
                              monthly_name: monthlyName,
                            })}
                          </p>
                        </div>
                      ) : null}
                    </div>

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
                                "text-base font-bold tabular-nums",
                                salesDark ? "text-slate-900" : "text-foreground",
                              )}
                            >
                              {formatPagesLimit(plan.max_presell_pages)}
                            </p>
                            <p className={cn("text-[11px]", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.sub_presell_pages}
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
                                "text-base font-bold tabular-nums",
                                salesDark ? "text-slate-900" : "text-foreground",
                              )}
                            >
                              {formatClicksLimit(plan.max_clicks_per_month)}
                            </p>
                            <p className={cn("text-[11px]", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                              {lb.sub_clicks}
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
                      </div>
                    </div>

                    <p
                      className={cn(
                        "mb-2 text-xs font-semibold uppercase tracking-wide",
                        salesDark ? "text-slate-500" : "text-muted-foreground",
                      )}
                    >
                      {lb.includes_title}
                    </p>
                    <ul className="mb-6 flex-1 space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check
                            className={cn("mt-0.5 h-4 w-4 flex-shrink-0", accent.check)}
                          />
                          <span className={salesDark ? "text-slate-800" : "text-foreground"}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!previewMode) onSelectPlan(plan);
                      }}
                      variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
                      className={cn("w-full", salesDark && !isCurrent && isPopular && "border-0 text-white hover:opacity-[0.92]")}
                      style={
                        salesDark && !isCurrent && isPopular
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
      case "faq":
        if (!sectionsOn.faq || !salesDark || !(extras.faq?.items?.length ?? 0)) {
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
