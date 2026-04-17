import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandingExtrasPublic } from "@/lib/plansLandingExtras";
import { LandingMarkdown } from "@/components/plans/LandingMarkdown";
import { resolveLandingPageTheme } from "@/lib/landingPageTheme";
import {
  landingTextStyleBodyClasses,
  landingTextStyleColorStyle,
  landingTextStyleTitleClasses,
} from "@/lib/plansLandingTextStyles";

type Props = {
  extras: LandingExtrasPublic;
  className?: string;
};

export function LandingGuaranteeSection({ extras, className }: Props) {
  const g = extras.guarantee;
  if (!g || g.enabled === false) return null;

  const hasSeal = Boolean(g.seal_image_url?.trim());
  const hasText = [g.title, g.lead, g.body, g.footer].some((x) => x?.trim());
  if (!hasSeal && !hasText) return null;

  const salesDark = extras.appearance === "sales_dark";
  const salesThemed = resolveLandingPageTheme(extras.theme);
  const ts = extras.text_styles;

  return (
    <section id="garantia" className={cn("scroll-mt-24 space-y-6", className)}>
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10 lg:gap-14">
        {hasSeal ? (
          <div className="mx-auto shrink-0 md:mx-0">
            <div
              className={cn(
                "relative h-40 w-40 overflow-hidden rounded-full border-4 shadow-lg md:h-48 md:w-48",
                salesDark ? "border-amber-400/50 ring-2 ring-amber-300/25" : "border-amber-500/40 ring-1 ring-border",
              )}
            >
              <img
                src={g.seal_image_url!}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-4 text-left">
          {g.title?.trim() ? (
            <h2
              className={cn(
                "text-2xl font-bold tracking-tight md:text-3xl",
                landingTextStyleTitleClasses(ts?.guarantee_title),
                !salesDark && "text-foreground",
                salesDark && !ts?.guarantee_title?.color && "text-white",
              )}
              style={landingTextStyleColorStyle(ts?.guarantee_title)}
            >
              {g.title}
            </h2>
          ) : null}

          {g.lead?.trim() ? (
            <p
              className={cn(
                "text-base leading-relaxed md:text-lg",
                landingTextStyleBodyClasses(ts?.guarantee_lead),
                salesDark && !ts?.guarantee_lead?.color ? "text-white/90" : !salesDark ? "text-muted-foreground" : "",
              )}
              style={landingTextStyleColorStyle(ts?.guarantee_lead)}
            >
              {g.lead}
            </p>
          ) : null}

          {g.body?.trim() ? (
            <div
              className={cn(
                "text-sm leading-relaxed md:text-base [&_p]:mb-3 [&_p:last-child]:mb-0",
                landingTextStyleBodyClasses(ts?.guarantee_body),
                salesDark && !ts?.guarantee_body?.color ? "text-white/80" : "",
              )}
              style={landingTextStyleColorStyle(ts?.guarantee_body)}
            >
              <LandingMarkdown
                content={g.body}
                surface={salesDark && !ts?.guarantee_body?.color?.trim() ? "dark_page" : "inherit"}
                salesTheme={salesThemed}
                colorOverrides={
                  ts?.guarantee_body?.color?.trim() && salesThemed
                    ? {
                        body: ts.guarantee_body.color!.trim(),
                        heading: ts.guarantee_body.color!.trim(),
                        link: salesThemed.link,
                        border: salesThemed.nav_border,
                      }
                    : null
                }
              />
            </div>
          ) : null}

          {g.footer?.trim() ? (
            <div
              className={cn(
                "flex gap-3 rounded-xl border px-4 py-3 md:items-start",
                salesDark ? "border-emerald-500/35 bg-emerald-500/10" : "border-emerald-600/25 bg-emerald-500/[0.06]",
              )}
            >
              <BadgeCheck
                className={cn("mt-0.5 h-6 w-6 shrink-0", salesDark ? "text-emerald-400" : "text-emerald-600")}
                aria-hidden
              />
              <div
                className={cn(
                  "min-w-0 text-sm leading-relaxed md:text-base",
                  landingTextStyleBodyClasses(ts?.guarantee_footer),
                )}
                style={landingTextStyleColorStyle(ts?.guarantee_footer)}
              >
                <LandingMarkdown
                  content={g.footer}
                  surface={salesDark && !ts?.guarantee_footer?.color?.trim() ? "dark_page" : "inherit"}
                  salesTheme={salesThemed}
                  colorOverrides={
                    ts?.guarantee_footer?.color?.trim() && salesThemed
                      ? {
                          body: ts.guarantee_footer.color!.trim(),
                          heading: ts.guarantee_footer.color!.trim(),
                          link: salesThemed.link,
                          border: salesThemed.nav_border,
                        }
                      : null
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
