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

export const landingExtrasContentBlockSchema = z.discriminatedUnion("type", [
  landingExtrasVideoBlockSchema,
  landingExtrasImageBlockSchema,
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

const landingSectionIdEnum = z.enum([
  "content_blocks",
  "features",
  "stats",
  "testimonials",
  "gallery",
  "planos",
  "faq",
]);

/** Valores CSS (#hex, rgba, hsl); validação estrita fica no admin; aqui aceitamos string curta para não rejeitar JSON antigo. */
const colorToken = z.string().max(80).optional().nullable();

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
    /** Galeria de imagens (grelha tipo testemunhos, sem vídeo). */
    gallery: z
      .object({
        enabled: z.boolean().optional(),
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
    "Limites claros de presells e cliques; faça upgrade quando a operação crescer. Comece grátis ou feche direto na Hotmart.",
  features: {
    title: "Tudo o que precisa num só ecossistema",
    subtitle:
      "Do primeiro clique ao remarketing: presells profissionais, rastreamento fiável e integrações pensadas para afiliados e media buyers.",
    cards: [
      {
        title: "Presells de alta conversão",
        body:
          "VSL, TSL, quizzes e dezenas de modelos prontos para testar ângulos e segmentos sem depender só de builders externos.",
      },
      {
        title: "Rastreamento e relatórios",
        body:
          "Scripts leves, painéis de plataformas e métricas para saber o que paga — e onde cortar desperdício.",
      },
      {
        title: "A sua marca, o seu domínio",
        body:
          "White-label e domínios personalizados para páginas e links que transmitem confiança até ao checkout.",
      },
    ],
  },
  stats: {
    title: "Feito para quem vive de performance",
    subtitle: "Estruture campanhas com dados, escale o que funciona e mantenha o controlo da operação.",
    items: [
      { value: "1 painel", label: "Presell + tracking unificados" },
      { value: "24/7", label: "Aceda quando a campanha disparar" },
      { value: "Hotmart", label: "Checkout integrado nos planos pagos" },
      { value: "API-first", label: "Automação e integrações à sua medida" },
    ],
  },
  faq: {
    title: "Perguntas frequentes",
    items: [
      {
        q: "O teste grátis inclui o quê?",
        a:
          "Depende do plano configurado no servidor: normalmente pode criar presells e usar rastreamento até aos limites do plano grátis. Verifique os números nos cartões acima.",
      },
      {
        q: "Como faço upgrade ou pago um plano pago?",
        a:
          "Clique no botão do plano desejado. Se existir link da Hotmart, será redirecionado para o checkout. Caso contrário, peça ao administrador para configurar HOTMART_PRODUCT_URL / URLs por plano.",
      },
      {
        q: "Posso usar o meu domínio nas presells?",
        a:
          "Sim, quando o seu plano incluir domínio personalizado e o domínio estiver verificado no painel. As presells publicadas podem ser servidas no seu host.",
      },
      {
        q: "Onde peço suporte?",
        a:
          "Utilize os canais indicados pela sua conta ou pelo administrador da plataforma. Informações de contacto podem ser adicionadas a esta secção no editor da landing.",
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
