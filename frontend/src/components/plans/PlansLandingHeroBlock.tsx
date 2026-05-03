import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResolvedLandingPageTheme } from "@/lib/landingPageTheme";
import {
  coercePlansHeroVisual,
  plansHeroContentEntranceClass,
  plansHeroImageEffectClass,
  plansHeroImagePositionStyle,
  plansHeroMinHeightStyle,
  plansHeroOverlayClass,
} from "@/lib/plansLandingHeroVisual";

function HeroCtaButton({
  href,
  label,
  dark,
  salesTheme,
}: {
  href: string;
  label: string;
  dark?: boolean;
  salesTheme?: ResolvedLandingPageTheme | null;
}) {
  const h = href.trim() || "#planos";
  const cls = cn(
    "font-semibold shadow-lg border-0 text-white",
    dark && !salesTheme && "bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_28px_-6px_rgba(16,185,129,0.5)]",
    dark && salesTheme && "hover:opacity-[0.92]",
  );
  const ctaStyle: CSSProperties | undefined =
    dark && salesTheme
      ? {
          backgroundColor: salesTheme.accent,
          boxShadow: `0 0 28px -6px ${salesTheme.accent}88`,
        }
      : undefined;
  if (h.startsWith("#")) {
    return (
      <Button asChild size="lg" className={cls} style={ctaStyle}>
        <a href={h}>{label}</a>
      </Button>
    );
  }
  if (h.startsWith("/") && !h.startsWith("//")) {
    return (
      <Button asChild size="lg" className={cls} style={ctaStyle}>
        <Link to={h}>{label}</Link>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" className={cls} style={ctaStyle}>
      <a href={h} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </Button>
  );
}

type Props = {
  heroImg: string | null;
  heroVisualRaw: unknown;
  children: React.ReactNode;
  className?: string;
  /** Texto claro sobre fundo escuro (tema «vendas»). */
  tone?: "default" | "dark";
  /** Cores resolvidas (landing_extras.theme); opcional. */
  salesTheme?: ResolvedLandingPageTheme | null;
};

/**
 * Hero da landing pública (/, alias /plans): imagem com overlay, efeitos (Ken Burns, hover zoom, parallax),
 * animação de entrada do texto e CTA opcional — configurável no admin.
 */
export function PlansLandingHeroBlock({
  heroImg,
  heroVisualRaw,
  children,
  className,
  tone = "default",
  salesTheme = null,
}: Props) {
  const v = coercePlansHeroVisual(heroVisualRaw);
  const overlay = plansHeroOverlayClass(v);
  const posStyle = plansHeroImagePositionStyle(v);
  const showCta = v.cta_enabled && Boolean(v.cta_label?.trim());
  const ctaLabel = v.cta_label?.trim() ?? "";
  const ctaHref = v.cta_href?.trim() || "#planos";
  const dark = tone === "dark";

  const glowStyle =
    dark && salesTheme
      ? {
          background: `radial-gradient(ellipse at 50% 20%, ${salesTheme.stats_glow}, transparent 55%)`,
        }
      : undefined;

  return (
    <section
      style={plansHeroMinHeightStyle(v)}
      className={cn(
        "group/plans-hero relative mb-8 overflow-hidden rounded-2xl shadow-sm",
        dark ? "border border-white/10 ring-1 ring-white/5" : "border border-border/60",
        "min-h-[var(--plans-hero-min-sm)] md:min-h-[var(--plans-hero-min-md)]",
        className,
      )}
    >
      {heroImg ? (
        <>
          {v.image_effect === "parallax" ? (
            <div
              className="absolute inset-0 bg-cover bg-no-repeat md:bg-fixed motion-reduce:md:bg-scroll"
              style={{
                backgroundImage: `url(${heroImg})`,
                backgroundPosition: posStyle.backgroundPosition,
              }}
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={heroImg}
                alt=""
                sizes="(max-width: 1280px) 100vw, 80rem"
                className={cn(
                  "absolute inset-0 h-full w-full max-w-none object-cover will-change-transform",
                  plansHeroImageEffectClass(v),
                )}
                style={{ objectPosition: posStyle.objectPosition }}
              />
            </div>
          )}
          {overlay ? (
            <div className={cn("pointer-events-none absolute inset-0", overlay)} aria-hidden />
          ) : null}
          {dark ? (
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-black/30"
              aria-hidden
            />
          ) : null}
        </>
      ) : (
        <div
          className={cn(
            "absolute inset-0",
            dark
              ? "bg-gradient-to-br from-[#0a1628] via-[#050a18] to-black"
              : "bg-gradient-to-br from-primary/20 via-background to-accent/10",
          )}
        />
      )}
      {dark && !heroImg ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0",
            !glowStyle && "bg-[radial-gradient(ellipse_at_50%_20%,rgba(16,185,129,0.14),transparent_55%)]",
          )}
          style={glowStyle}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "relative z-10 px-6 py-10 md:px-10 md:py-12",
          plansHeroContentEntranceClass(v),
          dark && !salesTheme && "[&_h1]:text-white [&_h2]:text-white [&_p]:text-white/80 [&_span]:border-emerald-400/45 [&_span]:bg-emerald-500/12 [&_span]:text-emerald-200",
          dark && salesTheme && "[&_h1]:text-white [&_h2]:text-white [&_p]:text-white/80",
        )}
      >
        {children}
        {showCta && ctaLabel ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <HeroCtaButton href={ctaHref} label={ctaLabel} dark={dark} salesTheme={salesTheme} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
