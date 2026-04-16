import { z } from "zod";

export const landingExtrasCardSchema = z.object({
  title: z.string().max(200),
  body: z.string().max(2000),
});

export const landingExtrasStatSchema = z.object({
  value: z.string().max(80),
  label: z.string().max(120),
});

export const landingExtrasFaqItemSchema = z.object({
  q: z.string().max(400),
  a: z.string().max(8000),
});

export const landingExtrasLinkSchema = z.object({
  label: z.string().max(120),
  href: z.string().max(2000),
});

const urlish = z
  .string()
  .max(2000)
  .refine((s) => {
    const t = s.trim();
    if (!t) return false;
    if (t.startsWith("/")) return true;
    try {
      const u = new URL(t);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL inválida");

const layoutEnum = z.enum(["contained", "wide"]).optional();

/** Valores CSS (#hex, rgba, hsl); validação fina no admin. */
const colorToken = z.string().max(80).optional().nullable();

export const landingExtrasVideoBlockSchema = z.object({
  type: z.literal("video"),
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(500).nullable().optional(),
  url: urlish,
  layout: layoutEnum,
});

export const landingExtrasImageBlockSchema = z.object({
  type: z.literal("image"),
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(500).nullable().optional(),
  src: urlish,
  alt: z.string().max(200).optional(),
  caption: z.string().max(500).nullable().optional(),
  layout: layoutEnum,
});

export const landingExtrasRichTextBlockSchema = z.object({
  type: z.literal("rich_text"),
  content: z.string().min(1).max(12000),
  font_family: z.enum(["sans", "serif", "mono"]).optional(),
  font_size: z.enum(["xs", "sm", "base", "lg", "xl", "2xl"]).optional(),
  font_weight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  text_align: z.enum(["left", "center", "right"]).optional(),
  text_color: colorToken,
  background_color: colorToken,
  layout: layoutEnum,
});

export const landingExtrasContentBlockSchema = z.discriminatedUnion("type", [
  landingExtrasVideoBlockSchema,
  landingExtrasImageBlockSchema,
  landingExtrasRichTextBlockSchema,
]);

export const landingExtrasTestimonialItemSchema = z.object({
  thumbnail_url: urlish,
  video_url: urlish,
  name: z.string().max(120).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  social_handle: z.string().max(80).nullable().optional(),
});

export const landingExtrasGalleryItemSchema = z.object({
  image_url: urlish,
  name: z.string().max(120).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  social_handle: z.string().max(80).nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
});

/** Opções tipo «Image Carousel» (Elementor): autoplay, setas, dots, slides visíveis. */
export const landingExtrasGalleryCarouselSchema = z
  .object({
    autoplay: z.boolean().optional(),
    interval_ms: z.number().int().min(2000).max(120000).optional(),
    show_arrows: z.boolean().optional(),
    show_dots: z.boolean().optional(),
    slides_desktop: z.number().int().min(1).max(4).optional(),
    slides_mobile: z.number().int().min(1).max(2).optional(),
    loop: z.boolean().optional(),
    gap_px: z.number().int().min(0).max(64).optional(),
  })
  .strict();

const landingSectionIdEnum = z.enum([
  "content_blocks",
  "features",
  "stats",
  "testimonials",
  "gallery",
  "planos",
  "faq",
]);

/** Cores e tipografia da landing «vendas escuras» — editável no admin (equivalente a variáveis CSS). */
export const landingExtrasThemeSchema = z
  .object({
    page_background: colorToken,
    nav_background: colorToken,
    accent: colorToken,
    accent_hover: colorToken,
    heading_on_dark: colorToken,
    muted_on_dark: colorToken,
    badge_border: colorToken,
    badge_background: colorToken,
    badge_text: colorToken,
    stats_gradient_from: colorToken,
    stats_gradient_to: colorToken,
    stats_border: colorToken,
    faq_border: colorToken,
    link: colorToken,
    card_surface: colorToken,
    selection_bg: colorToken,
    nav_border: colorToken,
    outline_nav_border: colorToken,
    outline_nav_bg: colorToken,
    stats_glow: colorToken,
    section_font: z.enum(["sans", "serif", "mono"]).optional().nullable(),
    accent_button_shadow: z.string().max(200).optional().nullable(),
    accent_button_radius: z.string().max(48).optional().nullable(),
    plan_card_radius: z.string().max(48).optional().nullable(),
  })
  .strict();

export const landingExtrasSchema = z
  .object({
    appearance: z.enum(["default", "sales_dark"]).optional(),
    plans_section_label: z.string().max(80).nullable().optional(),
    plans_section_title: z.string().max(200).nullable().optional(),
    plans_section_subtitle: z.string().max(500).nullable().optional(),
    features: z
      .object({
        title: z.string().max(200).nullable().optional(),
        subtitle: z.string().max(500).nullable().optional(),
        cards: z.array(landingExtrasCardSchema).max(6).optional(),
      })
      .nullable()
      .optional(),
    stats: z
      .object({
        title: z.string().max(200).nullable().optional(),
        subtitle: z.string().max(500).nullable().optional(),
        items: z.array(landingExtrasStatSchema).max(8).optional(),
      })
      .nullable()
      .optional(),
    faq: z
      .object({
        title: z.string().max(200).nullable().optional(),
        items: z.array(landingExtrasFaqItemSchema).max(20).optional(),
      })
      .nullable()
      .optional(),
    legal_footer: z
      .object({
        lines: z.array(z.string().max(2000)).max(10).optional(),
        links: z.array(landingExtrasLinkSchema).max(12).optional(),
      })
      .nullable()
      .optional(),
    /** Blocos de mídia em sequência (vídeo incorporado ou imagem por URL). */
    content_blocks: z.array(landingExtrasContentBlockSchema).max(20).nullable().optional(),
    /** Secção testemunhos em grelha (miniatura + vídeo ao clicar). */
    testimonials: z
      .object({
        enabled: z.boolean().optional(),
        title: z.string().max(200).nullable().optional(),
        subtitle: z.string().max(800).nullable().optional(),
        items: z.array(landingExtrasTestimonialItemSchema).max(8).optional(),
      })
      .nullable()
      .optional(),
    /** Galeria de imagens: grelha ou carrossel configurável. */
    gallery: z
      .object({
        enabled: z.boolean().optional(),
        display: z.enum(["grid", "carousel"]).optional().nullable(),
        carousel: landingExtrasGalleryCarouselSchema.optional().nullable(),
        title: z.string().max(200).nullable().optional(),
        subtitle: z.string().max(800).nullable().optional(),
        items: z.array(landingExtrasGalleryItemSchema).max(8).optional(),
      })
      .nullable()
      .optional(),
    /** Ordem das secções na página (ids únicos). */
    section_order: z.array(landingSectionIdEnum).max(12).nullable().optional(),
    /** Mostrar/ocultar secções (omitido = visível). */
    sections_enabled: z
      .object({
        content_blocks: z.boolean().optional(),
        features: z.boolean().optional(),
        stats: z.boolean().optional(),
        testimonials: z.boolean().optional(),
        gallery: z.boolean().optional(),
        planos: z.boolean().optional(),
        faq: z.boolean().optional(),
      })
      .nullable()
      .optional(),
    theme: landingExtrasThemeSchema.optional().nullable(),
  })
  .strict();

export type LandingExtras = z.infer<typeof landingExtrasSchema>;

/** Template inicial da landing pública (tema escuro tipo página de vendas completa). Editável no admin → Planos. */
export const DEFAULT_LANDING_EXTRAS: LandingExtras = {
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
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export const landingExtrasPatchSchema = landingExtrasSchema.partial();

/** PATCH parcial: funde com o estado atual (inclui objetos aninhados). */
export function mergeLandingExtras(
  base: LandingExtras,
  patch: unknown
): LandingExtras {
  if (!isPlainObject(patch)) return base;
  const parsed = landingExtrasPatchSchema.safeParse(patch);
  if (!parsed.success) return base;
  const p = parsed.data;
  const nextFeatures =
    p.features === undefined
      ? base.features
      : p.features === null
        ? null
        : {
            title:
              p.features.title !== undefined
                ? p.features.title
                : base.features?.title ?? null,
            subtitle:
              p.features.subtitle !== undefined
                ? p.features.subtitle
                : base.features?.subtitle ?? null,
            cards:
              p.features.cards !== undefined
                ? p.features.cards
                : base.features?.cards,
          };
  const nextStats =
    p.stats === undefined
      ? base.stats
      : p.stats === null
        ? null
        : {
            title:
              p.stats.title !== undefined ? p.stats.title : base.stats?.title ?? null,
            subtitle:
              p.stats.subtitle !== undefined
                ? p.stats.subtitle
                : base.stats?.subtitle ?? null,
            items:
              p.stats.items !== undefined ? p.stats.items : base.stats?.items,
          };
  const nextFaq =
    p.faq === undefined
      ? base.faq
      : p.faq === null
        ? null
        : {
            title: p.faq.title !== undefined ? p.faq.title : base.faq?.title ?? null,
            items: p.faq.items !== undefined ? p.faq.items : base.faq?.items,
          };
  const nextLegal =
    p.legal_footer === undefined
      ? base.legal_footer
      : p.legal_footer === null
        ? null
        : {
            lines:
              p.legal_footer.lines !== undefined
                ? p.legal_footer.lines
                : base.legal_footer?.lines,
            links:
              p.legal_footer.links !== undefined
                ? p.legal_footer.links
                : base.legal_footer?.links,
          };
  const nextTestimonials =
    p.testimonials === undefined
      ? base.testimonials
      : p.testimonials === null
        ? null
        : {
            enabled:
              p.testimonials.enabled !== undefined
                ? p.testimonials.enabled
                : base.testimonials?.enabled,
            title:
              p.testimonials.title !== undefined
                ? p.testimonials.title
                : base.testimonials?.title ?? null,
            subtitle:
              p.testimonials.subtitle !== undefined
                ? p.testimonials.subtitle
                : base.testimonials?.subtitle ?? null,
            items:
              p.testimonials.items !== undefined
                ? p.testimonials.items
                : base.testimonials?.items,
          };
  const nextGallery =
    p.gallery === undefined
      ? base.gallery
      : p.gallery === null
        ? null
        : {
            enabled:
              p.gallery.enabled !== undefined ? p.gallery.enabled : base.gallery?.enabled,
            display:
              p.gallery.display !== undefined
                ? p.gallery.display
                : base.gallery?.display ?? null,
            carousel:
              p.gallery.carousel === undefined
                ? base.gallery?.carousel
                : p.gallery.carousel === null
                  ? null
                  : {
                      ...(base.gallery?.carousel && typeof base.gallery.carousel === "object"
                        ? base.gallery.carousel
                        : {}),
                      ...p.gallery.carousel,
                    },
            title:
              p.gallery.title !== undefined ? p.gallery.title : base.gallery?.title ?? null,
            subtitle:
              p.gallery.subtitle !== undefined
                ? p.gallery.subtitle
                : base.gallery?.subtitle ?? null,
            items:
              p.gallery.items !== undefined ? p.gallery.items : base.gallery?.items,
          };
  const nextTheme =
    p.theme === undefined
      ? base.theme
      : p.theme === null
        ? null
        : {
            ...(base.theme && typeof base.theme === "object" ? base.theme : {}),
            ...p.theme,
          };
  return {
    ...base,
    ...(p.appearance !== undefined ? { appearance: p.appearance } : {}),
    ...(p.plans_section_label !== undefined
      ? { plans_section_label: p.plans_section_label }
      : {}),
    ...(p.plans_section_title !== undefined
      ? { plans_section_title: p.plans_section_title }
      : {}),
    ...(p.plans_section_subtitle !== undefined
      ? { plans_section_subtitle: p.plans_section_subtitle }
      : {}),
    ...(p.features !== undefined ? { features: nextFeatures } : {}),
    ...(p.stats !== undefined ? { stats: nextStats } : {}),
    ...(p.faq !== undefined ? { faq: nextFaq } : {}),
    ...(p.legal_footer !== undefined ? { legal_footer: nextLegal } : {}),
    ...(p.content_blocks !== undefined
      ? {
          content_blocks: p.content_blocks === null ? null : p.content_blocks,
        }
      : {}),
    ...(p.testimonials !== undefined ? { testimonials: nextTestimonials } : {}),
    ...(p.gallery !== undefined ? { gallery: nextGallery } : {}),
    ...(p.section_order !== undefined
      ? { section_order: p.section_order === null ? null : p.section_order }
      : {}),
    ...(p.sections_enabled !== undefined
      ? {
          sections_enabled:
            p.sections_enabled === null
              ? null
              : {
                  ...(base.sections_enabled && typeof base.sections_enabled === "object"
                    ? base.sections_enabled
                    : {}),
                  ...p.sections_enabled,
                },
        }
      : {}),
    ...(p.theme !== undefined ? { theme: nextTheme } : {}),
  };
}

export function normalizeLandingExtras(raw: unknown): LandingExtras {
  const parsed = landingExtrasSchema.safeParse(raw);
  if (!parsed.success) return { ...DEFAULT_LANDING_EXTRAS };
  return mergeLandingExtras(DEFAULT_LANDING_EXTRAS, parsed.data);
}
