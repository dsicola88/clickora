import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { PlansFontFamily, PlansFontWeight, PlansHeroTitleSize, PlansTextAlign } from "@/lib/plansLandingTypography";
import {
  coerceBodySize,
  coerceFontFamily,
  coerceFontWeight,
  coerceHeroTitleSize,
  coerceTextAlign,
  plansLandingFooterClasses,
  plansLandingHeroInnerClasses,
  plansLandingHeroSubtitleMarkdownClasses,
  plansLandingHeroTitleClasses,
  plansLandingIntroClasses,
} from "@/lib/plansLandingTypography";

/** Bloco de tipografia opcional por zona de texto. */
export type LandingTextStyleBlock = {
  font_family?: PlansFontFamily | "display";
  font_size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  font_weight?: PlansFontWeight;
  text_align?: PlansTextAlign;
  /** Cor CSS (#hex, rgba…). */
  color?: string | null;
};

export const LANDING_TEXT_STYLE_KEYS = [
  "hero_title",
  "hero_subtitle",
  "hero_badge",
  "intro",
  "footer",
  "plans_section_label",
  "plans_section_title",
  "plans_section_subtitle",
  "features_title",
  "features_subtitle",
  "feature_card_title",
  "feature_card_body",
  "stats_title",
  "stats_subtitle",
  "stat_value",
  "stat_label",
  "faq_title",
  "faq_question",
  "faq_answer",
  "legal_footer",
  "testimonials_title",
  "testimonials_subtitle",
  "gallery_title",
  "gallery_subtitle",
  "guarantee_title",
  "guarantee_lead",
  "guarantee_body",
  "guarantee_footer",
] as const;

export type LandingTextStyleKey = (typeof LANDING_TEXT_STYLE_KEYS)[number];

export type LandingTextStylesPublic = Partial<Record<LandingTextStyleKey, LandingTextStyleBlock>>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function coerceLandingTextStyles(raw: unknown): LandingTextStylesPublic {
  if (!isPlainObject(raw)) return {};
  const out: LandingTextStylesPublic = {};
  for (const key of LANDING_TEXT_STYLE_KEYS) {
    const v = raw[key];
    if (!isPlainObject(v)) continue;
    const b = coerceTextStyleBlock(v);
    if (b && Object.keys(b).length > 0) out[key] = b;
  }
  return out;
}

function coerceTextStyleBlock(o: Record<string, unknown>): LandingTextStyleBlock | undefined {
  const block: LandingTextStyleBlock = {};
  const ff = o.font_family;
  if (ff === "sans" || ff === "serif" || ff === "mono" || ff === "display") block.font_family = ff;
  const fs = o.font_size;
  if (
    fs === "xs" ||
    fs === "sm" ||
    fs === "base" ||
    fs === "lg" ||
    fs === "xl" ||
    fs === "2xl" ||
    fs === "3xl" ||
    fs === "4xl" ||
    fs === "5xl"
  ) {
    block.font_size = fs;
  }
  const fw = o.font_weight;
  if (fw === "normal" || fw === "medium" || fw === "semibold" || fw === "bold" || fw === "extrabold") {
    block.font_weight = fw;
  }
  const ta = o.text_align;
  if (ta === "left" || ta === "center" || ta === "right") block.text_align = ta;
  const c = o.color;
  if (typeof c === "string" && c.trim()) block.color = c.trim();
  else if (c === null) block.color = null;
  return Object.keys(block).length ? block : undefined;
}

const FONT: Record<PlansFontFamily | "display", string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
  display: "font-display tracking-tight",
};

const WEIGHT: Record<PlansFontWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
};

const ALIGN: Record<PlansTextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Títulos (h1–h2, etiquetas de secção). */
const TITLE_SIZE: Record<string, string> = {
  xs: "text-lg md:text-xl",
  sm: "text-xl md:text-2xl",
  base: "text-2xl md:text-3xl",
  lg: "text-2xl md:text-3xl",
  xl: "text-3xl md:text-4xl",
  "2xl": "text-3xl md:text-4xl",
  "3xl": "text-4xl md:text-5xl",
  "4xl": "text-5xl md:text-6xl",
  "5xl": "text-5xl md:text-7xl",
};

