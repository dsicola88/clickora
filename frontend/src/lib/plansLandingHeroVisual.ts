import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type PlansHeroImageEffect = "none" | "ken-burns" | "hover-zoom" | "parallax";
export type PlansHeroOverlayStyle = "gradient-dark" | "gradient-light" | "solid-dark" | "solid-light" | "none";
export type PlansHeroOverlayIntensity = "subtle" | "medium" | "strong";
export type PlansHeroContentEntrance = "none" | "fade-in" | "fade-up";

export type PlansHeroImageObjectPosition = "center" | "top" | "bottom";

export interface PlansHeroVisual {
  image_effect: PlansHeroImageEffect;
  overlay_style: PlansHeroOverlayStyle;
  overlay_intensity: PlansHeroOverlayIntensity;
  content_entrance: PlansHeroContentEntrance;
  /** Recorte vertical da fotografia no hero (equivalente a «foco» / object-position). */
  image_object_position: PlansHeroImageObjectPosition;
  /** Altura mínima do hero em px (mobile). */
  min_height_mobile_px: number;
  /** Altura mínima do hero em px (md e acima). */
  min_height_desktop_px: number;
  cta_enabled: boolean;
  cta_label: string | null;
  cta_href: string | null;
}

export const DEFAULT_PLANS_HERO_VISUAL: PlansHeroVisual = {
  image_effect: "none",
  overlay_style: "gradient-dark",
  overlay_intensity: "medium",
  content_entrance: "fade-up",
  image_object_position: "center",
  min_height_mobile_px: 220,
  min_height_desktop_px: 280,
  cta_enabled: true,
  cta_label: "Ver planos",
  cta_href: "#planos",
};

function clampInt(n: unknown, fallback: number, min: number, max: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function coercePlansHeroVisual(v: unknown): PlansHeroVisual {
  if (typeof v !== "object" || v === null) return { ...DEFAULT_PLANS_HERO_VISUAL };
  const o = v as Record<string, unknown>;
  const effect = o.image_effect;
  const overlay = o.overlay_style;
  const intensity = o.overlay_intensity;
  const entrance = o.content_entrance;
  const focal = o.image_object_position;
  return {
    image_effect:
      effect === "ken-burns" || effect === "hover-zoom" || effect === "parallax" || effect === "none"
        ? effect
        : DEFAULT_PLANS_HERO_VISUAL.image_effect,
    image_object_position:
      focal === "top" || focal === "bottom" || focal === "center"
        ? focal
        : DEFAULT_PLANS_HERO_VISUAL.image_object_position,
    min_height_mobile_px: clampInt(o.min_height_mobile_px, DEFAULT_PLANS_HERO_VISUAL.min_height_mobile_px, 160, 900),
    min_height_desktop_px: clampInt(
      o.min_height_desktop_px,
      DEFAULT_PLANS_HERO_VISUAL.min_height_desktop_px,
      200,
      1200,
    ),
    overlay_style:
      overlay === "gradient-dark" ||
      overlay === "gradient-light" ||
      overlay === "solid-dark" ||
      overlay === "solid-light" ||
      overlay === "none"
        ? overlay
        : DEFAULT_PLANS_HERO_VISUAL.overlay_style,
    overlay_intensity:
      intensity === "subtle" || intensity === "medium" || intensity === "strong"
        ? intensity
        : DEFAULT_PLANS_HERO_VISUAL.overlay_intensity,
    content_entrance:
      entrance === "fade-in" || entrance === "fade-up" || entrance === "none"
        ? entrance
        : DEFAULT_PLANS_HERO_VISUAL.content_entrance,
    cta_enabled: Boolean(o.cta_enabled),
    cta_label: typeof o.cta_label === "string" ? o.cta_label : o.cta_label === null ? null : DEFAULT_PLANS_HERO_VISUAL.cta_label,
    cta_href: typeof o.cta_href === "string" ? o.cta_href : o.cta_href === null ? null : DEFAULT_PLANS_HERO_VISUAL.cta_href,
  };
}

/** Classes para o div de overlay sobre a imagem. */
export function plansHeroOverlayClass(v: PlansHeroVisual): string {
  const { overlay_style, overlay_intensity } = v;
  if (overlay_style === "none") return "";

  const gradDark = {
    subtle: "from-background/80 via-background/45 to-background/15",
    medium: "from-background/95 via-background/55 to-background/25",
    strong: "from-background via-background/75 to-background/40",
  }[overlay_intensity];

  const gradLight = {
    subtle: "from-white/55 via-white/20 to-transparent dark:from-background/85 dark:via-background/45 dark:to-transparent",
    medium: "from-white/75 via-white/35 to-transparent dark:from-background/92 dark:via-background/55 dark:to-background/15",
    strong: "from-white/90 via-white/50 to-white/10 dark:from-background dark:via-background/70 dark:to-background/30",
  }[overlay_intensity];

  if (overlay_style === "gradient-dark") {
    return cn("bg-gradient-to-t", gradDark);
  }
  if (overlay_style === "gradient-light") {
    return cn("bg-gradient-to-t", gradLight);
  }
  if (overlay_style === "solid-dark") {
    const op = overlay_intensity === "subtle" ? "bg-black/35" : overlay_intensity === "strong" ? "bg-black/70" : "bg-black/50";
    return op;
  }
  if (overlay_style === "solid-light") {
    const op = overlay_intensity === "subtle" ? "bg-white/25" : overlay_intensity === "strong" ? "bg-white/55" : "bg-white/40";
    return op;
  }
  return "";
}

export function plansHeroImagePositionStyle(v: PlansHeroVisual): {
  objectPosition: string;
  backgroundPosition: string;
} {
  const map: Record<PlansHeroImageObjectPosition, string> = {
    top: "center top",
    center: "center center",
    bottom: "center bottom",
  };
  const pos = map[v.image_object_position] ?? map.center;
  return { objectPosition: pos, backgroundPosition: pos };
}

export function plansHeroImageEffectClass(v: PlansHeroVisual): string {
  switch (v.image_effect) {
    case "ken-burns":
      return "animate-plans-ken-burns motion-reduce:animate-none origin-center";
    case "hover-zoom":
      return "transition-transform duration-1000 ease-out group-hover/plans-hero:scale-110 motion-reduce:transition-none motion-reduce:group-hover/plans-hero:scale-100";
    case "parallax":
    case "none":
    default:
      return "";
  }
}

/** Variáveis CSS para `min-height` responsivo do hero (definidas no `<section>`). */
export function plansHeroMinHeightStyle(v: PlansHeroVisual): CSSProperties {
  return {
    ["--plans-hero-min-sm"]: `${v.min_height_mobile_px}px`,
    ["--plans-hero-min-md"]: `${v.min_height_desktop_px}px`,
  };
}

export function plansHeroContentEntranceClass(v: PlansHeroVisual): string {
  switch (v.content_entrance) {
    case "fade-in":
      return "animate-in fade-in duration-700 motion-reduce:animate-none";
    case "fade-up":
      return "animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none";
    case "none":
    default:
      return "";
  }
}
