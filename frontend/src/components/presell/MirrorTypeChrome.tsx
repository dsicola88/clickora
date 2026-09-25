import { cn } from "@/lib/utils";

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
  className?: string;
};

function typeLabel(type: string): string | null {
  switch (type) {
    case "tsl":
      return "TSL · carta de vendas";
    case "dtc":
      return "DTC · directo ao consumidor";
    case "review":
      return "Review · análise";
    case "vsl":
      return "VSL · vídeo";
    case "vsl_tsl":
      return "VSL + TSL";
    default:
      return null;
  }
}

/**
 * Chrome fino por tipo quando o espelho HTML está activo.
 * Diferencia TSL/DTC/review/VSL sem substituir o clone 1:1.
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
  className,
}: Props) {
  const label = typeLabel(type);
  if (!label) return null;

  const isVsl = type === "vsl" || type === "vsl_tsl";
  const showVideo = isVsl && typeof videoUrl === "string" && videoUrl.trim().length > 8;

  return (
    <div
      className={cn(
        "sticky top-0 z-[34] w-full border-b border-border/70 bg-background/95 backdrop-blur-md",
        isVsl && "border-white/10 bg-slate-950/95 text-slate-100",
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex flex-col gap-0.5">
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              isVsl ? "text-amber-300/90" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          {productLabel ? (
            <span className={cn("truncate text-sm font-medium", isVsl ? "text-white" : "text-foreground")}>
              {productLabel}
            </span>
          ) : null}
          {type === "review" && ratingValue ? (
            <span className="text-xs text-muted-foreground">
              {"★".repeat(Math.min(5, Math.max(1, ratingStars)))} {ratingValue}
            </span>
          ) : null}
        </div>
        {href && ctaText ? (
          <a
            href={ctaEnabled ? href : undefined}
            aria-disabled={!ctaEnabled}
            className={cn(
              "shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm",
              isVsl
                ? "border-amber-400/80 text-amber-200 hover:bg-amber-400/10"
                : "border-primary/40 text-primary hover:bg-primary/10",
              !ctaEnabled && "pointer-events-none opacity-50",
            )}
          >
            {ctaText}
          </a>
        ) : null}
      </div>
      {showVideo ? (
        <div className="mx-auto max-w-3xl px-3 pb-3 sm:px-4">
          <div className="aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-black">
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