/** Corpo / subtítulos. */
const BODY_SIZE: Record<string, string> = {
  xs: "text-xs md:text-sm",
  sm: "text-sm md:text-base",
  base: "text-base md:text-lg",
  lg: "text-lg md:text-xl",
  xl: "text-xl md:text-2xl",
  "2xl": "text-2xl md:text-3xl",
  "3xl": "text-3xl md:text-4xl",
  "4xl": "text-4xl md:text-5xl",
  "5xl": "text-5xl md:text-6xl",
};

/** Valores pequenos (etiqueta PLANOS, stat label). */
const LABEL_SIZE: Record<string, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  base: "text-xs",
  lg: "text-sm",
  xl: "text-sm",
  "2xl": "text-base",
  "3xl": "text-lg",
  "4xl": "text-xl",
  "5xl": "text-2xl",
};

function fontClass(f?: PlansFontFamily | "display"): string | undefined {
  if (!f) return undefined;
  return FONT[f] ?? FONT.sans;
}

function weightClass(w?: PlansFontWeight): string | undefined {
  if (!w) return undefined;
  return WEIGHT[w] ?? undefined;
}

function alignClass(a?: PlansTextAlign): string | undefined {
  if (!a) return undefined;
  return ALIGN[a] ?? undefined;
}

/** Classes Tailwind para um bloco de estilo (título). */
export function landingTextStyleTitleClasses(s: LandingTextStyleBlock | undefined): string {
  if (!s) return "";
  const sz = s.font_size ? TITLE_SIZE[s.font_size] ?? "" : "";
  return cn(fontClass(s.font_family), weightClass(s.font_weight), alignClass(s.text_align), sz);
}

export function landingTextStyleBodyClasses(s: LandingTextStyleBlock | undefined): string {
  if (!s) return "";
  const sz = s.font_size ? BODY_SIZE[s.font_size] ?? "" : "";
  return cn(fontClass(s.font_family), weightClass(s.font_weight), alignClass(s.text_align), sz);
}

export function landingTextStyleLabelClasses(s: LandingTextStyleBlock | undefined): string {
  if (!s) return "";
  const sz = s.font_size ? LABEL_SIZE[s.font_size] ?? "" : "";
  return cn(fontClass(s.font_family), weightClass(s.font_weight), alignClass(s.text_align), sz);
}

export function landingTextStyleStatValueClasses(s: LandingTextStyleBlock | undefined): string {
  if (!s) return "";
  const sz = s.font_size ? TITLE_SIZE[s.font_size] ?? "text-3xl md:text-4xl" : "text-3xl md:text-4xl";
  return cn("tabular-nums", fontClass(s.font_family), weightClass(s.font_weight), alignClass(s.text_align), sz);
}

export function landingTextStyleColorStyle(s: LandingTextStyleBlock | undefined): CSSProperties | undefined {
  const c = s?.color?.trim();
  if (!c) return undefined;
  return { color: c };
}

/** Mapeia token genérico para `PlansHeroTitleSize` (colunas do hero). */
export function fontSizeTokenToHeroTitleSize(
  token: string | undefined,
): PlansHeroTitleSize | undefined {
  if (!token) return undefined;
  const map: Record<string, PlansHeroTitleSize> = {
    xs: "sm",
    sm: "md",
    base: "lg",
    lg: "xl",
    xl: "2xl",
    "2xl": "2xl",
    "3xl": "3xl",
    "4xl": "4xl",
    "5xl": "5xl",
  };
  return map[token];
}

