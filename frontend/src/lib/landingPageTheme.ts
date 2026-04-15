import { cn } from "@/lib/utils";

/** Campos opcionais guardados em `landing_extras.theme` (cores `#hex` ou `rgba(...)`, tipografia das secções). */
export interface LandingPageThemeInput {
  page_background?: string | null;
  nav_background?: string | null;
  accent?: string | null;
  accent_hover?: string | null;
  heading_on_dark?: string | null;
  muted_on_dark?: string | null;
  badge_border?: string | null;
  badge_background?: string | null;
  badge_text?: string | null;
  stats_gradient_from?: string | null;
  stats_gradient_to?: string | null;
  stats_border?: string | null;
  faq_border?: string | null;
  link?: string | null;
  card_surface?: string | null;
  selection_bg?: string | null;
  nav_border?: string | null;
  outline_nav_border?: string | null;
  outline_nav_bg?: string | null;
  stats_glow?: string | null;
  section_font?: "sans" | "serif" | "mono" | null;
}

const DEFAULTS: Required<
  Omit<LandingPageThemeInput, "section_font"> & { section_font: "sans" | "serif" | "mono" }
> = {
  page_background: "#050a18",
  nav_background: "rgba(5, 10, 24, 0.88)",
  accent: "#059669",
  accent_hover: "#047857",
  heading_on_dark: "#ffffff",
  muted_on_dark: "rgba(255, 255, 255, 0.78)",
  badge_border: "rgba(16, 185, 129, 0.45)",
  badge_background: "rgba(16, 185, 129, 0.12)",
  badge_text: "#d1fae5",
  stats_gradient_from: "rgba(6, 78, 59, 0.38)",
  stats_gradient_to: "#050a18",
  stats_border: "rgba(16, 185, 129, 0.25)",
  faq_border: "rgba(16, 185, 129, 0.3)",
  link: "#34d399",
  card_surface: "#ffffff",
  selection_bg: "rgba(16, 185, 129, 0.2)",
  nav_border: "rgba(255, 255, 255, 0.1)",
  outline_nav_border: "rgba(255, 255, 255, 0.25)",
  outline_nav_bg: "rgba(255, 255, 255, 0.05)",
  stats_glow: "rgba(16, 185, 129, 0.22)",
  section_font: "sans",
};

export type ResolvedLandingPageTheme = {
  [K in keyof typeof DEFAULTS]: (typeof DEFAULTS)[K];
} & { sectionFontClass: string };

function pick(s: string | null | undefined, fallback: string): string {
  const v = s?.trim();
  return v ? v : fallback;
}

/** Funde tema da API com valores padrão. */
export function resolveLandingPageTheme(raw: LandingPageThemeInput | null | undefined): ResolvedLandingPageTheme {
  const r = raw ?? {};
  const section_font =
    r.section_font === "serif" || r.section_font === "mono" ? r.section_font : DEFAULTS.section_font;
  const sectionFontClass = cn(
    section_font === "serif" ? "font-serif" : section_font === "mono" ? "font-mono" : "font-sans",
  );
  return {
    page_background: pick(r.page_background, DEFAULTS.page_background),
    nav_background: pick(r.nav_background, DEFAULTS.nav_background),
    accent: pick(r.accent, DEFAULTS.accent),
    accent_hover: pick(r.accent_hover, DEFAULTS.accent_hover),
    heading_on_dark: pick(r.heading_on_dark, DEFAULTS.heading_on_dark),
    muted_on_dark: pick(r.muted_on_dark, DEFAULTS.muted_on_dark),
    badge_border: pick(r.badge_border, DEFAULTS.badge_border),
    badge_background: pick(r.badge_background, DEFAULTS.badge_background),
    badge_text: pick(r.badge_text, DEFAULTS.badge_text),
    stats_gradient_from: pick(r.stats_gradient_from, DEFAULTS.stats_gradient_from),
    stats_gradient_to: pick(r.stats_gradient_to, DEFAULTS.stats_gradient_to),
    stats_border: pick(r.stats_border, DEFAULTS.stats_border),
    faq_border: pick(r.faq_border, DEFAULTS.faq_border),
    link: pick(r.link, DEFAULTS.link),
    card_surface: pick(r.card_surface, DEFAULTS.card_surface),
    selection_bg: pick(r.selection_bg, DEFAULTS.selection_bg),
    nav_border: pick(r.nav_border, DEFAULTS.nav_border),
    outline_nav_border: pick(r.outline_nav_border, DEFAULTS.outline_nav_border),
    outline_nav_bg: pick(r.outline_nav_bg, DEFAULTS.outline_nav_bg),
    stats_glow: pick(r.stats_glow, DEFAULTS.stats_glow),
    section_font,
    sectionFontClass,
  };
}
