import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { LandingExtrasPublic } from "@/lib/plansLandingExtras";
import { Check } from "lucide-react";

type Props = {
  extras: LandingExtrasPublic;
  className?: string;
};

export function SalesLandingFeatures({ extras, className }: Props) {
  const f = extras.features;
  const cards = f?.cards?.filter((c) => c.title.trim() || c.body.trim()) ?? [];
  if (!cards.length) return null;

  return (
    <section className={cn("space-y-6", className)}>
      {(f?.title?.trim() || f?.subtitle?.trim()) && (
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          {f?.title?.trim() ? (
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{f.title}</h2>
          ) : null}
          {f?.subtitle?.trim() ? (
            <p className="text-sm text-white/75 whitespace-pre-line">{f.subtitle}</p>
          ) : null}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl bg-white p-6 text-slate-900 shadow-lg transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-2xl",
            )}
          >
            <div className="mb-3 h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Check className="h-5 w-5 text-blue-600" aria-hidden />
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
  const s = extras.stats;
  const items = s?.items?.filter((it) => it.value.trim() || it.label.trim()) ?? [];
  if (!items.length) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-950/40 to-[#050a18] px-6 py-12 md:px-10",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.25),_transparent_70%)]"
        aria-hidden
      />
      <div className="relative space-y-8">
        {(s?.title?.trim() || s?.subtitle?.trim()) && (
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            {s?.title?.trim() ? (
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{s.title}</h2>
            ) : null}
            {s?.subtitle?.trim() ? (
              <p className="text-sm text-white/75 whitespace-pre-line">{s.subtitle}</p>
            ) : null}
          </div>
        )}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {items.map((it, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-extrabold tabular-nums text-white md:text-4xl">{it.value}</p>
              <p className="mt-1 text-sm text-white/60">{it.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SalesLandingFaq({ extras, className }: Props) {
  const faq = extras.faq;
  const items = faq?.items?.filter((it) => it.q.trim()) ?? [];
  if (!items.length) return null;

  const title = faq?.title?.trim() || "Perguntas frequentes";

  return (
    <section className={cn("space-y-6", className)}>
      <h2 className="text-center text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
      <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto space-y-2">
        {items.map((it, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="border border-blue-500/35 rounded-lg px-4 bg-black/20 data-[state=open]:border-blue-400/50"
          >
            <AccordionTrigger className="text-left text-white hover:no-underline py-4 text-sm md:text-base font-medium">
              {it.q}
            </AccordionTrigger>
            <AccordionContent className="text-white/80 text-sm pb-4 whitespace-pre-line border-t border-blue-500/25 pt-3">
              {it.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function SalesLandingLegalFooter({ extras, className }: Props) {
  const lf = extras.legal_footer;
  const lines = lf?.lines ?? [];
  const links = lf?.links ?? [];
  if (!lines.length && !links.length) return null;

  return (
    <footer className={cn("mt-10 pt-8 border-t border-white/10 space-y-4 text-center", className)}>
      {lines.length > 0 && (
        <div className="space-y-2 text-xs text-white/50 max-w-3xl mx-auto">
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
              className="text-blue-400 hover:text-blue-300 underline-offset-4 hover:underline"
            >
              {lnk.label}
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
