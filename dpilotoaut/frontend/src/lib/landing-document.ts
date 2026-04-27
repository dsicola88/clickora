import { z } from "zod";

import {
  normalizeLandingDocument,
  normalizeWidgetNode,
  normalizeWidgetSettings,
} from "./landing-normalize";

export { normalizeLandingDocument, normalizeWidgetNode, normalizeWidgetSettings };

/** Widgets arrastáveis (estilo Elementor: secção → coluna de conteúdos). */
export const WIDGET_TYPES = [
  "hero",
  "heading",
  "text",
  "image",
  "button",
  "spacer",
  "divider",
  "pricing",
  "icon_list",
  "html",
  /** Vídeo (YouTube / Vimeo) */
  "video",
  /** FAQ / acordeão */
  "accordion",
  "testimonial",
  /** iframe (mapa, etc.) */
  "embed",
  /** Grelha de colunas (HTML por célula) */
  "columns",
  /** Galeria de imagens */
  "gallery",
  /** Formulário (action https) */
  "form",
  /** Contagem decrescente até data/hora */
  "countdown",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Espaçamento e tipografia (UI visual, sem CSS manual) — padrão tipo Elementor. */
export type LandingSectionUi = {
  marginTop?: number;
  marginBottom?: number;
};

export type LandingWidgetUi = {
  marginTop?: number;
  marginBottom?: number;
  /** heading, text */
  fontSize?: string;
  lineHeight?: string;
  fontWeight?: string;
  color?: string;
  letterSpacing?: string;
  /** hero */
  titleFontSize?: string;
  titleColor?: string;
  titleFontWeight?: string;
  subtitleFontSize?: string;
  subtitleColor?: string;
  /** image */
  maxWidth?: string;
  borderRadius?: string;
  /** button */
  buttonSize?: "default" | "sm" | "lg";
};

export interface SectionNode {
  id: string;
  type: "section";
  settings: {
    background?: "default" | "muted" | "primary" | "dark" | "custom";
    customBg?: string;
    /** Cor do texto (hex/css) — útil com fundo custom. Sobreponde a cor implícita do tema. */
    textColor?: string;
    paddingY?: "none" | "sm" | "md" | "lg" | "xl";
    fullBleed?: boolean;
    /** Classes extra no `<section>` (ex.: `rounded-2xl border`, ou classes Tailwind). */
    htmlClass?: string;
    /** CSS desta secção; aninhe com `& h2 { }` se precisar. */
    customCss?: string;
    ui?: LandingSectionUi;
  };
  children: WidgetNode[];
}

export type WidgetNode = {
  id: string;
  type: WidgetType;
  settings: Record<string, unknown> & {
    /** Classes no wrapper do widget. */
    htmlClass?: string;
    /** CSS do bloco; aninhe com `&` como no Elementor. */
    customCss?: string;
    ui?: LandingWidgetUi;
  };
};

export interface LandingDocument {
  version: 1;
  /** CSS global da landing (só quem publica; injetado na raiz). */
  customCss?: string;
  sections: SectionNode[];
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const sectionSettings = z.object({
  background: z.enum(["default", "muted", "primary", "dark", "custom"]).optional(),
  customBg: z.string().optional(),
  textColor: z.string().max(200).optional(),
  paddingY: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
  fullBleed: z.boolean().optional(),
  htmlClass: z.string().max(2000).optional(),
  customCss: z.string().max(50_000).optional(),
  ui: z
    .object({
      marginTop: z.number().min(0).max(4000).optional(),
      marginBottom: z.number().min(0).max(4000).optional(),
    })
    .passthrough()
    .optional(),
});

const widgetTypeEnum = z.enum([
  "hero",
  "heading",
  "text",
  "image",
  "button",
  "spacer",
  "divider",
  "pricing",
  "icon_list",
  "html",
  "video",
  "accordion",
  "testimonial",
  "embed",
  "columns",
  "gallery",
  "form",
  "countdown",
]);

const widgetNode = z.object({
  id: z.string().min(1),
  type: widgetTypeEnum,
  settings: z.record(z.string(), z.unknown()),
});

const sectionNode = z.object({
  id: z.string().min(1),
  type: z.literal("section"),
  settings: sectionSettings,
  children: z.array(widgetNode),
});

export const landingDocumentSchema = z.object({
  version: z.literal(1),
  customCss: z.string().max(200_000).optional(),
  sections: z.array(sectionNode),
});

export function parseLandingDocument(raw: unknown): LandingDocument {
  const v = landingDocumentSchema.safeParse(raw);
  if (!v.success) {
    return getDefaultLandingDocument();
  }
  return normalizeLandingDocument(v.data as LandingDocument);
}

export function getDefaultLandingDocument(): LandingDocument {
  return {
    version: 1,
    sections: [
      {
        id: newId(),
        type: "section",
        settings: { background: "muted", paddingY: "xl", fullBleed: false },
        children: [
          {
            id: newId(),
            type: "hero",
            settings: {
              title: "Automatize o seu paid media",
              subtitle:
                "Copilot e Autopilot com regras de segurança. Google Ads, Meta e TikTok num só lugar.",
              primaryCtaLabel: "Começar",
              primaryCtaHref: "/auth/sign-up",
              secondaryCtaLabel: "Entrar",
              secondaryCtaHref: "/auth/sign-in",
              align: "center",
            },
          },
        ],
      },
      {
        id: newId(),
        type: "section",
        settings: { background: "default", paddingY: "lg" },
        children: [
          {
            id: newId(),
            type: "heading",
            settings: {
              text: "Planos",
              level: 2,
              align: "center",
            },
          },
          {
            id: newId(),
            type: "text",
            settings: {
              body: "Preço base mensal; trimestral e anual com 10% de desconto sobre o valor linear (3× ou 12× o mês).",
              align: "center",
            },
          },
          {
            id: newId(),
            type: "pricing",
            settings: getDefaultPricingSettings(),
          },
        ],
      },
    ],
  };
}

/** Plano de teste grátis (ex.: 14 dias) — tudo personalizável no editor. */
export type PricingFreeTrialSettings = {
  /** Se `false`, o cartão de teste deixa de ser mostrado (planos pagos inalterados). */
  enabled?: boolean;
  /** Onde inserir o cartão no alinhamento. */
  position?: "first" | "last";
  /** Título do cartão. Use `{dias}` ou `{days}` para acompanhar «Duração (dias)». */
  name?: string;
  /** Texto principal do “preço” (ex.: Grátis, R$ 0, 0€). Pode conter `{dias}`. */
  priceLabel?: string;
  /** Linha por baixo do preço. Pode conter `{dias}` / `{days}`. */
  subtitle?: string;
  /** Valor usado em textos com `{dias}` / `{days}`. */
  trialDays?: number;
  /** Ex.: "Uso pleno por {dias} dias" — substitui `trialDays`. */
  periodText?: string;
  /** Ex.: "{dias} dias de teste" — substitui `trialDays`. */
  badge?: string;
  ctaLabel?: string;
  checkoutUrl?: string;
  /** Lista própria do teste; se vazia, reutilizam-se as `features` dos planos pagos. */
  features?: string[];
  /** Destacar o cartão com o mesmo anel do plano “popular”. */
  highlight?: boolean;
};

export function getDefaultFreeTrialSettings(): Required<
  Pick<
    PricingFreeTrialSettings,
    "enabled" | "position" | "name" | "priceLabel" | "subtitle" | "trialDays" | "periodText" | "badge" | "ctaLabel" | "checkoutUrl" | "features" | "highlight"
  >
> {
  return {
    enabled: true,
    position: "first",
    name: "Grátis {dias} dias",
    priceLabel: "Grátis",
    subtitle: "Teste com acesso a todas as funções essenciais",
    trialDays: 14,
    periodText: "Sem cartão agora. Uso pleno por {dias} dias. Depois escolhe um plano pago se quiser continuar.",
    badge: "{dias} dias de teste",
    ctaLabel: "Começar grátis",
    checkoutUrl: "/auth/sign-up",
    features: [
      "Acesso a funcionalidades principais",
      "Guiado na configuração inicial",
      "Suporte por e-mail durante o teste",
    ],
    highlight: false,
  };
}

export function getDefaultPricingSettings() {
  return {
    headline: "Escolha o seu plano",
    monthlyBase: 197,
    currency: "BRL",
    discountPercent: 10,
    planNames: {
      monthly: "Mensal",
      quarterly: "Trimestral",
      annual: "Anual",
    },
    features: [
      "Workspaces e equipa",
      "Google Ads, Meta, TikTok",
      "Modo copilot e autopilot",
      "Aprovações e auditoria",
    ],
    ctaLabel: "Subscrever",
    checkoutMonthly: "https://pay.hotmart.com/",
    checkoutQuarterly: "https://pay.hotmart.com/",
    checkoutAnnual: "https://pay.hotmart.com/",
    freeTrial: getDefaultFreeTrialSettings() satisfies PricingFreeTrialSettings,
  };
}

export function getDefaultFormSettings() {
  return {
    heading: "Contacte-nos",
    description: "Responderemos o mais breve possível.",
    submitLabel: "Enviar",
    action: "",
    method: "post" as const,
    fields: [
      { id: "name", type: "text" as const, label: "Nome", required: true },
      { id: "email", type: "email" as const, label: "E-mail", required: true },
      {
        id: "message",
        type: "textarea" as const,
        label: "Mensagem",
        required: true,
        placeholder: "Escreva aqui…",
      },
    ],
  };
}

export function createEmptySection(): SectionNode {
  return {
    id: newId(),
    type: "section",
    settings: { background: "default", paddingY: "md" },
    children: [],
  };
}

export function createWidget(type: WidgetType): WidgetNode {
  const id = newId();
  switch (type) {
    case "hero":
      return {
        id,
        type: "hero",
        settings: {
          title: "Novo título",
          subtitle: "Subtítulo de destaque. Edite no painel à direita.",
          primaryCtaLabel: "Começar",
          primaryCtaHref: "/auth/sign-up",
          secondaryCtaLabel: "Entrar",
          secondaryCtaHref: "/auth/sign-in",
          align: "center",
        },
      };
    case "heading":
      return {
        id,
        type: "heading",
        settings: { text: "Adicione o seu título aqui", level: 2, align: "left" },
      };
    case "text":
      return {
        id,
        type: "text",
        settings: {
          body:
            "Edite este parágrafo. Use o painel de propriedades para alterar o conteúdo e a tipografia. Pode incluir HTML simples (negrito, ligações) se precisar.",
          align: "left",
        },
      };
    case "image":
      return {
        id,
        type: "image",
        settings: {
          src: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&q=80",
          alt: "Imagem",
          rounded: true,
        },
      };
    case "button":
      return {
        id,
        type: "button",
        settings: { label: "Clique aqui", href: "#", variant: "default" },
      };
    case "spacer":
      return { id, type: "spacer", settings: { height: 24 } };
    case "divider":
      return { id, type: "divider", settings: {} };
    case "pricing":
      return { id, type: "pricing", settings: getDefaultPricingSettings() };
    case "icon_list":
      return {
        id,
        type: "icon_list",
        settings: {
          items: ["Item um", "Item dois", "Item três"],
        },
      };
    case "html":
      return { id, type: "html", settings: { html: "<p>HTML livre</p>" } };
    case "video":
      return {
        id,
        type: "video",
        settings: {
          url: "",
          caption: "",
          aspect: "16/9" as const,
          align: "center" as const,
        },
      };
    case "accordion":
      return {
        id,
        type: "accordion",
        settings: {
          items: [
            { title: "Como posso começar?", body: "Crie a sua conta e siga o guia de configuração no painel." },
            { title: "Há fidelização?", body: "Pode cancelar ou alterar o plano conforme as condições do checkout (Hotmart)." },
          ],
          allowMultiple: false,
        },
      };
    case "testimonial":
      return {
        id,
        type: "testimonial",
        settings: {
          quote: "A equipa poupou horas em relatórios e campanhas. O copilot é muito claro nas sugestões.",
          author: "Mariana Silva",
          role: "Head de performance",
          avatarUrl: "",
          align: "center" as const,
        },
      };
    case "embed":
      return {
        id,
        type: "embed",
        settings: {
          title: "Incorporação (mapa, etc.)",
          src: "",
          height: 400,
          align: "left" as const,
        },
      };
    case "columns":
      return {
        id,
        type: "columns",
        settings: {
          columnCount: 2 as const,
          gap: "md" as const,
          cells: [
            "<p><strong>Coluna 1</strong></p><p>Texto ou HTML. Pode usar listas, links e estilos.</p>",
            "<p><strong>Coluna 2</strong></p><p>Conteúdo independente. Em ecrãs pequenos as colunas empilham.</p>",
          ],
        },
      };
    case "gallery":
      return {
        id,
        type: "gallery",
        settings: {
          images: [
            {
              src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80",
              alt: "Equipa",
            },
            {
              src: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
              alt: "Reunião",
            },
            {
              src: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80",
              alt: "Trabalho",
            },
          ],
          gridCols: 3 as const,
          gap: "md" as const,
          rounded: true,
        },
      };
    case "form":
      return { id, type: "form", settings: getDefaultFormSettings() };
    case "countdown":
      return {
        id,
        type: "countdown",
        settings: {
          headline: "",
          targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          labels: { days: "Dias", hours: "Horas", minutes: "Minutos", seconds: "Segundos" },
          expiredMessage: "A promoção terminou. Veja as condições atuais abaixo.",
        },
      };
    default:
      return { id, type: "text", settings: { body: "" } };
  }
}

/** Valor total do período e equivalente mensal (após desconto sobre 3× ou 12× o mês). */
export function computePlanPrices(settings: {
  monthlyBase: number;
  discountPercent: number;
}) {
  const m = settings.monthlyBase;
  const d = settings.discountPercent / 100;
  const monthlyTotal = m;
  const quarterlyFull = 3 * m;
  const quarterly = quarterlyFull * (1 - d);
  const annualFull = 12 * m;
  const annual = annualFull * (1 - d);
  return {
    monthly: { total: monthlyTotal, perMonth: m, label: "mês" },
    quarterly: {
      total: quarterly,
      perMonth: quarterly / 3,
      savedVsLinear: quarterlyFull - quarterly,
    },
    annual: {
      total: annual,
      perMonth: annual / 12,
      savedVsLinear: annualFull - annual,
    },
  };
}

export function findWidgetPath(
  doc: LandingDocument,
  widgetId: string,
): { sectionIndex: number; widgetIndex: number } | null {
  for (let si = 0; si < doc.sections.length; si++) {
    const wix = doc.sections[si]!.children.findIndex((w) => w.id === widgetId);
    if (wix >= 0) return { sectionIndex: si, widgetIndex: wix };
  }
  return null;
}
