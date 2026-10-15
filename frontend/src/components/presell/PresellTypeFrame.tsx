import { cn } from "@/lib/utils";
import { getPresellTypeEditorial, getPresellTypeTheme } from "@/lib/presellTypeTheme";

type Props = {
  type: string;
  language?: string;
  /** Compacto no topo do hero. */
  variant?: "hero" | "aside";
  className?: string;
};

/**
 * Selo + eyebrow + (opcional) bloco editorial — dá identidade por tipo
 * e reforça transparência sem inventar factos do produto.
 */
export function PresellTypeFrame({ type, language, variant = "hero", className }: Props) {
  const theme = getPresellTypeTheme(type);
  const editorial = variant === "aside" ? getPresellTypeEditorial(type, language || "en") : null;

  if (variant === "aside") {
    if (!editorial) return null;
    return (
      <aside
        className={cn(
          "rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 text-left shadow-sm",
          type === "vsl" || type === "vsl_tsl"
            ? "border-white/10 bg-white/5 text-slate-100"
            : "border-border/50 bg-card/40 text-foreground",
          className,
        )}
        aria-label={editorial.title}
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-2">{editorial.title}</p>
        <ul className="space-y-1.5 text-sm leading-relaxed opacity-90">
          {editorial.points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      <div className="flex flex-col items-center gap-2.5 text-center px-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] shadow-sm",
            theme.badgeClass,
          )}
        >
          {theme.badge}
        </span>
        <p
          className={cn(
            "text-sm sm:text-base font-medium leading-snug max-w-xl",
            type === "vsl" || type === "vsl_tsl" ? "text-slate-200/95" : "text-muted-foreground",
          )}
        >
          {theme.eyebrow}
        </p>
      </div>
    </div>
  );
}
