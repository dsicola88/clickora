import { type CSSProperties, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { SalesProductDemo } from "@/components/plans/SalesProductDemo";
import { coerceLandingExtras } from "@/lib/plansLandingExtras";
import { resolveSectionsEnabled } from "@/lib/landingSectionLayout";
import { LandingPageBodySections } from "@/components/plans/LandingPageBodySections";
import {
  resolveLandingPageTheme,
  resolvedAccentButtonBoxShadow,
  resolvedAccentButtonRadiusStyle,
} from "@/lib/landingPageTheme";
import { LandingMarkdown } from "@/components/plans/LandingMarkdown";
import { LandingPageThemeProvider } from "@/contexts/LandingPageThemeContext";
import { applyMarketingLandingHead } from "@/lib/marketingSiteSeo";
import { DEFAULT_LANDING_HERO_IMAGE, coercePlansHeroVisual } from "@/lib/plansLandingHeroVisual";

export default function Plans() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    return applyMarketingLandingHead(pathname);
  }, [pathname]);
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
        "O checkout deste plano ainda não está ligado. Contacte o suporte.",
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

  const OLD_HERO_TITLES = new Set([
    "Escolha seu plano",
    "A plataforma completa para presells e rastreamento",
    "Publique presells e meça cada clique — sem mentir nos números",
  ]);
  const defaultHeroTitle = "Da criação da presell ao acompanhamento das vendas. Tudo num só lugar.";
  const defaultHeroSubtitle =
    "Crie páginas para as suas ofertas, prepare as suas campanhas de anúncios e acompanhe os resultados sem precisar de juntar várias ferramentas.";
  const rawTitle = landing?.hero_title?.trim() ?? "";
  const heroTitle = !rawTitle || OLD_HERO_TITLES.has(rawTitle) ? defaultHeroTitle : rawTitle;
  const rawSubtitle = landing?.hero_subtitle?.trim() ?? "";
  const heroSubtitle =
    !rawSubtitle ||
    rawSubtitle.startsWith("Crie páginas que convertem, meça cada clique") ||
    rawSubtitle.startsWith("Limites por plano nos cartões")
      ? defaultHeroSubtitle
      : rawSubtitle;
  const badgeText = landing?.badge_text?.trim() ?? "";
  const introText = landing?.intro_text?.trim() ?? "";
  const footerText = landing?.footer_text?.trim() ?? "";
  const heroImg =
    landing?.has_hero_image && landing.updated_at
      ? plansLandingService.heroImageHref(landing.updated_at)
      : DEFAULT_LANDING_HERO_IMAGE;
  const heroVisualRaw = (() => {
    const v = coercePlansHeroVisual(landing?.hero_visual);
    if (landing?.has_hero_image) return landing?.hero_visual;
    // 1ª dobra com imagem padrão: altura generosa + movimento suave.
    return {
      ...v,
      min_height_mobile_px: Math.max(v.min_height_mobile_px, 420),
      min_height_desktop_px: Math.max(v.min_height_desktop_px, 560),
      image_effect: v.image_effect === "none" ? "ken-burns" : v.image_effect,
    };
  })();

  const lb = mergeWithDefaultLabels(landing?.plan_display_labels);
  const extras = coerceLandingExtras(landing?.landing_extras);
  const ts = extras.text_styles ?? undefined;
  const salesDark = extras.appearance === "sales_dark";
  const sectionsOn = resolveSectionsEnabled(extras.sections_enabled);
  const heroVisual = coercePlansHeroVisual(heroVisualRaw);
  const heroCtaLabel = heroVisual.cta_label?.trim() ?? "";
  const heroCtaHref = heroVisual.cta_href?.trim() || "#planos";
  const showHeroCta = heroVisual.cta_enabled && Boolean(heroCtaLabel);
  const showProductDemo = sectionsOn.product_demo && extras.product_demo != null;
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
            salesDark
              ? "mx-auto flex w-full max-w-6xl items-center justify-between gap-4"
              : "mx-auto grid w-full max-w-2xl grid-cols-1 gap-2 sm:max-w-lg sm:grid-cols-2 sm:gap-3",
          )}
          aria-label="Ações da página"
        >
          {salesDark ? (
            <Link to="/" className="text-base font-semibold tracking-tight text-white">
              Clickora
            </Link>
          ) : null}
          {salesDark ? (
            <div className="flex items-center gap-3 sm:gap-5">
              {userPlan ? (
                <span className="hidden text-sm text-white/60 sm:inline">{userPlan.plan_name}</span>
              ) : null}
              <Link
                to={user ? "/inicio" : "/auth"}
                className="text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
              >
                {user ? "Painel" : "Entrar"}
              </Link>
              {showHeroCta ? (
              <Button
                size="sm"
                className="h-10 border-0 px-4 text-white hover:opacity-[0.92]"
                style={{
                  backgroundColor: salesThemed.accent,
                  boxShadow: resolvedAccentButtonBoxShadow(salesThemed),
                  ...resolvedAccentButtonRadiusStyle(salesThemed),
                }}
                asChild
              >
                <a href={heroCtaHref}>{heroCtaLabel}</a>
              </Button>
              ) : null}
            </div>
          ) : null}
          {salesDark ? null : (
          <>
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
          </>
          )}
        </nav>
      </div>

      {salesDark ? null : (
      <nav
        className={cn(
          "mb-4 flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-center sm:gap-3",
          "border-border/50 bg-muted/35",
        )}
        aria-label="Soluções por objetivo"
      >
        <span
          className={cn(
            "text-center text-[0.7rem] font-semibold uppercase tracking-wider sm:text-left",
            salesDark ? "text-white/50" : "text-muted-foreground",
          )}
        >
          Por objetivo
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
          <Link
            to="/presell-para-afiliados"
            className={cn(
              "underline-offset-4 hover:underline",
              salesDark ? "font-medium text-white" : "font-medium text-primary",
            )}
          >
            Presell para afiliados
          </Link>
          <span className={salesDark ? "text-white/35" : "text-muted-foreground/50"} aria-hidden>
            ·
          </span>
          <Link
            to="/rastreamento-afiliados"
            className={cn(
              "underline-offset-4 hover:underline",
              salesDark ? "font-medium text-white" : "font-medium text-primary",
            )}
          >
            Rastreamento e conversões
          </Link>
          <span className={salesDark ? "text-white/35" : "text-muted-foreground/50"} aria-hidden>
            ·
          </span>
          <Link
            to="/guia-vendas-afiliados"
            className={cn(
              "underline-offset-4 hover:underline",
              salesDark ? "font-medium text-white" : "font-medium text-primary",
            )}
          >
            Guia: presell e tracking
          </Link>
        </div>
      </nav>
      )}

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
            <Link to="/admin/plans">
              <LayoutTemplate className="h-4 w-4" />
              Abrir editor da landing
            </Link>
          </Button>
        </div>
      )}

      {salesDark ? (
        <section className={cn("grid items-center gap-8", showProductDemo && "md:grid-cols-2 md:gap-10")}>
          <div className="space-y-5">
            {badgeText ? (
              <span
                className="inline-flex w-fit max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{
                  borderColor: salesThemed.badge_border,
                  backgroundColor: salesThemed.badge_background,
                  color: salesThemed.badge_text,
                }}
              >
                {badgeText}
              </span>
            ) : null}
            <h1
              className={cn(
                resolvedHeroTitleClassNameFixed(
                  {
                    hero_title_size: landing?.hero_title_size,
                    hero_title_weight: landing?.hero_title_weight,
                  },
                  ts?.hero_title,
                ),
                "text-white",
              )}
              style={landingTextStyleColorStyle(ts?.hero_title)}
            >
              {heroTitle}
            </h1>
            {heroSubtitle ? (
              <p className="text-justify text-lg leading-relaxed text-white/75 hyphens-auto [text-align-last:start]">
                {heroSubtitle}
              </p>
            ) : null}
            {extras.hero_note?.trim() ? (
              <p className="text-justify text-sm leading-relaxed text-white/60 hyphens-auto [text-align-last:start]">
                {extras.hero_note}
              </p>
            ) : null}
            {showHeroCta ? (
              <Button
                size="lg"
                className="h-12 border-0 px-6 text-base text-white hover:opacity-[0.92]"
                style={{
                  backgroundColor: salesThemed.accent,
                  boxShadow: resolvedAccentButtonBoxShadow(salesThemed),
                  ...resolvedAccentButtonRadiusStyle(salesThemed),
                }}
                asChild
              >
                <a href={heroCtaHref}>{heroCtaLabel}</a>
              </Button>
            ) : null}
          </div>
          {showProductDemo && extras.product_demo ? <SalesProductDemo demo={extras.product_demo} /> : null}
        </section>
      ) : (
      <PlansLandingHeroBlock
        heroImg={heroImg}
        heroVisualRaw={heroVisualRaw}
        tone="default"
        salesTheme={null}
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
      )}

      {!salesDark && userPlan ? (
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
      ) : null}

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

      {sectionsOn.account_plan && userPlan ? (
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
      ) : null}
      </div>
    </div>
    </LandingPageThemeProvider>
  );
}
