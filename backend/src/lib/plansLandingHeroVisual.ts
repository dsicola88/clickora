import { z } from "zod";

export const heroVisualPatchSchema = z.object({
  image_effect: z.enum(["none", "ken-burns", "hover-zoom", "parallax"]).optional(),
  image_object_position: z.enum(["center", "top", "bottom"]).optional(),
  overlay_style: z
    .enum(["gradient-dark", "gradient-light", "solid-dark", "solid-light", "none"])
    .optional(),
  overlay_intensity: z.enum(["subtle", "medium", "strong"]).optional(),
  content_entrance: z.enum(["none", "fade-in", "fade-up"]).optional(),
  cta_enabled: z.boolean().optional(),
  cta_label: z.string().max(80).nullable().optional(),
  cta_href: z.string().max(500).nullable().optional(),
});

export type HeroVisualPatch = z.infer<typeof heroVisualPatchSchema>;

export const DEFAULT_HERO_VISUAL = {
  image_effect: "none" as const,
  image_object_position: "center" as const,
  overlay_style: "gradient-dark" as const,
  overlay_intensity: "medium" as const,
  content_entrance: "fade-up" as const,
  cta_enabled: true as const,
  cta_label: "Ver planos" as string | null,
  cta_href: "#planos" as string | null,
};

export type HeroVisualMerged = typeof DEFAULT_HERO_VISUAL;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function mergeHeroVisual(existing: unknown, patch: HeroVisualPatch): HeroVisualMerged {
  const base: HeroVisualMerged = { ...DEFAULT_HERO_VISUAL };
  const cur = isRecord(existing) ? { ...base, ...existing } : base;
  const merged = { ...cur, ...patch };
  const focal = merged.image_object_position;
  const out = {
    image_effect: merged.image_effect ?? DEFAULT_HERO_VISUAL.image_effect,
    image_object_position:
      focal === "top" || focal === "bottom" || focal === "center"
        ? focal
        : DEFAULT_HERO_VISUAL.image_object_position,
    overlay_style: merged.overlay_style ?? DEFAULT_HERO_VISUAL.overlay_style,
    overlay_intensity: merged.overlay_intensity ?? DEFAULT_HERO_VISUAL.overlay_intensity,
    content_entrance: merged.content_entrance ?? DEFAULT_HERO_VISUAL.content_entrance,
    cta_enabled: Boolean(merged.cta_enabled),
    cta_label: merged.cta_label === undefined ? DEFAULT_HERO_VISUAL.cta_label : merged.cta_label,
    cta_href: merged.cta_href === undefined ? DEFAULT_HERO_VISUAL.cta_href : merged.cta_href,
  };
  return out as HeroVisualMerged;
}

export function heroVisualPublic(existing: unknown): HeroVisualMerged {
  return mergeHeroVisual(existing, {});
}
