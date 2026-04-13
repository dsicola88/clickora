import { getApiBaseUrl } from "@/lib/apiOrigin";
import { DEFAULT_PLAN_DISPLAY_LABELS } from "@/lib/planDisplayLabels";
import { DEFAULT_PLANS_HERO_VISUAL } from "@/lib/plansLandingHeroVisual";
import { DEFAULT_LANDING_EXTRAS } from "@/lib/plansLandingExtras";
import type { PlansLandingPublic } from "@/types/api";

const FALLBACK: PlansLandingPublic = {
  badge_text: null,
  hero_title: "Escolha seu plano",
  hero_subtitle:
    "Cada cartão mostra os limites de presells e de cliques por mês; abaixo, o que mais está incluído. Comece grátis e faça upgrade quando precisar.",
  has_hero_image: false,
  intro_text: null,
  footer_text: null,
  hero_font: "sans",
  hero_text_align: "left",
  hero_title_size: "3xl",
  hero_title_weight: "bold",
  hero_subtitle_size: "base",
  intro_font: "sans",
  intro_text_align: "left",
  intro_text_size: "base",
  footer_font: "sans",
  footer_text_align: "center",
  footer_text_size: "sm",
  updated_at: "",
  plan_display_labels: DEFAULT_PLAN_DISPLAY_LABELS,
  hero_visual: { ...DEFAULT_PLANS_HERO_VISUAL } as unknown as Record<string, unknown>,
  landing_extras: { ...DEFAULT_LANDING_EXTRAS } as unknown as Record<string, unknown>,
};

export const plansLandingService = {
  async getPublic(): Promise<PlansLandingPublic> {
    try {
      const r = await fetch(`${getApiBaseUrl()}/public/plans-landing`);
      if (!r.ok) return { ...FALLBACK, updated_at: new Date().toISOString() };
      return r.json();
    } catch {
      return { ...FALLBACK, updated_at: new Date().toISOString() };
    }
  },

  heroImageHref(updatedAt?: string): string {
    const q = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
    return `${getApiBaseUrl()}/public/plans-landing/hero-image${q}`;
  },
};
