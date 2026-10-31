import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLandingSalesTheme, useLandingSalesThemeOptional } from "@/contexts/LandingPageThemeContext";
import { cn } from "@/lib/utils";
import type { LandingExtrasPublic } from "@/lib/plansLandingExtras";
import {
  landingTextStyleBodyClasses,
  landingTextStyleColorStyle,
  landingTextStyleTitleClasses,
  landingTextStyleStatValueClasses,
} from "@/lib/plansLandingTextStyles";
import { Check } from "lucide-react";
import { LandingMarkdown } from "@/components/plans/LandingMarkdown";
import { LandingReveal } from "@/components/plans/LandingReveal";

type Props = {
  extras: LandingExtrasPublic;
  className?: string;
};

export function SalesLandingFeatures({ extras, className }: Props) {
  const t = useLandingSalesTheme();
  const salesDark = useLandingSalesThemeOptional() != null;
  const f = extras.features;
  const st = extras.text_styles;
  const cards =
    f?.cards?.filter((c) => c.title.trim() || c.body.trim() || c.image_url?.trim()) ?? [];
  if (!cards.length) return null;

  if (salesDark) {
    return (
      <section className={cn("space-y-8", className)}>
        {(f?.title?.trim() || f?.subtitle?.trim()) && (
          <div className="mx-auto max-w-3xl space-y-2 text-center">
            {f?.title?.trim() ? (
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{f.title}</h2>
            ) : null}
            {f?.subtitle?.trim() ? (
              <p className="whitespace-pre-line text-justify text-base leading-relaxed text-white/70 hyphens-auto [text-align-last:center]">
                {f.subtitle}
              </p>
            ) : null}
          </div>
        )}
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, i) => (
            <article key={`${card.title}-${i}`} className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-semibold tabular-nums" style={{ color: t.accent }}>
                {String(i + 1).padStart(2, "0")}
              </p>
              {card.title.trim() ? <h3 className="mt-3 text-lg font-semibold leading-snug text-white">{card.title}</h3> : null}
              {card.body.trim() ? (
                <p className="mt-3 flex-1 text-justify text-sm leading-relaxed text-white/70 hyphens-auto [text-align-last:start]">
                  {card.body}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    );
  }

  /** Faixa clara tipo landing de produto: texto escuro por defeito; tipografia opcional sobrepõe. */
  const bandClass =
    "rounded-2xl border border-stone-200/90 bg-[#f4f1e9] px-4 py-10 shadow-sm md:px-8 md:py-12 dark:border-stone-200/90";

  return (
    <section className={cn(bandClass, "space-y-8 md:space-y-10", className)}>
      {(f?.title?.trim() || f?.subtitle?.trim()) && (
        <div className="mx-auto max-w-3xl space-y-2 text-center">
          {f?.title?.trim() ? (
            <h2
              className={cn(
                "text-2xl font-bold tracking-tight text-slate-900 md:text-3xl",
                st?.features_title && landingTextStyleTitleClasses(st.features_title),
              )}
              style={{
                ...(!st?.features_title?.color ? { color: "#0f172a" } : {}),
                ...landingTextStyleColorStyle(st?.features_title),
              }}
            >
              {f.title}
            </h2>
          ) : null}
          {f?.subtitle?.trim() ? (
            <p
              className={cn(
                "whitespace-pre-line text-slate-600",
                st?.features_subtitle && landingTextStyleBodyClasses(st.features_subtitle),
              )}
              style={{
                ...(!st?.features_subtitle?.color ? { color: "#475569" } : {}),
                ...landingTextStyleColorStyle(st?.features_subtitle),
              }}
            >
              {f.subtitle}
            </p>
          ) : null}
        </div>
      )}
      <div
        className={cn(
          "grid grid-cols-1 gap-8 md:gap-6 lg:gap-8",
          cards.length === 4
            ? "sm:grid-cols-2"
            : cards.length > 4
              ? "sm:grid-cols-2 xl:grid-cols-3"
              : "md:grid-cols-3",
        )}
      >
        {cards.map((card, i) => {
          const img = card.image_url?.trim();
          return (
            <LandingReveal key={i} delayMs={i * 80}>
              <div className="flex min-w-0 flex-col text-left transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
              {img ? (
                <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg bg-stone-200/80 ring-1 ring-stone-300/60">
                  <img
                    src={img}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105 motion-reduce:transition-none"
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width:768px) 100vw, 33vw"
                  />
                </div>
              ) : (
                <div
                  className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${t.accent}22` }}
                >
                  <Check className="h-5 w-5" style={{ color: t.accent }} aria-hidden />
                </div>
              )}
              {card.title.trim() ? (
                <h3
                  className={cn(
                    "mb-2 text-lg font-bold leading-snug text-slate-900 md:text-xl",
                    st?.feature_card_title && landingTextStyleTitleClasses(st.feature_card_title),
                  )}
                  style={landingTextStyleColorStyle(st?.feature_card_title)}
                >
                  {card.title}
                </h3>
              ) : null}
              {card.body.trim() ? (
                <div
                  className={cn(
                    "text-slate-700 [&_a]:text-slate-900 [&_a]:underline",
                    st?.feature_card_body && landingTextStyleBodyClasses(st.feature_card_body),
                  )}
                  style={landingTextStyleColorStyle(st?.feature_card_body)}
                >
                  <LandingMarkdown content={card.body} surface="light_card" />
                </div>
              ) : null}
            </div>
            </LandingReveal>
          );
        })}
      </div>
    </section>
  );
}

export function SalesLandingStats({ extras, className }: Props) {
  const t = useLandingSalesTheme();
  const salesDark = useLandingSalesThemeOptional() != null;
  const s = extras.stats;
  const st = extras.text_styles;
  const items = s?.items?.filter((it) => it.value.trim() || it.label.trim()) ?? [];
  if (!items.length) return null;

  const headingColor = salesDark ? t.heading_on_dark : undefined;
  const mutedColor = salesDark ? t.muted_on_dark : undefined;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border px-6 py-12 md:px-10",
        !salesDark && "border-border/70 bg-muted/30",
        className,
      )}
      style={
        salesDark
          ? {
              borderColor: t.stats_border,
              background: `linear-gradient(to bottom, ${t.stats_gradient_from}, ${t.stats_gradient_to})`,
            }
          : undefined
      }
    >
      {salesDark ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            background: `radial-gradient(ellipse at center, ${t.stats_glow}, transparent 70%)`,
          }}
          aria-hidden
        />
      ) : null}
      <div className="relative space-y-8">
        {(s?.title?.trim() || s?.subtitle?.trim()) && (
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            {s?.title?.trim() ? (
              <h2
                className={cn(
                  "text-2xl font-bold tracking-tight md:text-3xl",
                  !salesDark && !st?.stats_title?.color && "text-foreground",
                  st?.stats_title && landingTextStyleTitleClasses(st.stats_title),
                )}
                style={{
                  ...(!st?.stats_title?.color && headingColor ? { color: headingColor } : {}),
                  ...landingTextStyleColorStyle(st?.stats_title),
                }}
              >
                {s.title}
              </h2>
            ) : null}
            {s?.subtitle?.trim() ? (
              <p
                className={cn(
                  "whitespace-pre-line leading-relaxed hyphens-auto [text-align-last:center]",
                  !salesDark && !st?.stats_subtitle?.color && "text-muted-foreground",
                  st?.stats_subtitle && landingTextStyleBodyClasses(st.stats_subtitle),
                  "text-justify",
                )}
                style={{
                  ...(!st?.stats_subtitle?.color && mutedColor ? { color: mutedColor } : {}),
                  ...landingTextStyleColorStyle(st?.stats_subtitle),
                }}
              >
                {s.subtitle}
              </p>
            ) : null}
          </div>
        )}
        <div
          className={cn(
            "grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8",
            items.length === 3
              ? "lg:grid-cols-3"
              : items.length >= 4
                ? "xl:grid-cols-4"
                : "lg:grid-cols-3",
          )}
        >
          {items.map((it, i) => (
            <div key={i} className="min-w-0 text-center px-1">
              <p
                className={cn(
                  st?.stat_value
                    ? landingTextStyleStatValueClasses(st.stat_value)
                    : "text-2xl font-extrabold tabular-nums sm:text-3xl md:text-4xl",
                  !salesDark && !st?.stat_value?.color && "text-foreground",
                )}
                style={{
                  ...(!st?.stat_value?.color && headingColor ? { color: headingColor } : {}),
                  ...landingTextStyleColorStyle(st?.stat_value),
                }}
              >
                {it.value}
              </p>
              <p
                className={cn(
                  "mt-2 text-sm leading-relaxed hyphens-auto [text-align-last:center] break-words",
                  !salesDark && !st?.stat_label?.color && "text-muted-foreground",
                  st?.stat_label && landingTextStyleBodyClasses(st.stat_label),
                  "text-center",
                )}
                style={{
                  ...(!st?.stat_label?.color && mutedColor ? { color: mutedColor } : {}),
                  ...landingTextStyleColorStyle(st?.stat_label),
                }}
              >
                {it.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SalesLandingFaq({ extras, className }: Props) {
  const t = useLandingSalesTheme();
  const salesDark = useLandingSalesThemeOptional() != null;
  const faq = extras.faq;
  const st = extras.text_styles;
  const items = faq?.items?.filter((it) => it.q.trim()) ?? [];
  if (!items.length) return null;

  const title = faq?.title?.trim() || "Perguntas frequentes";
  const headingColor = salesDark ? t.heading_on_dark : undefined;
  const mutedColor = salesDark ? t.muted_on_dark : undefined;

  return (
    <section className={cn("space-y-6", className)}>
      <h2
        className={cn(
          "text-center text-2xl font-bold tracking-tight md:text-3xl",
          !salesDark && !st?.faq_title?.color && "text-foreground",
          st?.faq_title && landingTextStyleTitleClasses(st.faq_title),
        )}
        style={{
          ...(!st?.faq_title?.color && headingColor ? { color: headingColor } : {}),
          ...landingTextStyleColorStyle(st?.faq_title),
        }}
      >
        {title}
      </h2>
      <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto space-y-2">
        {items.map((it, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className={cn(
              "rounded-lg px-4 data-[state=open]:opacity-[0.98]",
              salesDark ? "bg-black/20" : "bg-card border-border/70",
            )}
            style={{
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: salesDark ? t.faq_border : undefined,
            }}
          >
            <AccordionTrigger
              className={cn(
                "text-left hover:no-underline py-4 text-sm md:text-base font-medium",
                !salesDark && !st?.faq_question?.color && "text-foreground",
                st?.faq_question && landingTextStyleBodyClasses(st.faq_question),
              )}
              style={{
                ...(!st?.faq_question?.color && headingColor ? { color: headingColor } : {}),
                ...landingTextStyleColorStyle(st?.faq_question),
              }}
            >
              {it.q}
            </AccordionTrigger>
            <AccordionContent
              className={cn(
                "whitespace-pre-line border-t pb-4 pt-3 leading-relaxed hyphens-auto [text-align-last:start]",
                !salesDark && !st?.faq_answer?.color && "text-muted-foreground",
                st?.faq_answer && landingTextStyleBodyClasses(st.faq_answer),
                "text-justify",
              )}
              style={{
                ...(salesDark
                  ? !st?.faq_answer?.color
                    ? { color: mutedColor, borderColor: `${t.accent}33` }
                    : { borderColor: `${t.accent}33` }
                  : { borderColor: "hsl(var(--border))" }),
                ...landingTextStyleColorStyle(st?.faq_answer),
              }}
            >
              {it.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function SalesLandingLegalFooter({ extras, className }: Props) {
  const t = useLandingSalesTheme();
  const salesDark = useLandingSalesThemeOptional() != null;
  const st = extras.text_styles;
  const lf = extras.legal_footer;
  const lines = lf?.lines ?? [];
  const links = lf?.links ?? [];
  if (!lines.length && !links.length) return null;

  return (
    <footer
      className={cn(
        "mt-10 space-y-4 border-t pt-8 text-center",
        !salesDark && "border-border/60",
        className,
      )}
      style={salesDark ? { borderColor: t.nav_border } : undefined}
    >
      {lines.length > 0 && (
        <div
          className={cn(
            "mx-auto max-w-3xl space-y-2",
            !salesDark && !st?.legal_footer?.color && "text-muted-foreground",
            st?.legal_footer && landingTextStyleBodyClasses(st.legal_footer),
          )}
          style={{
            ...(!st?.legal_footer?.color && salesDark ? { color: t.muted_on_dark } : {}),
            ...landingTextStyleColorStyle(st?.legal_footer),
          }}
        >
          {lines.map((line, i) => (
            <p key={i} className="whitespace-pre-line text-justify leading-relaxed hyphens-auto [text-align-last:center]">
              {line}
            </p>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {links.map((lnk, i) => (
            <a
              key={i}
              href={lnk.href}
              className={cn(
                "underline-offset-4 hover:underline",
                !salesDark && !st?.legal_footer?.color && "text-primary",
              )}
              style={
                salesDark || st?.legal_footer?.color
                  ? {
                      color: st?.legal_footer?.color?.trim() || t.link,
                    }
                  : undefined
              }
            >
              {lnk.label}
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
