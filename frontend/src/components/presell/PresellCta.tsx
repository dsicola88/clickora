import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const baseLayout =
  "group relative inline-flex w-full max-w-[min(100%,22rem)] sm:max-w-xl md:max-w-2xl min-h-[3.25rem] sm:min-h-14 items-center justify-center gap-2.5 sm:gap-3 rounded-2xl px-5 sm:px-10 md:px-12 py-3.5 sm:py-4 text-center text-[0.95rem] sm:text-lg md:text-xl font-extrabold leading-snug tracking-tight shadow-2xl transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 active:scale-[0.985] touch-manipulation text-balance";

const surfaceLight =
  "gradient-primary text-primary-foreground shadow-[0_10px_40px_-10px_hsl(172_66%_38%_/_0.55),0_0_0_1px_hsl(0_0%_100%_/_0.12)_inset] ring-2 ring-primary/20 hover:brightness-[1.08] hover:shadow-[0_14px_44px_-8px_hsl(28_92%_48%_/_0.45)] hover:-translate-y-0.5 focus-visible:ring-primary/50 focus-visible:ring-offset-background";

const surfaceDark =
  "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white shadow-[0_12px_44px_-10px_rgba(251,146,60,0.55),0_0_0_1px_rgba(255,255,255,0.2)_inset] ring-2 ring-white/30 hover:brightness-[1.06] hover:shadow-[0_16px_48px_-8px_rgba(249,115,22,0.55)] hover:-translate-y-0.5 focus-visible:ring-amber-300/80 focus-visible:ring-offset-slate-950";

/** CTA sólido tipo página de produto (laranja). */
const surfaceCommerce =
  "bg-orange-500 text-white shadow-[0_12px_40px_-10px_rgba(249,115,22,0.55),0_0_0_1px_rgba(255,255,255,0.18)_inset] ring-2 ring-orange-400/35 hover:bg-orange-500 hover:brightness-[1.05] hover:shadow-[0_16px_44px_-8px_rgba(234,88,12,0.5)] hover:-translate-y-0.5 focus-visible:ring-orange-300/90 focus-visible:ring-offset-background";

const disabledCls =
  "cursor-not-allowed opacity-[0.58] shadow-none ring-0 grayscale hover:translate-y-0 hover:brightness-100";

type Props = {
  href: string;
  disabled?: boolean;
  children: ReactNode;
  /** `dark` = hero VSL (fundo escuro); `light` = resto da página */
  surface?: "light" | "dark";
  /** Ocupa a largura do contentor (ex.: modal estreito) */
  stretch?: boolean;
  className?: string;
};

export function PresellCta({ href, disabled, children, surface = "light", stretch, className }: Props) {
  if (disabled) {
    return (
      <span
        className={cn(
          "flex w-full px-2 sm:px-4",
          stretch ? "justify-stretch px-0" : "justify-center",
          className,
        )}
      >
        <Button
          type="button"
          size="lg"
          disabled
          className={cn(
            baseLayout,
            stretch ? "max-w-none w-full" : "max-w-[min(100%,22rem)] sm:max-w-xl",
            disabledCls,
            "bg-muted/90 text-muted-foreground border border-border/60",
          )}
        >
          {children}
        </Button>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full px-2 sm:px-4",
        stretch ? "justify-stretch px-0" : "justify-center",
        className,
      )}
    >
      <a
        href={href}
        className={cn(
          baseLayout,
          stretch && "!max-w-none w-full",
          surface === "dark" ? surfaceDark : surface === "commerce" ? surfaceCommerce : surfaceLight,
        )}
      >
        <span className="flex-1 min-w-0">{children}</span>
        <ArrowRight
          className="h-5 w-5 shrink-0 opacity-95 transition-transform duration-200 group-hover:translate-x-1 sm:h-6 sm:w-6"
          aria-hidden
        />
      </a>
    </div>
  );
}
