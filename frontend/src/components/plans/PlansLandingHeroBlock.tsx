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
  /** Texto claro sobre fundo escuro (tema «vendas»). */
  tone?: "default" | "dark";
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
}: Props) {
  const v = coercePlansHeroVisual(heroVisualRaw);
  const overlay = plansHeroOverlayClass(v);
  const showCta = v.cta_enabled && Boolean(v.cta_label?.trim());
  const ctaLabel = v.cta_label?.trim() ?? "";
  const ctaHref = v.cta_href?.trim() || "#planos";
  const dark = tone === "dark";

  return (
    <section
      className={cn(
        "group/plans-hero relative mb-8 overflow-hidden rounded-2xl shadow-sm",
        dark ? "border border-white/10 ring-1 ring-white/5" : "border border-border/60",
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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(59,130,246,0.18),transparent_55%)]"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "relative z-10 px-6 py-10 md:px-10 md:py-12",
          plansHeroContentEntranceClass(v),
          dark && "[&_h1]:text-white [&_h2]:text-white [&_p]:text-white/80 [&_span]:border-blue-400/40 [&_span]:bg-blue-500/15 [&_span]:text-blue-300",
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
