import { cn } from "@/lib/utils";

/** Valores guardados na API (alinham com o backend). */
export type PlansFontFamily = "sans" | "serif" | "mono";
export type PlansTextAlign = "left" | "center" | "right";
export type PlansHeroTitleSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
export type PlansFontWeight = "normal" | "medium" | "semibold" | "bold" | "extrabold";
export type PlansBodySize = "xs" | "sm" | "base" | "lg" | "xl";

const FONT: Record<PlansFontFamily, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};

const ALIGN: Record<PlansTextAlign, string> = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

const TITLE_SIZE: Record<PlansHeroTitleSize, string> = {
  sm: "text-xl md:text-2xl",
  md: "text-2xl md:text-3xl",
  lg: "text-3xl md:text-4xl",
  xl: "text-3xl md:text-5xl",
  "2xl": "text-4xl md:text-5xl",
  "3xl": "text-4xl md:text-6xl",
  "4xl": "text-5xl md:text-6xl",
  "5xl": "text-5xl md:text-7xl",
};

const TITLE_WEIGHT: Record<PlansFontWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
};

const SUBTITLE_SIZE: Record<PlansBodySize, string> = {
  xs: "text-xs md:text-sm",
  sm: "text-sm md:text-base",
  base: "text-base md:text-lg",
  lg: "text-lg md:text-xl",
  xl: "text-xl md:text-2xl",
};

const BODY_SIZE: Record<PlansBodySize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function plansLandingHeroInnerClasses(opts: {
  font: PlansFontFamily;
  align: PlansTextAlign;
}): string {
  return cn("flex flex-col gap-3", FONT[opts.font] ?? FONT.sans, ALIGN[opts.align] ?? ALIGN.left);
}

export function plansLandingHeroTitleClasses(opts: {
  size: PlansHeroTitleSize;
  weight: PlansFontWeight;
}): string {
  return cn(
    "text-balance tracking-tight text-foreground",
    TITLE_SIZE[opts.size] ?? TITLE_SIZE["3xl"],
    TITLE_WEIGHT[opts.weight] ?? TITLE_WEIGHT.bold,
  );
}

export function plansLandingHeroSubtitleClasses(size: PlansBodySize): string {
  return cn("max-w-3xl text-pretty leading-relaxed text-muted-foreground", SUBTITLE_SIZE[size] ?? SUBTITLE_SIZE.base);
}

/** Tamanho e largura do subtítulo do hero com Markdown (cor via `LandingMarkdown` no tema escuro). */
export function plansLandingHeroSubtitleMarkdownClasses(size: PlansBodySize): string {
  return cn("max-w-3xl text-pretty leading-relaxed", SUBTITLE_SIZE[size] ?? SUBTITLE_SIZE.base);
}

export function plansLandingIntroClasses(
  opts: {
    font: PlansFontFamily;
    align: PlansTextAlign;
    size: PlansBodySize;
  },
  block?: { omitColor?: boolean },
): string {
  const alignOnly = opts.align === "center" ? "text-center" : opts.align === "right" ? "text-right" : "text-left";
  return cn(
    "leading-relaxed",
    !block?.omitColor && "text-muted-foreground",
    FONT[opts.font] ?? FONT.sans,
    alignOnly,
    BODY_SIZE[opts.size] ?? BODY_SIZE.base,
  );
}

export function plansLandingFooterClasses(
  opts: {
    font: PlansFontFamily;
    align: PlansTextAlign;
    size: PlansBodySize;
  },
  block?: { omitColor?: boolean },
): string {
  const alignOnly = opts.align === "center" ? "text-center" : opts.align === "right" ? "text-right" : "text-left";
  return cn(
    "leading-relaxed",
    !block?.omitColor && "text-muted-foreground",
    FONT[opts.font] ?? FONT.sans,
    alignOnly,
    BODY_SIZE[opts.size] ?? BODY_SIZE.sm,
  );
}

/** Fallback se a API devolver valores antigos ou desconhecidos. */
export function coerceFontFamily(v: string | undefined | null): PlansFontFamily {
  if (v === "serif" || v === "mono" || v === "sans") return v;
  return "sans";
}

export function coerceTextAlign(v: string | undefined | null): PlansTextAlign {
  if (v === "center" || v === "right" || v === "left") return v;
  return "left";
}

export function coerceHeroTitleSize(v: string | undefined | null): PlansHeroTitleSize {
  const ok = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] as const;
  if (ok.includes(v as PlansHeroTitleSize)) return v as PlansHeroTitleSize;
  return "3xl";
}

export function coerceFontWeight(v: string | undefined | null): PlansFontWeight {
  const ok = ["normal", "medium", "semibold", "bold", "extrabold"] as const;
  if (ok.includes(v as PlansFontWeight)) return v as PlansFontWeight;
  return "bold";
}

export function coerceBodySize(v: string | undefined | null): PlansBodySize {
  const ok = ["xs", "sm", "base", "lg", "xl"] as const;
  if (ok.includes(v as PlansBodySize)) return v as PlansBodySize;
  return "base";
}
