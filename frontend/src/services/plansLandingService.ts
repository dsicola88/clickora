import { getApiBaseUrl } from "@/lib/apiOrigin";
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
