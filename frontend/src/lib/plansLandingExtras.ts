/** Espelha `backend/src/lib/plansLandingExtras.ts` — tipos da landing extra (tema escuro, FAQ, etc.). */

import type { LandingSectionId } from "./landingSectionLayout";
import type { LandingPageThemeInput } from "@/lib/landingPageTheme";
import type { LandingTextStylesPublic } from "@/lib/plansLandingTextStyles";
import { coerceLandingTextStyles } from "@/lib/plansLandingTextStyles";

export type LandingExtrasAppearance = "default" | "sales_dark";

export interface LandingExtrasCard {
  title: string;
  body: string;
  /** Imagem opcional acima do título (URL ou caminho absoluto). */
  image_url?: string | null;
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
  font_weight?: "normal" | "medium" | "semibold" | "bold" | "extrabold";
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
  /** Citação em texto (opcional se houver vídeo). */
  quote?: string | null;
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

/** Opções do carrossel de imagens (autoplay, setas, pontos). */
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

/** Secção de garantia (selo + textos), tipicamente após os planos. */
export interface LandingGuarantee {
  enabled?: boolean;
  seal_image_url: string | null;
  title: string | null;
  lead: string | null;
  body: string | null;
  footer: string | null;
}

export type LandingSectionsEnabled = Partial<Record<LandingSectionId, boolean>>;

export interface LandingProductDemo {
  offer_name: string | null;
  nav_items: string[];
  presell_status: string | null;
  presell_note: string | null;
  keywords_label: string | null;
  keywords: string[];
  keyword_meta: string | null;
  ad_label: string | null;
  ad_title: string | null;
  ad_meta: string | null;
  rows: { label: string; value: string }[];
  caption: string | null;
}

export interface LandingPlanTaglines {
  free_trial: string | null;
  monthly: string | null;
  annual: string | null;
  quarterly: string | null;
}

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
  guarantee: LandingGuarantee | null;
  section_order: LandingSectionId[] | null;
  sections_enabled: LandingSectionsEnabled | null;
  hero_note: string | null;
  product_demo: LandingProductDemo | null;
  recommended_plan_type: string | null;
  recommended_note: string | null;
  free_limits_note: string | null;
  plan_taglines: LandingPlanTaglines | null;
  /** Cores / tipografia secções (tema escuro); ver editor Planos → Cores da landing. */
  theme: LandingPageThemeInput | null;
  /** Tipografia por zona (cor, fonte, tamanho, peso, alinhamento). */
  text_styles: LandingTextStylesPublic | null;
}

