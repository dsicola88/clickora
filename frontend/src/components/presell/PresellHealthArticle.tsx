import { PresellCta } from "@/components/presell/PresellCta";
import type { HealthArticle } from "@/lib/presellHealthArticle";
import { cn } from "@/lib/utils";

type Props = {
  article: HealthArticle;
  href: string;
  ctaEnabled: boolean;
  /** Em tipo cookies o hoplink fica só no aviso — o artigo não leva botão de oferta. */
  showCta?: boolean;
  className?: string;
};

/**
 * Miolo editorial estilo portal de saúde — texto corrido, sem bridge de preço/CTA spam.
 */
export function PresellHealthArticle({ article, href, ctaEnabled, showCta = true, className }: Props) {
  return (
    <article
      id="presell-story"
      className={cn(
        "mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 text-slate-800 scroll-mt-16",
        className,
      )}
    >
      <header className="mb-8 sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
          {article.kicker}
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl md:text-[2.15rem] font-semibold leading-snug tracking-tight text-slate-950">
          {article.headline}
        </h2>
      </header>

      <p className="text-base sm:text-lg leading-[1.75] text-slate-700 mb-10">{article.intro}</p>

      <section className="mb-10 sm:mb-12" aria-labelledby="health-pillars-title">
        <h3
          id="health-pillars-title"
          className="text-xl sm:text-2xl font-semibold text-slate-950 mb-5 border-b border-slate-200 pb-3"
        >
          {article.pillarsTitle}
        </h3>
        <div className="space-y-6">
          {article.pillars.map((p) => (
            <div key={p.title}>
              <h4 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">{p.title}</h4>
              <p className="text-[15px] sm:text-base leading-relaxed text-slate-700">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-6 sm:px-7 sm:py-8 mb-8">
        <p className={cn("text-[15px] sm:text-base leading-relaxed text-slate-700", showCta && "mb-6")}>
          {article.productNote}
        </p>
        {showCta ? (
        <div className="flex justify-center sm:justify-start">
          <PresellCta href={href} disabled={!ctaEnabled} surface="commerce">
            {article.ctaLabel}
          </PresellCta>
        </div>
        ) : null}
      </section>
    </article>
  );
}
