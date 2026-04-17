import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { plansService } from "@/services/plansService";
import { plansLandingService } from "@/services/plansLandingService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, LogIn, ShoppingBag, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { APP_PAGE_SHELL_LOOSE } from "@/lib/appPageLayout";
import type { Plan } from "@/types/api";
import { cn } from "@/lib/utils";
import {
  landingTextStyleColorStyle,
  landingTextStyleLabelClasses,
  resolvedFooterClasses,
  resolvedHeroInnerClasses,
  resolvedHeroSubtitleMarkdownClasses,
  resolvedHeroTitleClassNameFixed,
  resolvedIntroClasses,
} from "@/lib/plansLandingTextStyles";
import { mergeWithDefaultLabels } from "@/lib/planDisplayLabels";
import { PlansLandingHeroBlock } from "@/components/plans/PlansLandingHeroBlock";
import { SalesLandingLegalFooter } from "@/components/plans/SalesLandingSections";
import { coerceLandingExtras } from "@/lib/plansLandingExtras";
import { LandingPageBodySections } from "@/components/plans/LandingPageBodySections";
import {
  resolveLandingPageTheme,
  resolvedAccentButtonBoxShadow,
  resolvedAccentButtonRadiusStyle,
} from "@/lib/landingPageTheme";
import { LandingMarkdown } from "@/components/plans/LandingMarkdown";
import { LandingPageThemeProvider } from "@/contexts/LandingPageThemeContext";

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
    "Limites de presells e cliques por plano estão nos cartões. O que segue descreve as funcionalidades da plataforma — resultados de campanha dependem da sua oferta e tráfego.";
  const badgeText = landing?.badge_text?.trim() ?? "";
  const introText = landing?.intro_text?.trim() ?? "";
  const footerText = landing?.footer_text?.trim() ?? "";
  const heroImg =
    landing?.has_hero_image && landing.updated_at
      ? plansLandingService.heroImageHref(landing.updated_at)
      : null;

  const lb = mergeWithDefaultLabels(landing?.plan_display_labels);
  const extras = coerceLandingExtras(landing?.landing_extras);
  const ts = extras.text_styles ?? undefined;
  const salesDark = extras.appearance === "sales_dark";
  const salesThemed = resolveLandingPageTheme(extras.theme);
  const numLocale = lb.locale || "pt-BR";

  const formatPagesLimit = (n: number | null) =>
    n === null || n === undefined ? lb.unlimited_pages : n.toLocaleString(numLocale);

  const formatClicksLimit = (n: number | null) =>
    n === null || n === undefined ? lb.unlimited_clicks : n.toLocaleString(numLocale);

  const navSurface: CSSProperties | undefined = salesDark
    ? {
        backgroundColor: salesThemed.nav_background,
        borderColor: salesThemed.nav_border,
      }
    : undefined;

  const selectionCss =
    salesDark &&
    `[data-plans-sales-root]::selection{background:${salesThemed.selection_bg}}`;

  return (
    <LandingPageThemeProvider value={salesDark ? salesThemed : null}>
      {selectionCss ? <style dangerouslySetInnerHTML={{ __html: selectionCss }} /> : null}
      <div
        data-plans-sales-root={salesDark ? true : undefined}
        className={cn(
          "min-h-svh w-full px-4 pb-12 pt-2 md:px-6 md:pb-14 md:pt-4 lg:px-8 lg:pb-16",
          salesDark ? "text-white" : "bg-background text-foreground",
        )}
        style={
          salesDark
            ? { backgroundColor: salesThemed.page_background, color: salesThemed.heading_on_dark }
            : undefined
        }
      >
      <div
        className={cn(
          APP_PAGE_SHELL_LOOSE,
          salesDark && "relative py-8 md:py-12",
        )}
      >
      <div
        className={cn(
          "sticky top-0 z-40 mb-6 border-b py-3 backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md",
          salesDark ? "border-b" : "border-border/60 bg-background/90 supports-[backdrop-filter]:bg-background/75",
        )}
        style={salesDark ? navSurface : undefined}
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
              "min-h-10 w-full gap-2 sm:min-w-0 border-0 text-white hover:opacity-[0.92]",
            )}
            style={
              salesDark
                ? {
                    backgroundColor: salesThemed.accent,
                    boxShadow: resolvedAccentButtonBoxShadow(salesThemed),
                    ...resolvedAccentButtonRadiusStyle(salesThemed),
                  }
                : undefined
            }
            asChild
          >
            <a
              href="#planos"
              className="inline-flex items-center justify-center"
            >
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
                salesDark && "text-white hover:opacity-95",
              )}
              style={
                salesDark
                  ? {
                      borderColor: salesThemed.outline_nav_border,
                      backgroundColor: salesThemed.outline_nav_bg,
                      color: salesThemed.heading_on_dark,
                    }
                  : undefined
              }
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
                salesDark && "text-white hover:opacity-95",
              )}
              style={
                salesDark
                  ? {
                      borderColor: salesThemed.outline_nav_border,
                      backgroundColor: salesThemed.outline_nav_bg,
                      color: salesThemed.heading_on_dark,
                    }
                  : undefined
              }
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
        salesTheme={salesDark ? salesThemed : null}
      >
        <div
          className={cn(
            resolvedHeroInnerClasses(
              {
                hero_font: landing?.hero_font,
                hero_text_align: landing?.hero_text_align,
              },
              ts?.hero_title,
            ),
          )}
        >
          {badgeText ? (
            <span
              className={cn(
                "inline-flex w-fit max-w-full items-center rounded-full border px-3 py-1 font-semibold uppercase tracking-wider",
                !salesDark && "border-primary/35 bg-primary/10 text-primary",
                ts?.hero_badge && landingTextStyleLabelClasses(ts.hero_badge),
              )}
              style={{
                ...(salesDark
                  ? {
                      borderColor: salesThemed.badge_border,
                      backgroundColor: salesThemed.badge_background,
                      color: salesThemed.badge_text,
                    }
                  : {}),
                ...(ts?.hero_badge?.color?.trim() ? { color: ts.hero_badge.color.trim() } : {}),
              }}
            >
              {badgeText}
            </span>
          ) : null}
          <h1
            className={resolvedHeroTitleClassNameFixed(
              {
                hero_title_size: landing?.hero_title_size,
                hero_title_weight: landing?.hero_title_weight,
              },
              ts?.hero_title,
            )}
            style={landingTextStyleColorStyle(ts?.hero_title)}
          >
            {heroTitle}
          </h1>
          {heroSubtitle ? (
            <LandingMarkdown
              content={heroSubtitle}
              surface={salesDark && !ts?.hero_subtitle?.color?.trim() ? "dark_page" : "inherit"}
              salesTheme={salesDark ? salesThemed : null}
              colorOverrides={
                ts?.hero_subtitle?.color?.trim()
                  ? {
                      body: ts.hero_subtitle.color.trim(),
                      heading: ts.hero_subtitle.color.trim(),
                      link: salesThemed.link,
                      border: salesThemed.nav_border,
                    }
                  : null
              }
              sizeClassName={undefined}
              className={cn(
                resolvedHeroSubtitleMarkdownClasses(
                  {
                    hero_subtitle_size: landing?.hero_subtitle_size,
                  },
                  ts?.hero_subtitle,
                ),
                !salesDark && !ts?.hero_subtitle?.color && "text-muted-foreground",
              )}
            />
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
            "mb-8 max-w-3xl",
            resolvedIntroClasses(
              {
                intro_font: landing?.intro_font,
                intro_text_align: landing?.intro_text_align,
                intro_text_size: landing?.intro_text_size,
              },
              ts?.intro,
              { omitColor: salesDark || Boolean(ts?.intro?.color?.trim()) },
            ),
          )}
          style={landingTextStyleColorStyle(ts?.intro)}
        >
          <LandingMarkdown
            content={introText}
            surface={salesDark && !ts?.intro?.color?.trim() ? "dark_page" : "inherit"}
            salesTheme={salesDark ? salesThemed : null}
            colorOverrides={
              ts?.intro?.color?.trim()
                ? {
                    body: ts.intro.color.trim(),
                    heading: ts.intro.color.trim(),
                    link: salesThemed.link,
                    border: salesThemed.nav_border,
                  }
                : null
            }
          />
        </div>
      ) : null}

      <LandingPageBodySections
        extras={extras}
        plans={plans}
        planLabels={lb}
        userPlan={userPlan ? { plan_type: userPlan.plan_type } : null}
        onSelectPlan={(plan) => {
          void handleSelectPlan(plan);
        }}
      />

      {footerText ? (
        <div
          className={cn(
            "mt-10 rounded-xl border px-6 py-8",
            salesDark
              ? "border-white/10 bg-white/[0.04] text-white/90"
              : "border-border/80 bg-muted/30",
            resolvedFooterClasses(
              {
                footer_font: landing?.footer_font,
                footer_text_align: salesDark ? "center" : landing?.footer_text_align,
                footer_text_size: landing?.footer_text_size,
              },
              ts?.footer,
              { omitColor: salesDark || Boolean(ts?.footer?.color?.trim()) },
            ),
          )}
          style={landingTextStyleColorStyle(ts?.footer)}
        >
          <LandingMarkdown
            content={footerText}
            surface={salesDark && !ts?.footer?.color?.trim() ? "dark_page" : "inherit"}
            salesTheme={salesDark ? salesThemed : null}
            colorOverrides={
              ts?.footer?.color?.trim()
                ? {
                    body: ts.footer.color.trim(),
                    heading: ts.footer.color.trim(),
                    link: salesThemed.link,
                    border: salesThemed.nav_border,
                  }
                : null
            }
          />
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
    </LandingPageThemeProvider>
  );
}