/** Alinhado ao backend `DEFAULT_LANDING_EXTRAS` — fallback se a resposta da API estiver incompleta. */
export const DEFAULT_LANDING_EXTRAS: LandingExtrasPublic = {
  appearance: "sales_dark",
  plans_section_label: "PLANOS",
  plans_section_title: "Escolha pelo que precisa agora",
  plans_section_subtitle:
    "Compare presells, cliques e o que cada plano inclui. Os números são os limites da conta, não uma previsão de vendas. O plano grátis não pede cartão nesta página.",
  features: {
    title: "O que leva no mesmo dia",
    subtitle:
      "A presell, as palavras-chave, os títulos do anúncio e o rastreio dos cliques. Sem WordPress e sem alojamento à parte. A venda entra quando a rede a confirma.",
    cards: [
      {
        title: "A presell no ar, sem WordPress",
        body: "Não instala alojamento, tema nem plugins. Cria a página da oferta no editor — cookies, desconto, VSL ou TSL — e publica. O clique do anúncio chega a uma página sua.",
      },
      {
        title: "Palavras-chave da oferta",
        body: "Indica o produto, o idioma e se a pessoa está a comprar, a comparar ou só a descobrir. Recebe a lista de pesquisas para usar no anúncio, em vez de a escrever numa folha.",
      },
      {
        title: "Títulos e texto do anúncio",
        body: "No mesmo passo recebe títulos, descrições, caminhos, sitelinks e destaques, já contados para Google Ads e Microsoft Advertising. Copia para a campanha. A publicação continua na plataforma de anúncios.",
      },
      {
        title: "Cliques e vendas rastreados",
        body: "O link do anúncio leva a campanha e a palavra-chave. Vê o clique quando chega. A venda aparece no mesmo painel quando a rede de afiliados envia o postback.",
      },
      {
        title: "Onde vale a pena gastar",
        body: "A campanha e a palavra-chave ficam ao lado da venda confirmada. Vê o que trouxe resultado e o que só gastou. A decisão de aumentar o orçamento é sua, com os dados juntos.",
      },
      {
        title: "Uma conta, em vez de quatro ferramentas",
        body: "Página, palavras-chave, anúncio e rastreio deixam de estar em sítios diferentes. Começa sem construtor de sites, sem folha de keywords e sem tracker à parte.",
      },
    ],
  },
  stats: {
    title: "Para quem é",
    subtitle: "Quem anuncia uma oferta e quer a página, o anúncio e os números no mesmo lugar.",
    items: [
      { value: "A começar", label: "Publica a primeira presell e recebe palavras-chave e títulos sem montar um site." },
      { value: "Já anuncia", label: "Junta a página, o texto do anúncio e o postback, e deixa o WordPress de fora." },
      { value: "Várias ofertas", label: "Vê que campanha e que palavra-chave trouxeram o clique e a venda." },
    ],
  },
  faq: {
    title: "Perguntas frequentes",
    items: [
      {
        q: "O plano grátis inclui o quê?",
        a:
          "Cria a conta e fica no Starter. O cartão mostra quantas presells e quantos cliques por mês pode usar. Não pedimos cartão nesta página. A marca Clickora pode aparecer no rodapé. O postback das redes fica nos planos pagos.",
      },
      {
        q: "Como cancelo ou peço reembolso?",
        a:
          "O pagamento dos planos pagos corre na Hotmart. O prazo, o cancelamento e o reembolso são os desse produto. A Clickora não acrescenta uma garantia de sete dias nesta página.",
      },
      {
        q: "Como funciona o pagamento Hotmart?",
        a:
          "Nos planos pagos, o botão Assinar abre o checkout Hotmart quando o link está configurado. Depois do pagamento aprovado, o webhook ativa o plano se o e-mail da compra for o da conta Clickora. Se o link não estiver configurado, a página avisa em vez de redirecionar.",
      },
      {
        q: "Preciso de WordPress ou de alojamento?",
        a:
          "Não. A presell publica na Clickora. Não instala WordPress, tema nem plugins. O domínio próprio, quando o plano o inclui, aponta para essa página: não é um alojamento à parte.",
      },
      {
        q: "Posso usar o meu domínio nas presells?",
        a:
          "Sim, nos planos que incluem domínio personalizado: adicione o domínio em Configurações, siga a verificação DNS e publique. O número de domínios permitido depende do plano.",
      },
      {
        q: "A pesquisa de anúncios publica no Google ou na Microsoft?",
        a:
          "Não. Recebe palavras-chave e um rascunho para rever: títulos, descrições, caminhos, sitelinks e destaques. O CSV é um ficheiro de revisão, não a importação oficial. A aprovação das plataformas não é garantida. Se a geração inteligente não estiver disponível, o texto usa o modelo do idioma do mercado e isso fica indicado.",
      },
      {
        q: "A Clickora garante vendas ou ROI?",
        a:
          "Não. A plataforma fornece páginas, tracking e relatórios. Conversões e lucro dependem da oferta, da rede de afiliados, dos anúncios e do tráfego. Não inventamos cliques nem testemunhos de ganhos.",
      },
    ],
  },
  legal_footer: {
    lines: [
      "Clickora — presell, palavras-chave, anúncio e rastreio para afiliados.",
      "Pagamentos de planos via Hotmart quando o checkout está configurado. Resultados comerciais não são garantidos.",
    ],
    links: [
      { label: "Criar conta", href: "/auth" },
      { label: "Entrar", href: "/auth" },
      { label: "Presell", href: "/presell-para-afiliados" },
      { label: "Rastreamento", href: "/rastreamento-afiliados" },
      { label: "Guia", href: "/guia-vendas-afiliados" },
      { label: "Privacidade", href: "/privacidade" },
      { label: "Termos", href: "/termos" },
    ],
  },
  content_blocks: [],
  testimonials: {
    enabled: false,
    title: "O que o fluxo resolve no dia a dia",
    subtitle:
      "Citações sobre o uso da ferramenta — não são promessas de rendimento. Cada conta vê os seus próprios números.",
    items: [
      {
        thumbnail_url: "",
        video_url: "",
        quote:
          "Preciso de cookies, VSL ou desconto no ar no mesmo dia — sem montar WordPress — e copiar o URL do anúncio com GCLID e palavra-chave.",
        name: "Fluxo típico",
        role: "Afiliado de tráfego pago",
        social_handle: null,
      },
      {
        thumbnail_url: "",
        video_url: "",
        quote:
          "Quero ver no painel qual campanha e keyword geraram o clique, e fechar a venda quando a rede manda o postback — não inventar métricas.",
        name: "Fluxo típico",
        role: "Media buyer",
        social_handle: null,
      },
      {
        thumbnail_url: "",
        video_url: "",
        quote:
          "Pagamento do plano na Hotmart com o mesmo e-mail da conta; depois do webhook, o acesso sobe de plano sem pedir suporte manual.",
        name: "Fluxo típico",
        role: "Assinante de plano pago",
        social_handle: null,
      },
    ],
  },
  gallery: null,
  guarantee: {
    enabled: true,
    seal_image_url: null,
    title: "Como funciona o pagamento",
    lead: "Os planos pagos abrem o checkout da Hotmart. A Clickora não cobra o cartão nesta página.",
    body:
      "Depois do pagamento aprovado, o webhook ativa o plano se o e-mail da compra for o da conta. Reembolso, prazo e cancelamento são os do produto na Hotmart. Esta página não acrescenta uma garantia de sete dias nem devolve o valor por conta própria. Não há promessa de vendas, ROI ou aprovação dos anúncios.",
    footer: "O plano grátis não pede cartão aqui. Os limites ficam no cartão Starter.",
  },
  section_order: ["features", "stats", "planos", "guarantee", "faq"],
  sections_enabled: null,
  hero_note:
    "O plano grátis está disponível. Cria a conta e fica no Starter, com os limites escritos no cartão. Não pedimos cartão nesta página.",
  product_demo: {
    offer_name: "Oferta de exemplo",
    nav_items: ["Presell", "Palavras-chave", "Anúncio", "Rastreio"],
    presell_status: "No ar",
    presell_note: "Publicada na Clickora. Sem WordPress.",
    keywords_label: "Palavras-chave",
    keywords: [
      "comprar oferta de exemplo",
      "oferta de exemplo vale a pena",
      "o que é oferta de exemplo",
    ],
    keyword_meta: "frase",
    ad_label: "Título do anúncio",
    ad_title: "Ver Oferta de exemplo",
    ad_meta: "22/30",
    rows: [
      { label: "Campanha", value: "pesquisa" },
      { label: "Clique", value: "1 exemplo" },
      { label: "Venda", value: "à espera do postback" },
    ],
    caption:
      "Exemplo da interface. Postback recebido de Hotmart, Digistore24, ClickBank, BuyGoods, JVZoo e SmartAdv.",
  },
  recommended_plan_type: "monthly",
  recommended_note: "Inclui o postback: a venda entra no painel quando a rede a confirma.",
  free_limits_note: "Serve para testar o fluxo, não para uma campanha em escala.",
  plan_taglines: {
    free_trial: "Para experimentar o fluxo, com poucas páginas e poucos cliques.",
    monthly: "Para quem já anuncia e precisa de registar as vendas.",
    annual: "Para usar o ano inteiro, com domínio próprio.",
    quarterly: null,
  },
  theme: null,
  text_styles: null,
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function optionalText(value: unknown, fallback: string | null): string | null {
  if (typeof value === "string") return value;
  if (value === null) return null;
  return fallback;
}

function stringList(value: unknown, fallback: string[], max: number): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function coerceProductDemo(raw: unknown): LandingProductDemo {
  const base = DEFAULT_LANDING_EXTRAS.product_demo;
  if (!base) {
    throw new Error("product-demo-default-missing");
  }
  if (!isPlainObject(raw)) return base;
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .map((row) => {
          if (!isPlainObject(row)) return null;
          const label = typeof row.label === "string" ? row.label.trim() : "";
          const value = typeof row.value === "string" ? row.value.trim() : "";
          if (!label && !value) return null;
          return { label, value };
        })
        .filter((row): row is { label: string; value: string } => row !== null)
        .slice(0, 6)
    : base.rows;
  return {
    offer_name: optionalText(raw.offer_name, base.offer_name),
    nav_items: stringList(raw.nav_items, base.nav_items, 6),
    presell_status: optionalText(raw.presell_status, base.presell_status),
    presell_note: optionalText(raw.presell_note, base.presell_note),
    keywords_label: optionalText(raw.keywords_label, base.keywords_label),
    keywords: stringList(raw.keywords, base.keywords, 8),
    keyword_meta: optionalText(raw.keyword_meta, base.keyword_meta),
    ad_label: optionalText(raw.ad_label, base.ad_label),
    ad_title: optionalText(raw.ad_title, base.ad_title),
    ad_meta: optionalText(raw.ad_meta, base.ad_meta),
    rows,
    caption: optionalText(raw.caption, base.caption),
  };
}

function coercePlanTaglines(raw: unknown): LandingPlanTaglines {
  const base = DEFAULT_LANDING_EXTRAS.plan_taglines;
  if (!base) {
    throw new Error("plan-taglines-default-missing");
  }
  if (!isPlainObject(raw)) return base;
  return {
    free_trial: optionalText(raw.free_trial, base.free_trial),
    monthly: optionalText(raw.monthly, base.monthly),
    annual: optionalText(raw.annual, base.annual),
    quarterly: optionalText(raw.quarterly, base.quarterly),
  };
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
            const imgRaw = typeof c.image_url === "string" ? c.image_url.trim() : "";
            const image_url =
              imgRaw && (imgRaw.startsWith("/") || /^https?:\/\//i.test(imgRaw))
                ? /500x500|placeholder|via\.placeholder|placehold\.co/i.test(imgRaw)
                  ? "/landing/hotmart-benefit-500.png"
                  : imgRaw
                : undefined;
            return { title, body, image_url: image_url ?? undefined };
          })
          .filter((c) => c && (c.title.trim() || c.body.trim() || c.image_url))
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
  const contentBlocksProvided = Array.isArray(rawBlocks);
  if (contentBlocksProvided && rawBlocks.length === 0) {
    content_blocks = [];
  } else if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
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
          fw === "extrabold" ||
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
        let src = typeof item.src === "string" ? item.src.trim() : "";
        // Placeholder MagTrack / vazio → imagem default da landing
        if (!src || /500x500|placeholder|via\.placeholder|placehold\.co/i.test(src)) {
          src = "/landing/hotmart-benefit-500.png";
        }
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
            const quote = typeof it.quote === "string" ? it.quote.trim() : "";
            const hasVideo = Boolean(thumbnail_url && video_url);
            const hasQuote = Boolean(quote);
            if (!hasVideo && !hasQuote) return null;
            return {
              thumbnail_url,
              video_url,
              quote: quote || null,
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
  if (!testimonials?.items?.length) {
    testimonials = DEFAULT_LANDING_EXTRAS.testimonials;
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

  let guarantee: LandingExtrasPublic["guarantee"] = null;
  if (raw.guarantee !== null && raw.guarantee !== undefined && isPlainObject(raw.guarantee)) {
    const g = raw.guarantee;
    const sealRaw = typeof g.seal_image_url === "string" ? g.seal_image_url.trim() : "";
    const seal_image_url =
      sealRaw && (sealRaw.startsWith("/") || /^https?:\/\//i.test(sealRaw)) ? sealRaw : null;
    const title = typeof g.title === "string" ? g.title : null;
    const lead = typeof g.lead === "string" ? g.lead : null;
    const body = typeof g.body === "string" ? g.body : null;
    const footer = typeof g.footer === "string" ? g.footer : null;
    const enabled = typeof g.enabled === "boolean" ? g.enabled : undefined;
    const hasAny =
      Boolean(title?.trim()) ||
      Boolean(lead?.trim()) ||
      Boolean(body?.trim()) ||
      Boolean(footer?.trim()) ||
      Boolean(seal_image_url);
    if (hasAny || enabled === false) {
      guarantee = {
        ...(enabled !== undefined ? { enabled } : {}),
        seal_image_url,
        title,
        lead,
        body,
        footer,
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
      "guarantee",
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
      guarantee: pick("guarantee"),
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

  if (!contentBlocksProvided && !content_blocks?.length) {
    content_blocks = DEFAULT_LANDING_EXTRAS.content_blocks;
  }
  if (!guarantee) {
    guarantee = DEFAULT_LANDING_EXTRAS.guarantee;
  }
  if (!features) {
    features = DEFAULT_LANDING_EXTRAS.features;
  }
  if (!stats) {
    stats = DEFAULT_LANDING_EXTRAS.stats;
  }
  if (!faq) {
    faq = DEFAULT_LANDING_EXTRAS.faq;
  }

  let order = section_order ?? DEFAULT_LANDING_EXTRAS.section_order;
  if (order && content_blocks?.length && !order.includes("content_blocks")) {
    const next = [...order];
    const featIdx = next.indexOf("features");
    next.splice(featIdx >= 0 ? featIdx + 1 : 0, 0, "content_blocks");
    order = next;
  }
  if (order && testimonials?.items?.length && !order.includes("testimonials")) {
    const next = [...order];
    const planosIdx = next.indexOf("planos");
    next.splice(planosIdx >= 0 ? planosIdx : next.length, 0, "testimonials");
    order = next;
  }
  if (order && guarantee && !order.includes("guarantee")) {
    const next = [...order];
    const faqIdx = next.indexOf("faq");
    next.splice(faqIdx >= 0 ? faqIdx : next.length, 0, "guarantee");
    order = next;
  }

  return {
    appearance,
    plans_section_label: plans_section_label ?? DEFAULT_LANDING_EXTRAS.plans_section_label,
    plans_section_title: plans_section_title ?? DEFAULT_LANDING_EXTRAS.plans_section_title,
    plans_section_subtitle: plans_section_subtitle ?? DEFAULT_LANDING_EXTRAS.plans_section_subtitle,
    features,
    stats,
    faq,
    legal_footer: legal_footer ?? DEFAULT_LANDING_EXTRAS.legal_footer,
    content_blocks,
    testimonials,
    gallery,
    guarantee,
    section_order: order,
    sections_enabled,
    hero_note: optionalText(raw.hero_note, DEFAULT_LANDING_EXTRAS.hero_note),
    product_demo: raw.product_demo === null ? null : coerceProductDemo(raw.product_demo),
    recommended_plan_type: optionalText(raw.recommended_plan_type, DEFAULT_LANDING_EXTRAS.recommended_plan_type),
    recommended_note: optionalText(raw.recommended_note, DEFAULT_LANDING_EXTRAS.recommended_note),
    free_limits_note: optionalText(raw.free_limits_note, DEFAULT_LANDING_EXTRAS.free_limits_note),
    plan_taglines: raw.plan_taglines === null ? null : coercePlanTaglines(raw.plan_taglines),
    theme,
    text_styles,
  };
}