/** Hero h1: funde colunas da BD com `text_styles.hero_title`. */
export function resolvedHeroTitleClassNameFixed(
  landing: { hero_title_size?: string | null; hero_title_weight?: string | null },
  override: LandingTextStyleBlock | undefined,
): string {
  const hasSizeOverride = Boolean(override?.font_size);
  const size = hasSizeOverride
    ? coerceHeroTitleSize(fontSizeTokenToHeroTitleSize(override!.font_size!) ?? landing.hero_title_size)
    : coerceHeroTitleSize(landing.hero_title_size);
  const weight = override?.font_weight ?? coerceFontWeight(landing.hero_title_weight);
  const base = hasSizeOverride
    ? cn(
        "text-balance tracking-tight text-foreground",
        WEIGHT[weight] ?? WEIGHT.bold,
        TITLE_SIZE[override!.font_size!],
      )
    : plansLandingHeroTitleClasses({ size, weight });
  return cn(
    base,
    override?.font_family && fontClass(override.font_family),
    override?.text_align && alignClass(override.text_align),
  );
}

export function resolvedHeroInnerClasses(
  landing: { hero_font?: string | null; hero_text_align?: string | null },
  titleOverride: LandingTextStyleBlock | undefined,
): string {
  const align = titleOverride?.text_align ?? coerceTextAlign(landing.hero_text_align);
  const font = titleOverride?.font_family
    ? coerceFontFamily(titleOverride.font_family === "display" ? "serif" : titleOverride.font_family)
    : coerceFontFamily(landing.hero_font);
  return plansLandingHeroInnerClasses({ font, align });
}

export function resolvedHeroSubtitleMarkdownClasses(
  landing: { hero_subtitle_size?: string | null },
  override: LandingTextStyleBlock | undefined,
): string {
  const hasSize = Boolean(override?.font_size);
  const baseSize = coerceBodySize(landing.hero_subtitle_size);
  const base = plansLandingHeroSubtitleMarkdownClasses(baseSize);
  if (!hasSize) {
    return cn(base, landingTextStyleBodyClasses(override));
  }
  return cn(
    "max-w-3xl text-pretty leading-relaxed",
    BODY_SIZE[override!.font_size!],
    fontClass(override?.font_family),
    weightClass(override?.font_weight),
    alignClass(override?.text_align),
  );
}

export function resolvedIntroClasses(
  landing: { intro_font?: string | null; intro_text_align?: string | null; intro_text_size?: string | null },
  override: LandingTextStyleBlock | undefined,
  opts: { omitColor?: boolean },
): string {
  const font = override?.font_family
    ? coerceFontFamily(override.font_family === "display" ? "serif" : override.font_family)
    : coerceFontFamily(landing.intro_font);
  const align = override?.text_align ?? coerceTextAlign(landing.intro_text_align);
  const size = override?.font_size ? coerceBodySize(mapTokenToBodySize(override.font_size)) : coerceBodySize(landing.intro_text_size);
  return plansLandingIntroClasses({ font, align, size }, opts);
}

function mapTokenToBodySize(
  t: string,
): "xs" | "sm" | "base" | "lg" | "xl" {
  const map: Record<string, "xs" | "sm" | "base" | "lg" | "xl"> = {
    xs: "xs",
    sm: "sm",
    base: "base",
    lg: "lg",
    xl: "xl",
    "2xl": "xl",
    "3xl": "xl",
    "4xl": "xl",
    "5xl": "xl",
  };
  return map[t] ?? "base";
}

export function resolvedFooterClasses(
  landing: { footer_font?: string | null; footer_text_align?: string | null; footer_text_size?: string | null },
  override: LandingTextStyleBlock | undefined,
  opts: { omitColor?: boolean },
): string {
  const font = override?.font_family
    ? coerceFontFamily(override.font_family === "display" ? "serif" : override.font_family)
    : coerceFontFamily(landing.footer_font);
  const align = override?.text_align ?? coerceTextAlign(landing.footer_text_align);
  const size = override?.font_size ? coerceBodySize(mapTokenToBodySize(override.font_size)) : coerceBodySize(landing.footer_text_size);
  return plansLandingFooterClasses({ font, align, size }, opts);
}
