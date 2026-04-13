import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { plansService } from "@/services/plansService";
import { plansLandingService } from "@/services/plansLandingService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Star, Rocket, FileStack, Gauge, Palette, LayoutTemplate } from "lucide-react";
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
  const { userPlan, isSuperAdmin } = useAuth();

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

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.type === userPlan?.plan_type) {
      toast.info("Você já está neste plano.");
      return;
    }
    const { data, error } = await plansService.subscribe(plan.id);
    if (error) { toast.error(error); return; }
    if (data?.checkout_url) {
      if (data.message) toast.info(data.message);
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
  const numLocale = lb.locale || "pt-BR";

  const formatPagesLimit = (n: number | null) =>
    n === null || n === undefined ? lb.unlimited_pages : n.toLocaleString(numLocale);

  const formatClicksLimit = (n: number | null) =>
    n === null || n === undefined ? lb.unlimited_clicks : n.toLocaleString(numLocale);

  return (
    <div className={APP_PAGE_SHELL_LOOSE}>
      {isSuperAdmin && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Super administrador:</span> edite a landing pública desta página (textos, imagem, tipografia) no
            painel — separador <span className="font-medium text-foreground">Planos</span>, bloco no topo.
          </p>
          <Button variant="secondary" size="sm" className="shrink-0 gap-2" asChild>
            <Link to="/admin?tab=plans">
              <LayoutTemplate className="h-4 w-4" />
              Abrir editor da landing
            </Link>
          </Button>
        </div>
      )}

      <PlansLandingHeroBlock heroImg={heroImg} heroVisualRaw={landing?.hero_visual}>
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
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {lb.current_plan_banner_title}: <span className="font-semibold text-foreground">{userPlan.plan_name}</span>
          </p>
        </div>
      )}

      {introText ? (
        <div
          className={cn(
            "mb-8 max-w-3xl whitespace-pre-line",
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

      <div id="planos" className="grid scroll-mt-24 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.type === userPlan?.plan_type;
          const isPopular = plan.type === "annual";

          return (
            <div
              key={plan.id}
              className={`relative flex min-h-[480px] flex-col rounded-2xl border-2 bg-card p-6 transition-all hover:shadow-card-hover ${planColors[plan.type] ?? "border-border"}`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  {lb.badge_popular}
                </Badge>
              )}
              <div className="mb-4 flex items-center gap-3">
                <div className={`rounded-xl p-2 ${plan.type === "free_trial" ? "bg-muted" : "bg-primary/10"}`}>
                  {planIcons[plan.type] ?? <Star className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      {lb.badge_current}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mb-5">
                <span className="text-3xl font-bold text-foreground">{formatPlanPrice(plan.price_cents, lb)}</span>
                <span className="text-sm text-muted-foreground">{getPlanPriceSuffix(plan.type, lb)}</span>
              </div>

              <div className="mb-5 rounded-xl border border-primary/15 bg-primary/5 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary/90">{lb.coverage_title}</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-background/80 p-1.5 shadow-sm">
                      <FileStack className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{lb.label_presell_pages}</p>
                      <p className="text-base font-bold tabular-nums text-foreground">{formatPagesLimit(plan.max_presell_pages)}</p>
                      <p className="text-[11px] text-muted-foreground">{lb.sub_presell_pages}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-background/80 p-1.5 shadow-sm">
                      <Gauge className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{lb.label_clicks}</p>
                      <p className="text-base font-bold tabular-nums text-foreground">{formatClicksLimit(plan.max_clicks_per_month)}</p>
                      <p className="text-[11px] text-muted-foreground">{lb.sub_clicks}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 border-t border-border/60 pt-3">
                    <div className="mt-0.5 rounded-lg bg-background/80 p-1.5 shadow-sm">
                      <Palette className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{lb.label_branding}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {plan.has_branding ? lb.branding_yes : lb.branding_no}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lb.includes_title}</p>
              <ul className="mb-6 flex-1 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => handleSelectPlan(plan)} variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"} className="w-full" disabled={isCurrent}>
                {planCardCtaLabel(plan, isCurrent, lb)}
              </Button>
            </div>
          );
        })}
      </div>

      {footerText ? (
        <div
          className={cn(
            "mt-10 rounded-xl border border-border/80 bg-muted/30 px-6 py-8 whitespace-pre-line",
            plansLandingFooterClasses({
              font: coerceFontFamily(landing?.footer_font),
              align: coerceTextAlign(landing?.footer_text_align),
              size: coerceBodySize(landing?.footer_text_size),
            }),
          )}
        >
          {footerText}
        </div>
      ) : null}

      {userPlan && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold text-foreground mb-4">{lb.section_your_plan_title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-xl p-4">
              <p className="text-sm text-muted-foreground">{lb.label_plan_col}</p>
              <p className="font-bold text-foreground">{userPlan.plan_name}</p>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <p className="text-sm text-muted-foreground">{lb.label_pages_col}</p>
              <p className="font-bold text-foreground">{userPlan.max_pages ?? lb.unlimited_pages}</p>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <p className="text-sm text-muted-foreground">{lb.label_clicks_col}</p>
              <p className="font-bold text-foreground">
                {userPlan.max_clicks ? userPlan.max_clicks.toLocaleString(numLocale) : lb.unlimited_clicks}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
