import { cn } from "@/lib/utils";
import { getPresellTypeTheme } from "@/lib/presellTypeTheme";

type Props = {
  type: string;
  ctaText: string;
  href: string;
  ctaEnabled?: boolean;
  ratingValue?: string;
  ratingStars?: number;
  productLabel?: string;
  /** Vídeo VSL — barra compacta (não cobre o espelho). */
  videoUrl?: string | null;
  language?: string;
  className?: string;
};

/**
 * Chrome profissional por tipo quando o espelho HTML está activo.
 * Diferencia TSL/DTC/review/VSL sem fingir ser o site da marca.
 */
export function MirrorTypeChrome({
  type,
  ctaText,
  href,
  ctaEnabled = true,
  ratingValue,
  ratingStars = 5,
  productLabel,
  videoUrl,
  language,
  className,
}: Props) {
  const theme = getPresellTypeTheme(type);
  if (!["tsl", "dtc", "review", "vsl", "vsl_tsl"].includes(type)) return null;

  const isVsl = type === "vsl" || type === "vsl_tsl";
  const showVideo = isVsl && typeof videoUrl === "string" && videoUrl.trim().length > 8;
  const independentLabel = (language || "").toLowerCase().startsWith("pt")
    ? "Página independente"
    : "Independent page";

  return (
    <div className={cn("sticky top-0 z-[34] w-full border-b backdrop-blur-md", theme.chromeClass, className)}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                theme.badgeClass,
              )}
            >
              {theme.badge}
            </span>
            <span className={cn("text-[10px] font-medium tracking-wide", theme.chromeLabelClass)}>
              {independentLabel}
            </span>
          </div>
          {productLabel ? (
            <span className={cn("truncate text-sm font-semibold tracking-tight", isVsl ? "text-white" : "text-foreground")}>
              {productLabel}
            </span>
          ) : null}
          <p className={cn("hidden sm:block text-[11px] leading-snug max-w-md", theme.chromeLabelClass)}>
            {theme.eyebrow}
          </p>
          {type === "review" && ratingValue ? (
            <span className={cn("text-xs", theme.chromeLabelClass)}>
              {"★".repeat(Math.min(5, Math.max(1, ratingStars)))} {ratingValue}
            </span>
          ) : null}
        </div>
        {href && ctaText ? (
          <a
            href={ctaEnabled ? href : undefined}
            aria-disabled={!ctaEnabled}
            className={cn(
              "shrink-0 rounded-lg border px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm",
              theme.chromeCtaClass,
              !ctaEnabled && "pointer-events-none opacity-50",
            )}
          >
            {ctaText}
          </a>
        ) : null}
      </div>
      {showVideo ? (
        <div className="mx-auto max-w-3xl px-3 pb-3 sm:px-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black shadow-lg">
            <iframe
              title="VSL"
              src={videoUrl!}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
