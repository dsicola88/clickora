import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLandingSalesTheme } from "@/contexts/LandingPageThemeContext";
import { cn } from "@/lib/utils";
import type { LandingExtrasPublic } from "@/lib/plansLandingExtras";
import { Check } from "lucide-react";

type Props = {
  extras: LandingExtrasPublic;
  className?: string;
};

export function SalesLandingFeatures({ extras, className }: Props) {
  const t = useLandingSalesTheme();
  const f = extras.features;
  const cards = f?.cards?.filter((c) => c.title.trim() || c.body.trim()) ?? [];
  if (!cards.length) return null;

  return (
    <section className={cn("space-y-6", className)}>
      {(f?.title?.trim() || f?.subtitle?.trim()) && (
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          {f?.title?.trim() ? (
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: t.heading_on_dark }}>
              {f.title}
            </h2>
          ) : null}
          {f?.subtitle?.trim() ? (
            <p className="text-sm whitespace-pre-line" style={{ color: t.muted_on_dark }}>
              {f.subtitle}
            </p>
          ) : null}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl p-6 text-slate-900 shadow-lg transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-2xl",
            )}
            style={{ backgroundColor: t.card_surface }}
          >
            <div
              className="mb-3 h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${t.accent}22` }}
            >
              <Check className="h-5 w-5" style={{ color: t.accent }} aria-hidden />
            </div>
            {card.title.trim() ? (
              <h3 className="font-bold text-slate-900 mb-2 text-lg">{card.title}</h3>
            ) : null}
            {card.body.trim() ? (
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{card.body}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SalesLandingStats({ extras, className }: Props) {
  const t = useLandingSalesTheme();
  const s = extras.stats;
  const items = s?.items?.filter((it) => it.value.trim() || it.label.trim()) ?? [];
  if (!items.length) return null;

  return (
    <section
      className={cn("relative overflow-hidden rounded-2xl border px-6 py-12 md:px-10", className)}
      style={{
        borderColor: t.stats_border,
        background: `linear-gradient(to bottom, ${t.stats_gradient_from}, ${t.stats_gradient_to})`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background: `radial-gradient(ellipse at center, ${t.stats_glow}, transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative space-y-8">
        {(s?.title?.trim() || s?.subtitle?.trim()) && (
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            {s?.title?.trim() ? (
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: t.heading_on_dark }}>
                {s.title}
              </h2>
            ) : null}
            {s?.subtitle?.trim() ? (
              <p className="text-sm whitespace-pre-line" style={{ color: t.muted_on_dark }}>
                {s.subtitle}
              </p>
            ) : null}
          </div>
        )}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {items.map((it, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-extrabold tabular-nums md:text-4xl" style={{ color: t.heading_on_dark }}>
                {it.value}
              </p>
              <p className="mt-1 text-sm" style={{ color: t.muted_on_dark }}>
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
  const faq = extras.faq;
  const items = faq?.items?.filter((it) => it.q.trim()) ?? [];
  if (!items.length) return null;

  const title = faq?.title?.trim() || "Perguntas frequentes";

  return (
    <section className={cn("space-y-6", className)}>
      <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl" style={{ color: t.heading_on_dark }}>
        {title}
      </h2>
      <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto space-y-2">
        {items.map((it, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="rounded-lg px-4 bg-black/20 data-[state=open]:opacity-[0.98]"
            style={{
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: t.faq_border,
            }}
          >
            <AccordionTrigger
              className="text-left hover:no-underline py-4 text-sm md:text-base font-medium"
              style={{ color: t.heading_on_dark }}
            >
              {it.q}
            </AccordionTrigger>
            <AccordionContent
              className="text-sm pb-4 whitespace-pre-line border-t pt-3"
              style={{ color: t.muted_on_dark, borderColor: `${t.accent}33` }}
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
  const lf = extras.legal_footer;
  const lines = lf?.lines ?? [];
  const links = lf?.links ?? [];
  if (!lines.length && !links.length) return null;

  return (
    <footer
      className={cn("mt-10 pt-8 border-t space-y-4 text-center", className)}
      style={{ borderColor: t.nav_border }}
    >
      {lines.length > 0 && (
        <div className="space-y-2 text-xs max-w-3xl mx-auto" style={{ color: t.muted_on_dark }}>
          {lines.map((line, i) => (
            <p key={i} className="whitespace-pre-line">
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
              className="underline-offset-4 hover:underline"
              style={{ color: t.link }}
            >
              {lnk.label}
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
