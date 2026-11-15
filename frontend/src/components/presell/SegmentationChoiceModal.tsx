import { useEffect, useId, useRef, type Ref } from "react";
import type { ResolvedSegmentationCopy } from "@/lib/presellSegmentation";

type Props = {
  copy: ResolvedSegmentationCopy;
  /** Track URL já bakeado para o braço Review. */
  reviewHref: string;
  /** Track URL já bakeado para o braço Official. */
  officialHref: string;
  dismissed: boolean;
  onDismiss: () => void;
};

function isUsableHref(href: string): boolean {
  const h = href.trim();
  return Boolean(h && h !== "#");
}

/**
 * Modal de segmentação (choice gate): dois CTAs com destinos distintos.
 * Visual alinhado a bridges profissionais (cartão centrado, CTAs empilhados, tipografia limpa).
 */
export function SegmentationChoiceModal({
  copy,
  reviewHref,
  officialHref,
  dismissed,
  onDismiss,
}: Props) {
  const titleId = useId();
  const firstCtaRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const setFirstCtaRef: Ref<HTMLAnchorElement | HTMLButtonElement> = (node) => {
    firstCtaRef.current = node;
  };
  const reviewOk = isUsableHref(reviewHref);
  const officialOk = isUsableHref(officialHref);

  useEffect(() => {
    if (dismissed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => firstCtaRef.current?.focus({ preventScroll: true }), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && copy.allowClose) {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [dismissed, copy.allowClose, onDismiss]);

  if (dismissed) return null;

  const btnBase =
    "inline-flex h-11 w-full items-center justify-center rounded-[6px] px-4 text-[15px] font-semibold tracking-[-0.01em] transition-[background-color,transform,box-shadow] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px";

  return (
    <div
      className="fixed inset-0 z-[520] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="presell-segmentation-sheet"
    >
      <div
        data-testid="presell-segmentation-backdrop"
        className="absolute inset-0 bg-slate-950/50"
        aria-hidden
      />

      <div
        data-testid="presell-segmentation-card"
        className="relative z-10 w-full max-w-[360px] animate-in fade-in zoom-in-95 duration-200 rounded-xl border border-slate-200/80 bg-[#f3f4f6] px-6 pb-6 pt-4 text-slate-900 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.5)]"
        style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {copy.allowClose ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              data-testid="presell-segmentation-close"
              onClick={onDismiss}
              className="rounded px-1 py-0.5 text-[13px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline underline-offset-2"
            >
              {copy.closeLabel}
            </button>
          </div>
        ) : (
          <div className="h-3" aria-hidden />
        )}

        <h2
          id={titleId}
          className="px-1 text-center text-[17px] font-bold leading-snug tracking-tight text-slate-900"
        >
          {copy.title}
        </h2>

        <div className="mt-5 flex flex-col gap-2.5">
          {reviewOk ? (
            <a
              ref={setFirstCtaRef as Ref<HTMLAnchorElement>}
              href={reviewHref.trim()}
              data-testid="presell-segmentation-review"
              className={`${btnBase} bg-[#22a45a] text-white shadow-sm hover:bg-[#1d8f4f] focus-visible:outline-emerald-600`}
            >
              {copy.reviewLabel}
            </a>
          ) : (
            <button
              ref={setFirstCtaRef as Ref<HTMLButtonElement>}
              type="button"
              disabled
              data-testid="presell-segmentation-review"
              className={`${btnBase} cursor-not-allowed bg-slate-300 text-slate-500`}
            >
              {copy.reviewLabel}
            </button>
          )}

          {officialOk ? (
            <a
              href={officialHref.trim()}
              data-testid="presell-segmentation-official"
              className={`${btnBase} bg-[#2f6fed] text-white shadow-sm hover:bg-[#2563d4] focus-visible:outline-blue-600`}
            >
              {copy.officialLabel}
            </a>
          ) : (
            <button
              type="button"
              disabled
              data-testid="presell-segmentation-official"
              className={`${btnBase} cursor-not-allowed bg-slate-300 text-slate-500`}
            >
              {copy.officialLabel}
            </button>
          )}
        </div>

        {!reviewOk && !officialOk ? (
          <p className="mt-4 text-center text-[12px] leading-relaxed text-slate-500">
            Configure o link da oferta nesta presell para activar os botões.
          </p>
        ) : null}
      </div>
    </div>
  );
}
