import { nanoid } from "nanoid";
import type {
  ColumnNode,
  PageDocument,
  ResponsiveValue,
  SectionNode,
  SpacingValue,
  TypographyValue,
  WidgetNode,
  WidgetType,
} from "./types";

export const id = (prefix = "") => `${prefix}${nanoid(8)}`;

const r = <T,>(v: T): ResponsiveValue<T> => ({ desktop: v });

const spacing = (
  top = 0,
  right = 0,
  bottom = 0,
  left = 0,
  unit: SpacingValue["unit"] = "px",
): SpacingValue => ({ top, right, bottom, left, unit });

const typography = (overrides: Partial<TypographyValue> = {}): TypographyValue => ({
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
  textAlign: "left",
  textTransform: "none",
  ...overrides,
});

export function createColumn(widthPercent = 100): ColumnNode {
  return {
    id: id("col_"),
    widthPercent: r(widthPercent),
    styles: {
      padding: r(spacing(10, 10, 10, 10)),
    },
    widgets: [],
  };
}

export function createSection(columnCount = 1): SectionNode {
  const width = Math.floor(100 / columnCount);
  return {
    id: id("sec_"),
    layout: "boxed",
    contentWidth: 1140,
    columnGap: r(20),
    styles: {
      padding: r(spacing(60, 20, 60, 20)),
    },
    columns: Array.from({ length: columnCount }, () => createColumn(width)),
  };
}

