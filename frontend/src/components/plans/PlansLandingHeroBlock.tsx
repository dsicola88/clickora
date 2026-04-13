import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  coercePlansHeroVisual,
  plansHeroContentEntranceClass,
  plansHeroImageEffectClass,
  plansHeroOverlayClass,
} from "@/lib/plansLandingHeroVisual";

function HeroCtaButton({ href, label }: { href: string; label: string }) {
  const h = href.trim() || "#planos";
  if (h.startsWith("#")) {
    return (
      <Button asChild size="lg" className="font-semibold shadow-lg">
        <a href={h}>{label}</a>
      </Button>
    );
  }
  if (h.startsWith("/") && !h.startsWith("//")) {
    return (
      <Button asChild size="lg" className="font-semibold shadow-lg">
        <Link to={h}>{label}</Link>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" className="font-semibold shadow-lg">
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
};

/**
 * Hero da landing /planos: imagem com overlay, efeitos (Ken Burns, hover zoom, parallax),
 * animação de entrada do texto e CTA opcional — configurável no admin.
 */
export function PlansLandingHeroBlock({ heroImg, heroVisualRaw, children, className }: Props) {
  const v = coercePlansHeroVisual(heroVisualRaw);
  const overlay = plansHeroOverlayClass(v);
  const showCta = v.cta_enabled && Boolean(v.cta_label?.trim());
  const ctaLabel = v.cta_label?.trim() ?? "";
  const ctaHref = v.cta_href?.trim() || "#planos";

  return (
    <section
      className={cn(
        "group/plans-hero relative mb-8 overflow-hidden rounded-2xl border border-border/60 shadow-sm",
        "min-h-[220px] md:min-h-[280px]",
        className,
      )}
    >
      {heroImg ? (
        <>
          {v.image_effect === "parallax" ? (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat md:bg-fixed"
              style={{ backgroundImage: `url(${heroImg})` }}
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={heroImg}
                alt=""
                className={cn(
                  "absolute inset-0 h-full w-full object-cover will-change-transform",
                  plansHeroImageEffectClass(v),
                )}
              />
            </div>
          )}
          {overlay ? (
            <div className={cn("pointer-events-none absolute inset-0", overlay)} aria-hidden />
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10" />
      )}
      <div
        className={cn(
          "relative z-10 px-6 py-10 md:px-10 md:py-12",
          plansHeroContentEntranceClass(v),
        )}
      >
        {children}
        {showCta && ctaLabel ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <HeroCtaButton href={ctaHref} label={ctaLabel} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
