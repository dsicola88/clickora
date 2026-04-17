/** Espelha `backend/src/lib/plansLandingExtras.ts` — tipos da landing extra (tema escuro, FAQ, etc.). */

import type { LandingSectionId } from "./landingSectionLayout";
import type { LandingPageThemeInput } from "@/lib/landingPageTheme";
import type { LandingTextStylesPublic } from "@/lib/plansLandingTextStyles";
import { coerceLandingTextStyles } from "@/lib/plansLandingTextStyles";

export type LandingExtrasAppearance = "default" | "sales_dark";

export interface LandingExtrasCard {
  title: string;
  body: string;
}

export interface LandingExtrasStat {
  value: string;
  label: string;
}

export interface LandingExtrasFaqItem {
  q: string;
  a: string;
}

export interface LandingExtrasLink {
  label: string;
  href: string;
}

export type LandingRichTextTypography = {
  font_family?: "sans" | "serif" | "mono";
  font_size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
  font_weight?: "normal" | "medium" | "semibold" | "bold";
  text_align?: "left" | "center" | "right";
  /** Cor CSS (hex, rgba). Vazio = tema da página. */
  text_color?: string | null;
  /** Fundo da secção; vazio = transparente. */
  background_color?: string | null;
};

export type LandingContentBlock =
  | {
      type: "video";
      title: string | null;
      subtitle: string | null;
      url: string;
      layout?: "contained" | "wide";
    }
  | {
      type: "image";
      title: string | null;
      subtitle: string | null;
      src: string;
      alt?: string;
      caption?: string | null;
      layout?: "contained" | "wide";
    }
  | ({
      type: "rich_text";
      content: string;
      layout?: "contained" | "wide";
    } & LandingRichTextTypography);

export interface LandingTestimonialItem {
  thumbnail_url: string;
  video_url: string;
  name: string | null;
  role: string | null;
  social_handle: string | null;
}

/** Secção testemunhos (grelha vertical + modal de vídeo). */
export interface LandingTestimonials {
  enabled?: boolean;
  title: string | null;
  subtitle: string | null;
  items?: LandingTestimonialItem[];
}

export interface LandingGalleryItem {
  image_url: string;
  name: string | null;
  role: string | null;
  social_handle: string | null;
  caption: string | null;
}

/** Opções do carrossel (estilo «Image Carousel» / Elementor). */
export interface LandingGalleryCarouselOptions {
  autoplay?: boolean;
  interval_ms?: number;
  show_arrows?: boolean;
  show_dots?: boolean;
  slides_desktop?: number;
  slides_mobile?: number;
  loop?: boolean;
  gap_px?: number;
}

export interface LandingGallery {
  enabled?: boolean;
  /** `grid` (grelha habitual) ou `carousel`. */
  display?: "grid" | "carousel" | null;
  carousel?: LandingGalleryCarouselOptions | null;
  title: string | null;
  subtitle: string | null;
  items?: LandingGalleryItem[];
}

export type LandingSectionsEnabled = Partial<Record<LandingSectionId, boolean>>;

export interface LandingExtrasPublic {
  appearance: LandingExtrasAppearance;
  plans_section_label: string | null;
  plans_section_title: string | null;
  plans_section_subtitle: string | null;
  features: {
    title: string | null;
    subtitle: string | null;
    cards?: LandingExtrasCard[];
  } | null;
  stats: {
    title: string | null;
    subtitle: string | null;
    items?: LandingExtrasStat[];
  } | null;
  faq: {
    title: string | null;
    items?: LandingExtrasFaqItem[];
  } | null;
  legal_footer: {
    lines?: string[];
    links?: LandingExtrasLink[];
  } | null;
  content_blocks: LandingContentBlock[] | null;
  testimonials: LandingTestimonials | null;
  gallery: LandingGallery | null;
  section_order: LandingSectionId[] | null;
  sections_enabled: LandingSectionsEnabled | null;
  /** Cores / tipografia secções (tema escuro); ver editor Planos → Cores da landing. */
  theme: LandingPageThemeInput | null;
  /** Tipografia por zona (cor, fonte, tamanho, peso, alinhamento). */
  text_styles: LandingTextStylesPublic | null;
}

