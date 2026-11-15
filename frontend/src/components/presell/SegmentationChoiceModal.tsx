import { useEffect } from "react";
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

/**
 * Modal de segmentação (choice gate): dois CTAs com destinos distintos.
 * Visual profissional — cartão centrado, backdrop suave, tipografia clara.
 */
export function SegmentationChoiceModal({
  copy,
  reviewHref,
  officialHref,
  dismissed,
  onDismiss,
}: Props) {
  useEffect(() => {
    if (dismissed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dismissed]);

  if (dismissed) return null;

  const reviewOk = Boolean(reviewHref.trim() && reviewHref !== "#");
  const officialOk = Boolean(officialHref.trim() && officialHref !== "#");

  return (
    <div
      className="fixed inset-0 z-[520] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="presell-seg-title"
      data-testid="presell-segmentation-sheet"
    >
      <div
        data-testid="presell-segmentation-backdrop"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        data-testid="presell-segmentation-card"
        className="relative z-10 w-full max-w-[380px] rounded-xl border border-slate-200/90 bg-[#f4f5f7] px-7 pb-7 pt-5 text-slate-900 shadow-[0_22px_50px_-14px_rgba(15,23,42,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {copy.allowClose ? (
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              data-testid="presell-segmentation-close"
              onClick={onDismiss}
              className="text-[13px] font-medium text-sky-600 hover:text-sky-700 hover:underline underline-offset-2"
            >
              {copy.closeLabel}
            </button>
          </div>
        ) : (
          <div className="h-2" />
        )}

        <h2
          id="presell-seg-title"
          className="text-center text-[17px] font-semibold tracking-tight text-slate-900 leading-snug px-1"
        >
          {copy.title}
        </h2>

        <div className="mt-6 flex flex-col gap-3">
          {reviewOk ? (
            <a
              href={reviewHref}
              data-testid="presell-segmentation-review"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#22a45a] px-4 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#1e914f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              {copy.reviewLabel}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-slate-300 px-4 text-[15px] font-semibold text-slate-500"
            >
              {copy.reviewLabel}
            </button>
          )}
          {officialOk ? (
            <a
              href={officialHref}
              data-testid="presell-segmentation-official"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#2f6fed] px-4 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#255fd0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {copy.officialLabel}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-slate-300 px-4 text-[15px] font-semibold text-slate-500"
            >
              {copy.officialLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
