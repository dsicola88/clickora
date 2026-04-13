import { Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { plansService } from "@/services/plansService";
import { plansLandingService } from "@/services/plansLandingService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Zap,
  Star,
  Rocket,
  FileStack,
  Gauge,
  Palette,
  LayoutTemplate,
  LogIn,
  ShoppingBag,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { APP_PAGE_SHELL_LOOSE } from "@/lib/appPageLayout";
import type { Plan } from "@/types/api";
import { cn } from "@/lib/utils";
import {
  coerceBodySize,
  coerceFontFamily,
  coerceFontWeight,
  coerceHeroTitleSize,
  coerceTextAlign,
  plansLandingFooterClasses,
  plansLandingHeroInnerClasses,
  plansLandingHeroSubtitleClasses,
  plansLandingHeroTitleClasses,
  plansLandingIntroClasses,
} from "@/lib/plansLandingTypography";
import {
  formatPlanPrice,
  getPlanPriceSuffix,
  mergeWithDefaultLabels,
} from "@/lib/planDisplayLabels";
import { PlansLandingHeroBlock } from "@/components/plans/PlansLandingHeroBlock";
import {
  SalesLandingFaq,
  SalesLandingFeatures,
  SalesLandingLegalFooter,
  SalesLandingStats,
} from "@/components/plans/SalesLandingSections";
import { coerceLandingExtras } from "@/lib/plansLandingExtras";
import { LandingContentBlocks } from "@/components/plans/LandingContentBlocks";
import { LandingTestimonialsSection } from "@/components/plans/LandingTestimonialsSection";
import { LandingGallerySection } from "@/components/plans/LandingGallerySection";
import {
  resolveSectionOrder,
  resolveSectionsEnabled,
  type LandingSectionId,
} from "@/lib/landingSectionLayout";

function planCardCtaLabel(plan: Plan, isCurrent: boolean, labels: Record<string, string>) {
  if (isCurrent) return labels.cta_current ?? "Plano atual";
  const custom = plan.cta_label?.trim();
  if (custom) return custom;
  if (plan.type === "free_trial") return labels.cta_free ?? "Começar grátis";
  return labels.cta_upgrade ?? "Fazer upgrade";
}

const planIcons: Record<string, React.ReactNode> = {
  free_trial: <Zap className="h-6 w-6" />,
  monthly: <Star className="h-6 w-6" />,
  annual: <Rocket className="h-6 w-6" />,
};

const planColors: Record<string, string> = {
  free_trial: "border-border",
  monthly: "border-primary",
  annual: "border-primary ring-2 ring-primary/20",
};

export default function Plans() {
  const navigate = useNavigate();
  const { user, userPlan, isSuperAdmin } = useAuth();

  const { data: landing } = useQuery({
    queryKey: ["plans-landing-public"],
    queryFn: () => plansLandingService.getPublic(),
    staleTime: 60_000,
  });

  const { data: plans = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await plansService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  /** Primeiro plano pago com checkout — botão «Comprar» do topo vai direto à Hotmart. */
  const primaryCheckoutUrl = useMemo(() => {
    const paid = plans.find((p) => p.price_cents > 0 && p.checkout_url);
    return paid?.checkout_url ?? null;
  }, [plans]);

  const handleSelectPlan = async (plan: Plan) => {
    if (user && plan.type === userPlan?.plan_type) {
      toast.info("Você já está neste plano.");
      return;
    }

    if (plan.price_cents > 0 && plan.checkout_url) {
      window.location.href = plan.checkout_url;
      return;
    }

    if (!user) {
      if (plan.price_cents === 0) {
        toast.info("Crie uma conta ou entre para ativar o plano grátis.");
        navigate("/auth");
        return;
      }
      toast.error(
        "Checkout ainda não está configurado no servidor (ex.: HOTMART_PRODUCT_URL ou HOTMART_PLAN_CHECKOUT_URLS).",
      );
      return;
    }

    const { data, error } = await plansService.subscribe(plan.id);
    if (error) {
      toast.error(error);
      return;
    }
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    if (data?.checkout_mode === "unconfigured" && data.message) {
      toast.error(data.message);
      return;
    }
    toast.success("Plano atualizado com sucesso!");
  };

  if (isLoading) return <LoadingState message="Carregando planos..." />;
  if (isError) return <ErrorState message="Erro ao carregar planos." onRetry={() => refetch()} />;
  if (plans.length === 0) return <ErrorState message="Nenhum plano disponivel no momento." onRetry={() => refetch()} />;

  const heroTitle = landing?.hero_title ?? "Escolha seu plano";
  const heroSubtitle =
    landing?.hero_subtitle ??
    "Cada cartão mostra os limites de presells e de cliques por mês; abaixo, o que mais está incluído. Comece grátis e faça upgrade quando precisar.";
  const badgeText = landing?.badge_text?.trim() ?? "";
  const introText = landing?.intro_text?.trim() ?? "";
  const footerText = landing?.footer_text?.trim() ?? "";
  const heroImg =
    landing?.has_hero_image && landing.updated_at
      ? plansLandingService.heroImageHref(landing.updated_at)
      : null;

  const lb = mergeWithDefaultLabels(landing?.plan_display_labels);
  const extras = coerceLandingExtras(landing?.landing_extras);
  const salesDark = extras.appearance === "sales_dark";
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

  const renderSection = (id: LandingSectionId) => {
    switch (id) {
      case "content_blocks":
        if (!sectionsOn.content_blocks || !mediaBlocks.length) return null;
        return (
          <LandingContentBlocks blocks={mediaBlocks} salesDark={salesDark} className="mb-12" />
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
            className="mb-12"
          />
        );
      case "gallery":
        if (!sectionsOn.gallery || extras.gallery?.enabled === false) return null;
        if (!extras.gallery?.items?.length) return null;
        return (
          <LandingGallerySection data={extras.gallery} salesDark={salesDark} className="mb-12" />
        );
      case "planos":
        if (!sectionsOn.planos) return null;
        return (
          <section id="planos" className="scroll-mt-24 space-y-6 mb-12">
            <div
              className={cn(
                "flex flex-col gap-1 pb-4",
                salesDark ? "text-center border-b border-white/10 max-w-3xl mx-auto" : "border-b border-border/50",
              )}
            >
              {plansSectionLabel ? (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 mb-1">
                  {plansSectionLabel}
                </p>
              ) : null}
              <h2
                className={cn(
                  "text-2xl font-bold tracking-tight md:text-3xl",
                  salesDark ? "text-white" : "text-foreground",
                )}
              >
                {plansSectionTitle}
              </h2>
              <p
                className={cn(
                  "text-sm max-w-2xl",
                  salesDark ? "text-white/70 mx-auto" : "text-muted-foreground",
                )}
              >
                {plansSectionSub}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.type === userPlan?.plan_type;
                const isPopular = plan.type === "annual";

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex min-h-[480px] flex-col rounded-2xl p-6 transition-all duration-300",
                      salesDark
                        ? "border-0 bg-white text-slate-900 shadow-xl hover:-translate-y-1 hover:shadow-2xl"
                        : `border-2 bg-card transition-all hover:shadow-card-hover ${planColors[plan.type] ?? "border-border"}`,
                      isPopular && salesDark && "ring-2 ring-blue-500/35",
                    )}
                  >
                    {salesDark ? (
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl bg-blue-500"
                        aria-hidden
                      />
                    ) : null}
                    {isPopular && (
                      <Badge
                        className={cn(
                          "absolute -top-3 left-1/2 -translate-x-1/2",
                          salesDark
                            ? "bg-blue-600 text-white hover:bg-blue-600"
                            : "bg-primary text-primary-foreground",
                        )}
                      >
                        {lb.badge_popular}
                      </Badge>
                    )}
                    <div className="mb-4 flex items-center gap-3">
                      <div
                        className={cn(
                          "rounded-xl p-2",
                          salesDark
                            ? plan.type === "free_trial"
                              ? "bg-slate-100"
                              : "bg-blue-500/15"
                            : plan.type === "free_trial"
                              ? "bg-muted"
                              : "bg-primary/10",
                        )}
                      >
                        {planIcons[plan.type] ?? <Star className="h-6 w-6" />}
                      </div>
                      <div>
                        <h3 className={cn("font-bold", salesDark ? "text-slate-900" : "text-foreground")}>
                          {plan.name}
                        </h3>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            {lb.badge_current}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mb-5">
                      <span className={cn("text-3xl font-bold", salesDark ? "text-slate-900" : "text-foreground")}>
                        {formatPlanPrice(plan.price_cents, lb)}
                      </span>
                      <span className={cn("text-sm", salesDark ? "text-slate-500" : "text-muted-foreground")}>
                        {getPlanPriceSuffix(plan.type, lb)}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "mb-5 rounded-xl border p-4",
                        salesDark ? "border-slate-200 bg-slate-50" : "border-primary/15 bg-primary/5",
                      )}
                    >
                      <p
                        className={cn(
                          "mb-3 text-xs font-semibold uppercase tracking-wide",
                          salesDark ? "text-blue-700" : "text-primary/90",
                        )}
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
                            <FileStack className="h-4 w-4 text-primary" />
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
                            <Gauge className="h-4 w-4 text-primary" />
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
                            <Palette className="h-4 w-4 text-primary" />
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
                            className={cn(
                              "mt-0.5 h-4 w-4 flex-shrink-0",
                              salesDark ? "text-blue-600" : "text-primary",
                            )}
                          />
                          <span className={salesDark ? "text-slate-800" : "text-foreground"}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
                      className={cn(
                        "w-full",
                        salesDark && !isCurrent && isPopular && "bg-blue-600 hover:bg-blue-700",
                      )}
                      disabled={isCurrent}
                    >
                      {planCardCtaLabel(plan, isCurrent, lb)}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        );
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
    <div
      className={cn(
        "min-h-svh w-full px-4 pb-12 pt-2 md:px-6 md:pb-14 md:pt-4 lg:px-8 lg:pb-16",
        salesDark
          ? "bg-[#050a18] text-white selection:bg-blue-500/25"
          : "bg-background text-foreground",
      )}
    >
      <div
        className={cn(
          APP_PAGE_SHELL_LOOSE,
          salesDark && "relative py-8 md:py-12",
        )}
      >
      <div
        className={cn(
          "sticky top-0 z-40 mb-6 border-b py-3 backdrop-blur-md",
          salesDark
            ? "border-white/10 bg-[#050a18]/85 supports-[backdrop-filter]:bg-[#050a18]/75"
            : "border-border/60 bg-background/90 supports-[backdrop-filter]:bg-background/75",
        )}
      >
        <nav
          className={cn(
            "mx-auto grid w-full max-w-2xl grid-cols-1 gap-2 sm:gap-3",
            "sm:max-w-lg sm:grid-cols-2",
          )}
          aria-label="Ações da página"
        >
          <Button
            size="sm"
            className={cn(
              "min-h-10 w-full gap-2 sm:min-w-0",
              salesDark && "bg-blue-600 text-white hover:bg-blue-700",
            )}
            asChild
          >
            <a href={primaryCheckoutUrl ?? "#planos"} className="inline-flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
              Comprar
            </a>
          </Button>
          {user ? (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-h-10 w-full gap-2 border sm:min-w-0",
                salesDark && "border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white",
              )}
              asChild
            >
              <Link to="/inicio" className="inline-flex items-center justify-center">
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                Painel
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-h-10 w-full gap-2 sm:min-w-0",
                salesDark && "border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white",
              )}
              asChild
            >
              <Link to="/auth" className="inline-flex items-center justify-center">
                <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                Entrar
              </Link>
            </Button>
          )}
        </nav>
      </div>

      {isSuperAdmin && (
        <div
          className={cn(
            "mb-6 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
            salesDark
              ? "border-white/15 bg-white/5 text-white/90"
              : "border-primary/25 bg-primary/5",
          )}
        >
          <p className={cn("text-sm", salesDark ? "text-white/75" : "text-muted-foreground")}>
            <span className={cn("font-medium", salesDark ? "text-white" : "text-foreground")}>Super administrador:</span> edite a landing pública desta página (textos, imagem, tipografia) no
            painel — separador <span className={cn("font-medium", salesDark ? "text-white" : "text-foreground")}>Planos</span>, bloco no topo.
          </p>
          <Button variant="secondary" size="sm" className="shrink-0 gap-2" asChild>
            <Link to="/admin?tab=plans">
              <LayoutTemplate className="h-4 w-4" />
              Abrir editor da landing
            </Link>
          </Button>
        </div>
      )}

      <PlansLandingHeroBlock
        heroImg={heroImg}
        heroVisualRaw={landing?.hero_visual}
        tone={salesDark ? "dark" : "default"}
      >
        <div
          className={cn(
            plansLandingHeroInnerClasses({
              font: coerceFontFamily(landing?.hero_font),
              align: coerceTextAlign(landing?.hero_text_align),
            }),
          )}
        >
          {badgeText ? (
            <span className="inline-flex w-fit max-w-full items-center rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              {badgeText}
            </span>
          ) : null}
          <h1
            className={plansLandingHeroTitleClasses({
              size: coerceHeroTitleSize(landing?.hero_title_size),
              weight: coerceFontWeight(landing?.hero_title_weight),
            })}
          >
            {heroTitle}
          </h1>
          {heroSubtitle ? (
            <p className={plansLandingHeroSubtitleClasses(coerceBodySize(landing?.hero_subtitle_size))}>{heroSubtitle}</p>
          ) : null}
        </div>
      </PlansLandingHeroBlock>

      {userPlan && (
        <div
          className={cn(
            "rounded-xl border p-4",
            salesDark ? "border-white/10 bg-white/5" : "border-border/60 bg-card",
          )}
        >
          <p className={cn("text-sm", salesDark ? "text-white/75" : "text-muted-foreground")}>
            {lb.current_plan_banner_title}:{" "}
            <span className={cn("font-semibold", salesDark ? "text-white" : "text-foreground")}>
              {userPlan.plan_name}
            </span>
          </p>
        </div>
      )}

      {introText ? (
        <div
          className={cn(
            "mb-8 max-w-3xl whitespace-pre-line",
            salesDark && "text-white/85",
            plansLandingIntroClasses({
              font: coerceFontFamily(landing?.intro_font),
              align: coerceTextAlign(landing?.intro_text_align),
              size: coerceBodySize(landing?.intro_text_size),
            }),
          )}
        >
          {introText}
        </div>
      ) : null}

      {sectionOrder.map((id) => (
        <Fragment key={id}>{renderSection(id)}</Fragment>
      ))}

      {footerText ? (
        <div
          className={cn(
            "mt-10 rounded-xl border px-6 py-8 whitespace-pre-line",
            salesDark
              ? "border-white/10 bg-white/[0.04] text-white/90"
              : "border-border/80 bg-muted/30",
            plansLandingFooterClasses({
              font: coerceFontFamily(landing?.footer_font),
              align: salesDark ? "center" : coerceTextAlign(landing?.footer_text_align),
              size: coerceBodySize(landing?.footer_text_size),
            }),
          )}
        >
          {footerText}
        </div>
      ) : null}

      <SalesLandingLegalFooter extras={extras} />

      {userPlan && (
        <div
          className={cn(
            "mt-10 rounded-2xl border p-6",
            salesDark ? "border-white/10 bg-white/5" : "border-border bg-card",
          )}
        >
          <h2
            className={cn("font-bold mb-4", salesDark ? "text-white" : "text-foreground")}
          >
            {lb.section_your_plan_title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className={cn("rounded-xl p-4", salesDark ? "bg-white/10" : "bg-muted")}
            >
              <p className={cn("text-sm", salesDark ? "text-white/70" : "text-muted-foreground")}>
                {lb.label_plan_col}
              </p>
              <p className={cn("font-bold", salesDark ? "text-white" : "text-foreground")}>
                {userPlan.plan_name}
              </p>
            </div>
            <div
              className={cn("rounded-xl p-4", salesDark ? "bg-white/10" : "bg-muted")}
            >
              <p className={cn("text-sm", salesDark ? "text-white/70" : "text-muted-foreground")}>
                {lb.label_pages_col}
              </p>
              <p className={cn("font-bold", salesDark ? "text-white" : "text-foreground")}>
                {userPlan.max_pages ?? lb.unlimited_pages}
              </p>
            </div>
            <div
              className={cn("rounded-xl p-4", salesDark ? "bg-white/10" : "bg-muted")}
            >
              <p className={cn("text-sm", salesDark ? "text-white/70" : "text-muted-foreground")}>
                {lb.label_clicks_col}
              </p>
              <p className={cn("font-bold", salesDark ? "text-white" : "text-foreground")}>
                {userPlan.max_clicks ? userPlan.max_clicks.toLocaleString(numLocale) : lb.unlimited_clicks}
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
