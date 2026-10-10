import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { PresellCta } from "@/components/presell/PresellCta";
import { getPresellUiStrings } from "@/lib/presellUiStrings";

export function discountUrgencyCopy(language: string): string {
  return getPresellUiStrings(language).discountUrgency;
}

export function discountSocialFallback(language: string): string {
  return getPresellUiStrings(language).discountSocial;
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

type Props = {
  language: string;
  headline: string;
  socialProof: string;
  ratingValue: string;
  ratingStars: number;
  initialTimerSeconds: number;
  ctaText: string;
  href: string;
  children: ReactNode;
};

export function DiscountPresellOverlay({
  language,
  headline,
  socialProof,
  ratingValue,
  ratingStars,
  initialTimerSeconds,
  ctaText,
  href,
  children,
}: Props) {
  const [open] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Number.isFinite(initialTimerSeconds) && initialTimerSeconds > 0 ? Math.floor(initialTimerSeconds) : 0,
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const stars = Math.min(5, Math.max(1, Math.round(ratingStars || 5)));

  const goOffer = () => {
    const url = href.trim();
    if (!url || url === "#") return;
    window.location.assign(url);
  };

  return (
    <div className="relative">
      {secondsLeft > 0 ? (
        <button
          type="button"
          className="fixed top-0 left-0 right-0 z-[530] bg-[#e91e8c] text-white text-center px-3 py-2.5 shadow-md"
          onClick={goOffer}
        >
          <div className="text-2xl font-bold tabular-nums tracking-tight">{formatMmSs(secondsLeft)}</div>
          <p className="text-xs sm:text-sm font-medium opacity-95 leading-snug max-w-lg mx-auto">
            {discountUrgencyCopy(language)}
          </p>
        </button>
      ) : null}

      <div className={secondsLeft > 0 ? "pt-[5.25rem]" : undefined}>{children}</div>

      {open ? (
        <div
          className="fixed inset-0 z-[520] flex items-end justify-center p-3 sm:p-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discount-modal-title"
          data-testid="presell-discount-sheet"
        >
          <button
            type="button"
            data-testid="presell-discount-backdrop"
            className="absolute inset-0 cursor-pointer border-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent p-0"
            aria-label="Continuar para a oferta"
            onClick={goOffer}
          />
          <div
            className="relative z-10 w-full max-w-md cursor-pointer rounded-2xl bg-[#eceff1] shadow-2xl border border-white/40 px-6 py-8 sm:px-8"
            onClick={goOffer}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1.5 text-foreground/50 hover:text-foreground hover:bg-black/5 transition-colors"
              aria-label="Fechar"
              onClick={goOffer}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="space-y-5 text-center">
              <h2 id="discount-modal-title" className="text-2xl sm:text-[1.65rem] font-extrabold text-foreground tracking-tight">
                {headline}
              </h2>
              {socialProof.trim() ? (
                <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">{socialProof}</p>
              ) : null}
              {ratingValue.trim() && stars > 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <span className="text-3xl font-bold text-foreground tabular-nums">{ratingValue}</span>
                  <div className="flex gap-0.5" aria-hidden>
                    {Array.from({ length: stars }).map((_, i) => (
                      <span key={i} className="text-[#ffc107] text-2xl leading-none">
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="pt-1">
                <PresellCta href={href || "#"} disabled={!href} surface="light" stretch>
                  {ctaText}
                </PresellCta>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