const widgetDefaults: Record<WidgetType, () => Pick<WidgetNode, "content" | "styles">> = {
  heading: () => ({
    content: { text: "Adicione seu título aqui", tag: "h2" },
    styles: {
      typography: r(typography({ fontSize: 36, fontWeight: 700, lineHeight: 1.2 })),
      color: "#1a1a1a",
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  text: () => ({
    content: {
      html: "<p>Edite este parágrafo. Use o painel de propriedades para alterar conteúdo, cores e tipografia. Construa páginas incríveis arrastando widgets.</p>",
    },
    styles: {
      typography: r(typography({ fontSize: 16, lineHeight: 1.7 })),
      color: "#4a4a4a",
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  image: () => ({
    content: {
      src: "",
      alt: "Imagem",
      link: "",
    },
    styles: {
      align: r("center" as const),
      width: r("100%"),
    },
  }),
  button: () => ({
    content: { text: "Clique aqui", href: "#", target: "_self" },
    styles: {
      typography: r(typography({ fontSize: 16, fontWeight: 600, textAlign: "center" })),
      color: "#ffffff",
      background: "#e63946",
      padding: r(spacing(14, 28, 14, 28)),
      border: { width: 0, style: "solid", color: "#000000", radius: 6 },
      align: r("center" as const),
    },
  }),
  video: () => ({
    content: {
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      autoplay: false,
      controls: true,
    },
    styles: {},
  }),
  spacer: () => ({
    content: {},
    styles: { height: r("50px") },
  }),
  icon: () => ({
    content: { name: "star", size: 48 },
    styles: { color: "#e63946", align: r("center" as const) },
  }),
  divider: () => ({
    content: { style: "solid", weight: 1 },
    styles: {
      color: "#e0e0e0",
      margin: r(spacing(16, 0, 16, 0)),
      width: r("100%"),
    },
  }),
  html: () => ({
    content: { code: "<div style=\"padding:20px;text-align:center\">HTML customizado</div>" },
    styles: {},
  }),
  form: () => ({
    content: {
      fields: [
        { id: id("f_"), type: "text", name: "name", label: "Nome", placeholder: "Seu nome", required: true },
        { id: id("f_"), type: "email", name: "email", label: "E-mail", placeholder: "voce@email.com", required: true },
      ],
      submitText: "Enviar",
      successMessage: "Recebido! Em breve entraremos em contato.",
      errorMessage: "Não foi possível enviar. Tente novamente.",
      webhookUrl: "",
      redirectUrl: "",
      fieldGap: 12,
      buttonBg: "#e63946",
      buttonColor: "#ffffff",
      buttonRadius: 6,
      inputBg: "#ffffff",
      inputBorderColor: "#d0d5dd",
      inputRadius: 6,
      labelColor: "#1a1a1a",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  testimonials: () => ({
    content: {
      items: [
        {
          id: id("t_"),
          name: "Ana Silva",
          role: "CEO, Acme Inc.",
          avatar: "",
          quote: "Resultados surpreendentes. Em 30 dias dobramos nossas conversões.",
          rating: 5,
        },
        {
          id: id("t_"),
          name: "Carlos Mendes",
          role: "Diretor de Marketing",
          avatar: "",
          quote: "Ferramenta indispensável. Recomendo para qualquer time de growth.",
          rating: 5,
        },
        {
          id: id("t_"),
          name: "Joana Costa",
          role: "Founder, Studio J",
          avatar: "",
          quote: "Atendimento perfeito e produto excelente. Vale cada centavo.",
          rating: 5,
        },
      ],
      autoplay: true,
      intervalMs: 5000,
      showStars: true,
      showAvatars: true,
      cardBg: "#ffffff",
      textColor: "#1a1a1a",
      accentColor: "#f59e0b",
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  faq: () => ({
    content: {
      items: [
        {
          id: id("q_"),
          question: "Como funciona o processo?",
          answer: "<p>É simples: você se cadastra, configura sua página e começa a vender em minutos.</p>",
        },
        {
          id: id("q_"),
          question: "Posso cancelar quando quiser?",
          answer: "<p>Sim! Sem fidelidade e sem multa. Cancele com um clique.</p>",
        },
        {
          id: id("q_"),
          question: "Vocês oferecem suporte?",
          answer: "<p>Suporte humano por chat e e-mail, todos os dias da semana.</p>",
        },
      ],
      allowMultiple: false,
      defaultOpen: 0,
      itemBg: "#ffffff",
      itemBorderColor: "#e5e7eb",
      questionColor: "#111827",
      answerColor: "#4b5563",
      accentColor: "#e63946",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  countdown: () => ({
    content: {
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      showLabels: true,
      showDays: true,
      expiredMessage: "A oferta expirou!",
      digitBg: "#0f172a",
      digitColor: "#ffffff",
      labelColor: "#475569",
      separatorColor: "#0f172a",
      digitSize: 48,
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  gallery: () => ({
    content: {
      /** Sem imagens de exemplo — o utilizador adiciona URL ou upload do PC no painel. */
      images: [],
      columns: 3,
      gap: 12,
      borderRadius: 8,
      enableLightbox: true,
      aspectRatio: "square",
      layout: "grid",
      carouselAutoplay: true,
      carouselIntervalMs: 4500,
      carouselShowDots: true,
      carouselShowArrows: true,
      carouselSlidesDesktop: 3,
      carouselSlidesTablet: 2,
      carouselSlidesMobile: 1,
      carouselSlidesToScroll: 1,
      carouselObjectFit: "contain",
      carouselThumbWidthPx: 0,
      carouselTransitionMs: 450,
      carouselPauseOnHover: true,
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  imageCarousel: () => {
    const base = widgetDefaults.gallery();
    return {
      content: {
        ...base.content,
        layout: "carousel",
        carouselThumbWidthPx: 150,
        carouselSlidesDesktop: 4,
        carouselSlidesTablet: 3,
        carouselSlidesMobile: 2,
        carouselObjectFit: "contain",
        carouselTransitionMs: 500,
        carouselPauseOnHover: true,
      },
      styles: { ...base.styles },
    };
  },
  animatedHeadline: () => ({
    content: {
      prefix: "Construa páginas",
      rotatingWords: ["incríveis", "rápidas", "que vendem"],
      suffix: "em minutos.",
      animation: "fade",
      intervalMs: 2200,
      tag: "h2",
      highlightColor: "#e63946",
    },
    styles: {
      typography: r(typography({ fontSize: 40, fontWeight: 800, lineHeight: 1.2, textAlign: "center" })),
      color: "#0f172a",
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  priceTable: () => ({
    content: {
      badge: "Mais popular",
      title: "Pro",
      subtitle: "Para quem quer crescer",
      currency: "R$",
      price: "97",
      period: "/mês",
      features: [
        { id: id("pf_"), text: "Tudo do plano Básico", included: true },
        { id: id("pf_"), text: "Páginas ilimitadas", included: true },
        { id: id("pf_"), text: "Suporte prioritário", included: true },
        { id: id("pf_"), text: "Domínio customizado", included: true },
        { id: id("pf_"), text: "API de integração", included: false },
      ],
      ctaText: "Assinar Pro",
      ctaHref: "#",
      highlighted: true,
      cardBg: "#ffffff",
      textColor: "#1a1a1a",
      accentColor: "#e63946",
      ctaBg: "#e63946",
      ctaColor: "#ffffff",
      borderRadius: 12,
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  ctaBox: () => ({
    content: {
      title: "Pronto para transformar seu negócio?",
      description: "Junte-se a mais de 10.000 clientes satisfeitos e veja resultados em dias.",
      primaryText: "Começar agora",
      primaryHref: "#",
      secondaryText: "Falar com vendas",
      secondaryHref: "#",
      layout: "centered",
      background: "#0f172a",
      gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      textColor: "#ffffff",
      primaryBg: "#e63946",
      primaryColor: "#ffffff",
      borderRadius: 16,
      imageUrl: "",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  flipBox: () => ({
    content: {
      frontTitle: "Recurso incrível",
      frontSubtitle: "Passe o mouse para ver",
      frontIcon: "✨",
      frontBg: "#1f2937",
      frontTextColor: "#ffffff",
      backTitle: "Saiba mais",
      backDescription:
        "Aqui você descreve em detalhes esse recurso e mostra os benefícios para o usuário.",
      backCtaText: "Explorar",
      backCtaHref: "#",
      backBg: "#e63946",
      backTextColor: "#ffffff",
      backCtaBg: "#ffffff",
      backCtaColor: "#e63946",
      height: 280,
      borderRadius: 12,
      trigger: "hover",
      flipDirection: "horizontal",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
  progressTracker: () => ({
    content: {
      items: [
        { id: id("pb_"), label: "Design", value: 90 },
        { id: id("pb_"), label: "Desenvolvimento", value: 75 },
        { id: id("pb_"), label: "Marketing", value: 60 },
        { id: id("pb_"), label: "Vendas", value: 85 },
      ],
      variant: "bar",
      showPercent: true,
      animate: true,
      trackColor: "#e5e7eb",
      fillColor: "#e63946",
      labelColor: "#1a1a1a",
      height: 10,
      gap: 20,
      borderRadius: 999,
    },
    styles: {
      padding: r(spacing(20, 0, 20, 0)),
    },
  }),
  alert: () => ({
    content: {
      variant: "info",
      title: "Informação importante",
      message: "<p>Use este bloco para destacar avisos, garantias ou políticas sem perder conversões.</p>",
      showIcon: true,
      dismissible: false,
      borderRadius: 10,
    },
    styles: {
      margin: r(spacing(0, 0, 16, 0)),
    },
  }),
  tabs: () => ({
    content: {
      tabs: [
        {
          id: id("tab_"),
          label: "Benefícios",
          html: "<p>Liste aqui os principais benefícios do produto ou serviço.</p>",
        },
        {
          id: id("tab_"),
          label: "Como funciona",
          html: "<p>Explique o processo em passos simples para reduzir dúvidas.</p>",
        },
        {
          id: id("tab_"),
          label: "Garantia",
          html: "<p>Reforce garantia, suporte e formas de contacto.</p>",
        },
      ],
      tabBg: "#f1f5f9",
      tabActiveBg: "#ffffff",
      tabTextColor: "#64748b",
      tabActiveTextColor: "#0f172a",
      accentColor: "#e63946",
      panelBg: "#ffffff",
      panelTextColor: "#334155",
      borderColor: "#e2e8f0",
      borderRadius: 12,
    },
    styles: {
      margin: r(spacing(0, 0, 20, 0)),
    },
  }),
  socialIcons: () => ({
    content: {
      items: [
        { id: id("soc_"), network: "instagram", url: "https://instagram.com" },
        { id: id("soc_"), network: "facebook", url: "https://facebook.com" },
        { id: id("soc_"), network: "youtube", url: "https://youtube.com" },
      ],
      iconSize: 22,
      gap: 16,
      variant: "filled",
      iconBg: "#0f172a",
      iconColor: "#ffffff",
    },
    styles: {
      align: r("center" as const),
      padding: r(spacing(12, 0, 12, 0)),
    },
  }),
  iconList: () => ({
    content: {
      items: [
        {
          id: id("il_"),
          iconName: "check",
          title: "Entrega rápida",
          description: "<p>Receba em poucos dias com rastreamento.</p>",
          href: "",
        },
        {
          id: id("il_"),
          iconName: "shield",
          title: "Compra segura",
          description: "<p>Pagamento encriptado e dados protegidos.</p>",
          href: "",
        },
        {
          id: id("il_"),
          iconName: "headphones",
          title: "Suporte humano",
          description: "<p>Equipa disponível para ajudar quando precisar.</p>",
          href: "",
        },
      ],
      iconSize: 22,
      iconColor: "#e63946",
      gap: 16,
      titleColor: "#0f172a",
      descColor: "#64748b",
    },
    styles: {
      padding: r(spacing(0, 0, 0, 0)),
    },
  }),
};

export function createWidget(type: WidgetType): WidgetNode {
  const defaults = widgetDefaults[type]();
  return {
    id: id("w_"),
    type,
    ...defaults,
  };
}

export function createEmptyPage(name = "Página sem título"): PageDocument {
  return {
    id: id("page_"),
    name,
    sections: [],
    settings: { maxContentWidth: 1140, background: "#ffffff" },
    updatedAt: Date.now(),
  };
}