/** Alinhado ao backend `DEFAULT_LANDING_EXTRAS` — fallback se a resposta da API estiver incompleta. */
export const DEFAULT_LANDING_EXTRAS: LandingExtrasPublic = {
  appearance: "sales_dark",
  plans_section_label: "PLANOS",
  plans_section_title: "Escolha como quer escalar",
  plans_section_subtitle:
    "Os limites de presells e cliques estão nos cartões. Pode começar no plano grátis e fazer upgrade quando precisar. Planos pagos abrem num checkout externo (por exemplo Hotmart) apenas se o administrador tiver configurado o link.",
  features: {
    title: "Presells, métricas e domínio no mesmo sítio",
    subtitle:
      "Crie páginas presell no editor, acompanhe eventos no painel e use domínio próprio nos planos em que isso está incluído — sem prometer resultados que dependem da sua oferta e tráfego.",
    cards: [
      {
        title: "Formatos de presell reais no editor",
        body:
          "Tipos como VSL, TSL, DTC, VSL+TSL, e gates (cookies, desconto, idade, país, captcha, entre outros). Vídeo em incorporação (ex.: YouTube) onde o layout o permitir — não é um construtor genérico de «dezenas de páginas», é o que a plataforma expõe hoje.",
      },
      {
        title: "Tracking e proteção configuráveis",
        body:
          "Scripts e eventos no servidor (cliques, impressões, conversões), ligação a GCLID e conversões quando configurar integrações, e regras anti-abuso e listas IP que pode ativar na conta.",
      },
      {
        title: "Domínio e branding conforme o plano",
        body:
          "Nos planos com domínio personalizado, verifique o hostname e publique na sua URL. Nos planos pagos indicados, o rodapé pode ficar sem a marca Clickora; no grátis o branding pode ser visível.",
      },
    ],
  },
  stats: {
    title: "Feito para medir e iterar",
    subtitle:
      "Use os números do painel para ver o que a conta está a registar; disponibilidade do serviço depende da infraestrutura em produção.",
    items: [
      { value: "1", label: "Conta: presells e métricas no mesmo painel" },
      { value: "Eventos", label: "Cliques, impressões e conversões nas quotas do plano" },
      { value: "Checkout", label: "Pagamento via link externo se o admin o configurar" },
      { value: "Domínio", label: "Hostname próprio nos planos que o incluem" },
    ],
  },
  faq: {
    title: "Perguntas frequentes",
    items: [
      {
        q: "O plano grátis inclui o quê?",
        a:
          "Pode criar presells e usar o tracking até aos limites do plano (número de presells e de cliques por mês) indicados no cartão. Funcionalidades extra dependem da configuração da sua instalação.",
      },
      {
        q: "Como pago um plano pago?",
        a:
          "Escolha o plano e use o botão de compra. Se existir um link de checkout configurado, será redirecionado. Se não acontecer nada ou aparecer um aviso, o link ainda não foi definido — contacte o suporte ou administrador da plataforma.",
      },
      {
        q: "Posso usar o meu domínio nas presells?",
        a:
          "Sim, nos planos que incluem domínio personalizado: adicione o domínio no painel, siga a verificação DNS indicada e publique. O número de domínios permitido depende do plano.",
      },
      {
        q: "Onde obtenho suporte?",
        a:
          "Use os contactos ou canais que a sua instalação da plataforma disponibilizar. Podem ser adicionados a esta secção no editor da landing.",
      },
    ],
  },
  legal_footer: {
    lines: ["dclickora — presells, rastreamento e ferramentas para afiliados."],
    links: [
      { label: "Criar conta", href: "/auth" },
      { label: "Entrar", href: "/auth" },
    ],
  },
  content_blocks: null,
  testimonials: null,
  gallery: null,
  section_order: ["features", "stats", "planos", "faq"],
  sections_enabled: null,
  theme: null,
  text_styles: null,
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function coerceLandingExtras(raw: unknown): LandingExtrasPublic {
  if (!isPlainObject(raw)) return { ...DEFAULT_LANDING_EXTRAS };
  const appearance =
    raw.appearance === "sales_dark" ? "sales_dark" : "default";
  const plans_section_label =
    typeof raw.plans_section_label === "string" ? raw.plans_section_label : null;
  const plans_section_title =
    typeof raw.plans_section_title === "string" ? raw.plans_section_title : null;
  const plans_section_subtitle =
    typeof raw.plans_section_subtitle === "string" ? raw.plans_section_subtitle : null;

  let features: LandingExtrasPublic["features"] = null;
  if (raw.features !== null && raw.features !== undefined && isPlainObject(raw.features)) {
    const f = raw.features;
    const cardsRaw = f.cards;
    const cards = Array.isArray(cardsRaw)
      ? cardsRaw
          .map((c) => {
            if (!isPlainObject(c)) return null;
            const title = typeof c.title === "string" ? c.title : "";
            const body = typeof c.body === "string" ? c.body : "";
            return { title, body };
          })
          .filter((c) => c && (c.title.trim() || c.body.trim()))
      : [];
    features = {
      title: typeof f.title === "string" ? f.title : null,
      subtitle: typeof f.subtitle === "string" ? f.subtitle : null,
      cards: cards.length ? (cards as LandingExtrasCard[]) : undefined,
    };
    if (!features.title?.trim() && !features.subtitle?.trim() && !features.cards?.length) {
      features = null;
    }
  }

  let stats: LandingExtrasPublic["stats"] = null;
  if (raw.stats !== null && raw.stats !== undefined && isPlainObject(raw.stats)) {
    const s = raw.stats;
    const itemsRaw = s.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw
          .map((it) => {
            if (!isPlainObject(it)) return null;
            const value = typeof it.value === "string" ? it.value : "";
            const label = typeof it.label === "string" ? it.label : "";
            return { value, label };
          })
          .filter((it) => it && (it.value.trim() || it.label.trim()))
      : [];
    stats = {
      title: typeof s.title === "string" ? s.title : null,
      subtitle: typeof s.subtitle === "string" ? s.subtitle : null,
      items: items.length ? (items as LandingExtrasStat[]) : undefined,
    };
    if (!stats.title?.trim() && !stats.subtitle?.trim() && !stats.items?.length) {
      stats = null;
    }
  }

  let faq: LandingExtrasPublic["faq"] = null;
  if (raw.faq !== null && raw.faq !== undefined && isPlainObject(raw.faq)) {
    const q = raw.faq;
    const itemsRaw = q.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw
          .map((it) => {
            if (!isPlainObject(it)) return null;
            const qq = typeof it.q === "string" ? it.q : "";
            const aa = typeof it.a === "string" ? it.a : "";
            return { q: qq, a: aa };
          })
          .filter((it) => it && (it.q.trim() || it.a.trim()))
      : [];
    faq = {
      title: typeof q.title === "string" ? q.title : null,
      items: items.length ? (items as LandingExtrasFaqItem[]) : undefined,
    };
    if (!faq.title?.trim() && !faq.items?.length) {
      faq = null;
    }
  }

  let legal_footer: LandingExtrasPublic["legal_footer"] = null;
  if (
    raw.legal_footer !== null &&
    raw.legal_footer !== undefined &&
    isPlainObject(raw.legal_footer)
  ) {
    const lf = raw.legal_footer;
    const linesRaw = lf.lines;
    const lines = Array.isArray(linesRaw)
      ? linesRaw.map((l) => (typeof l === "string" ? l : "")).filter((l) => l.trim())
      : [];
    const linksRaw = lf.links;
    const links = Array.isArray(linksRaw)
      ? linksRaw
          .map((lnk) => {
            if (!isPlainObject(lnk)) return null;
            const label = typeof lnk.label === "string" ? lnk.label : "";
            const href = typeof lnk.href === "string" ? lnk.href : "";
            return { label, href };
          })
          .filter((lnk) => lnk && lnk.label.trim() && lnk.href.trim())
      : [];
    legal_footer = {
      lines: lines.length ? lines : undefined,
      links: links.length ? (links as LandingExtrasLink[]) : undefined,
    };
    if (!legal_footer.lines?.length && !legal_footer.links?.length) {
      legal_footer = null;
    }
  }

  let content_blocks: LandingExtrasPublic["content_blocks"] = null;
  const rawBlocks = raw.content_blocks;
  if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
    const parsed: LandingContentBlock[] = [];
    for (const item of rawBlocks) {
      if (!isPlainObject(item)) continue;
      const layout =
        item.layout === "wide" || item.layout === "contained" ? item.layout : undefined;
      if (item.type === "rich_text") {
        const content = typeof item.content === "string" ? item.content : "";
        if (!content.trim()) continue;
        const ff = item.font_family;
        const font_family =
          ff === "serif" || ff === "mono" || ff === "sans" ? ff : "sans";
        const fsz = item.font_size;
        const font_size =
          fsz === "xs" ||
          fsz === "sm" ||
          fsz === "base" ||
          fsz === "lg" ||
          fsz === "xl" ||
          fsz === "2xl"
            ? fsz
            : "base";
        const fw = item.font_weight;
        const font_weight =
          fw === "medium" ||
          fw === "semibold" ||
          fw === "bold" ||
          fw === "normal"
            ? fw
            : "normal";
        const ta = item.text_align;
        const text_align =
          ta === "center" || ta === "right" || ta === "left" ? ta : "left";
        const text_color =
          typeof item.text_color === "string" && item.text_color.trim()
            ? item.text_color.trim()
            : null;
        const background_color =
          typeof item.background_color === "string" && item.background_color.trim()
            ? item.background_color.trim()
            : null;
        parsed.push({
          type: "rich_text",
          content,
          font_family,
          font_size,
          font_weight,
          text_align,
          text_color,
          background_color,
          layout,
        });
        continue;
      }
      const t = item.type === "image" ? "image" : "video";
      const title = typeof item.title === "string" ? item.title : null;
      const subtitle = typeof item.subtitle === "string" ? item.subtitle : null;
      if (t === "video") {
        const url = typeof item.url === "string" ? item.url.trim() : "";
        if (!url) continue;
        parsed.push({
          type: "video",
          title,
          subtitle,
          url,
          layout,
        });
      } else {
        const src = typeof item.src === "string" ? item.src.trim() : "";
        if (!src) continue;
        const alt = typeof item.alt === "string" ? item.alt : undefined;
        const caption = typeof item.caption === "string" ? item.caption : null;
        parsed.push({
          type: "image",
          title,
          subtitle,
          src,
          alt,
          caption,
          layout,
        });
      }
    }
    content_blocks = parsed.length ? parsed : null;
  }

  let testimonials: LandingExtrasPublic["testimonials"] = null;
  if (raw.testimonials !== null && raw.testimonials !== undefined && isPlainObject(raw.testimonials)) {
    const t = raw.testimonials;
    const itemsRaw = t.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw
          .map((it) => {
            if (!isPlainObject(it)) return null;
            const thumbnail_url =
              typeof it.thumbnail_url === "string" ? it.thumbnail_url.trim() : "";
            const video_url = typeof it.video_url === "string" ? it.video_url.trim() : "";
            if (!thumbnail_url || !video_url) return null;
            return {
              thumbnail_url,
              video_url,
              name: typeof it.name === "string" ? it.name : null,
              role: typeof it.role === "string" ? it.role : null,
              social_handle: typeof it.social_handle === "string" ? it.social_handle : null,
            } as LandingTestimonialItem;
          })
          .filter((it): it is LandingTestimonialItem => it !== null)
      : [];
    const title = typeof t.title === "string" ? t.title : null;
    const subtitle = typeof t.subtitle === "string" ? t.subtitle : null;
    const enabled = typeof t.enabled === "boolean" ? t.enabled : undefined;
    if (items.length) {
      testimonials = {
        ...(enabled !== undefined ? { enabled } : {}),
        title,
        subtitle,
        items,
      };
    }
  }

  let gallery: LandingExtrasPublic["gallery"] = null;
  if (raw.gallery !== null && raw.gallery !== undefined && isPlainObject(raw.gallery)) {
    const g = raw.gallery;
    const itemsRaw = g.items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw
          .map((it) => {
            if (!isPlainObject(it)) return null;
            const image_url =
              typeof it.image_url === "string" ? it.image_url.trim() : "";
            if (!image_url) return null;
            return {
              image_url,
              name: typeof it.name === "string" ? it.name : null,
              role: typeof it.role === "string" ? it.role : null,
              social_handle: typeof it.social_handle === "string" ? it.social_handle : null,
              caption: typeof it.caption === "string" ? it.caption : null,
            } as LandingGalleryItem;
          })
          .filter((it): it is LandingGalleryItem => it !== null)
      : [];
    const title = typeof g.title === "string" ? g.title : null;
    const subtitle = typeof g.subtitle === "string" ? g.subtitle : null;
    const enabled = typeof g.enabled === "boolean" ? g.enabled : undefined;
    const display =
      g.display === "carousel" ? "carousel" : g.display === "grid" ? "grid" : null;

    let carousel: LandingGalleryCarouselOptions | null = null;
    if (isPlainObject(g.carousel)) {
      const c = g.carousel as Record<string, unknown>;
      const num = (k: string) =>
        typeof c[k] === "number" && Number.isFinite(c[k]) ? (c[k] as number) : undefined;
      const bool = (k: string) => (typeof c[k] === "boolean" ? c[k] : undefined);
      carousel = {
        autoplay: bool("autoplay"),
        interval_ms: num("interval_ms"),
        show_arrows: bool("show_arrows"),
        show_dots: bool("show_dots"),
        slides_desktop: num("slides_desktop"),
        slides_mobile: num("slides_mobile"),
        loop: bool("loop"),
        gap_px: num("gap_px"),
      };
      const emptyCarousel = !Object.values(carousel).some((v) => v !== undefined);
      if (emptyCarousel) carousel = null;
      else {
        const pruned = Object.fromEntries(
          Object.entries(carousel).filter(([, v]) => v !== undefined),
        ) as LandingGalleryCarouselOptions;
        carousel = Object.keys(pruned).length ? pruned : null;
      }
    }

    if (items.length) {
      gallery = {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(display ? { display } : {}),
        ...(carousel ? { carousel } : {}),
        title,
        subtitle,
        items,
      };
    }
  }

  let section_order: LandingExtrasPublic["section_order"] = null;
  if (Array.isArray(raw.section_order) && raw.section_order.length > 0) {
    const valid = new Set<string>([
      "content_blocks",
      "features",
      "stats",
      "testimonials",
      "gallery",
      "planos",
      "faq",
    ]);
    const filtered = raw.section_order.filter(
      (x): x is LandingSectionId => typeof x === "string" && valid.has(x),
    );
    section_order = filtered.length ? filtered : null;
  }

  let sections_enabled: LandingExtrasPublic["sections_enabled"] = null;
  if (
    raw.sections_enabled !== null &&
    raw.sections_enabled !== undefined &&
    isPlainObject(raw.sections_enabled)
  ) {
    const se = raw.sections_enabled;
    const pick = (k: LandingSectionId) =>
      typeof se[k] === "boolean" ? se[k] : undefined;
    sections_enabled = {
      content_blocks: pick("content_blocks"),
      features: pick("features"),
      stats: pick("stats"),
      testimonials: pick("testimonials"),
      gallery: pick("gallery"),
      planos: pick("planos"),
      faq: pick("faq"),
    };
    const hasAny = Object.values(sections_enabled).some((v) => v !== undefined);
    if (!hasAny) sections_enabled = null;
  }

  let theme: LandingPageThemeInput | null = null;
  if (raw.theme !== null && raw.theme !== undefined && isPlainObject(raw.theme)) {
    const tm = raw.theme as Record<string, unknown>;
    const g = (k: string): string | undefined => {
      const v = tm[k];
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t || undefined;
    };
    const partial: LandingPageThemeInput = {
      page_background: g("page_background"),
      nav_background: g("nav_background"),
      accent: g("accent"),
      accent_hover: g("accent_hover"),
      heading_on_dark: g("heading_on_dark"),
      muted_on_dark: g("muted_on_dark"),
      badge_border: g("badge_border"),
      badge_background: g("badge_background"),
      badge_text: g("badge_text"),
      stats_gradient_from: g("stats_gradient_from"),
      stats_gradient_to: g("stats_gradient_to"),
      stats_border: g("stats_border"),
      faq_border: g("faq_border"),
      link: g("link"),
      card_surface: g("card_surface"),
      selection_bg: g("selection_bg"),
      nav_border: g("nav_border"),
      outline_nav_border: g("outline_nav_border"),
      outline_nav_bg: g("outline_nav_bg"),
      stats_glow: g("stats_glow"),
      accent_button_shadow: g("accent_button_shadow"),
      accent_button_radius: g("accent_button_radius"),
      plan_card_radius: g("plan_card_radius"),
      section_font:
        tm.section_font === "sans" || tm.section_font === "serif" || tm.section_font === "mono"
          ? tm.section_font
          : undefined,
    };
    const entries = Object.entries(partial).filter(([, v]) => v !== undefined);
    if (entries.length) theme = Object.fromEntries(entries) as LandingPageThemeInput;
  }

  const textStylesParsed = coerceLandingTextStyles(raw.text_styles);
  const text_styles = Object.keys(textStylesParsed).length ? textStylesParsed : null;

  return {
    appearance,
    plans_section_label,
    plans_section_title,
    plans_section_subtitle,
    features,
    stats,
    faq,
    legal_footer,
    content_blocks,
    testimonials,
    gallery,
    section_order,
    sections_enabled,
    theme,
    text_styles,
  };
}
