import type { PageDocument, SectionNode, WidgetNode } from "./types";
import { createColumn, createSection, createWidget, id } from "./factory";

export interface TemplateDefinition {
  id: string;
  name: string;
  category: "landing" | "presell" | "vsl" | "lead";
  description: string;
  thumbnail: string;
  build: () => SectionNode[];
}

/** Helper to build a configured widget. */
function w<T extends Record<string, unknown>>(
  type: WidgetNode["type"],
  content: T,
  styles: WidgetNode["styles"] = {},
): WidgetNode {
  const base = createWidget(type);
  return {
    ...base,
    content: { ...base.content, ...content },
    styles: { ...base.styles, ...styles },
  };
}

/** Build a section with columns + widgets. */
function s(
  columnsWidgets: WidgetNode[][],
  sectionStyles: SectionNode["styles"] = {},
  layout: SectionNode["layout"] = "boxed",
): SectionNode {
  const sec = createSection(columnsWidgets.length);
  sec.layout = layout;
  sec.styles = { ...sec.styles, ...sectionStyles };
  sec.columns = columnsWidgets.map((widgets, i) => {
    const col = createColumn(Math.floor(100 / columnsWidgets.length));
    col.widgets = widgets;
    if (i === 0 && columnsWidgets.length === 1) {
      // single-col, leave default
    }
    return col;
  });
  return sec;
}

/* ------------------- LANDING PAGE ------------------- */

const landingPageTemplate: TemplateDefinition = {
  id: "landing-saas",
  name: "Landing SaaS",
  category: "landing",
  description: "Hero, recursos, CTA — perfeita para SaaS e produtos digitais",
  thumbnail:
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80",
  build: () => [
    // HERO
    s(
      [
        [
          w("heading", {
            text: "Transforme sua ideia em um negócio escalável",
            tag: "h1",
          }, {
            typography: { desktop: { fontSize: 56, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, textAlign: "center", textTransform: "none" } },
            color: "#0f172a",
            margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
          }),
          w("text", {
            html: "<p>A plataforma completa que ajuda você a criar, lançar e crescer seu produto sem complicação técnica.</p>",
          }, {
            typography: { desktop: { fontSize: 20, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#475569",
            margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
          }),
          w("button", {
            text: "Começar grátis →",
            href: "#",
          }, {
            typography: { desktop: { fontSize: 18, fontWeight: 700, lineHeight: 1, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#ffffff",
            background: "#6366f1",
            padding: { desktop: { top: 18, right: 36, bottom: 18, left: 36, unit: "px" } },
            border: { width: 0, style: "solid", color: "#000", radius: 10 },
            align: { desktop: "center" },
          }),
        ],
      ],
      {
        background: "linear-gradient(135deg, #f5f7ff 0%, #ffffff 100%)",
        padding: { desktop: { top: 100, right: 20, bottom: 100, left: 20, unit: "px" } },
      },
    ),
    // FEATURES
    s(
      [
        [
          w("icon", { name: "zap", size: 40 }, {
            color: "#6366f1",
            align: { desktop: "center" },
            margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
          }),
          w("heading", { text: "Rápido", tag: "h3" }, {
            typography: { desktop: { fontSize: 22, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#0f172a",
            margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
          }),
          w("text", {
            html: "<p>Performance otimizada para garantir a melhor experiência aos seus usuários.</p>",
          }, {
            typography: { desktop: { fontSize: 15, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#64748b",
          }),
        ],
        [
          w("icon", { name: "shield", size: 40 }, {
            color: "#6366f1",
            align: { desktop: "center" },
            margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
          }),
          w("heading", { text: "Seguro", tag: "h3" }, {
            typography: { desktop: { fontSize: 22, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#0f172a",
            margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
          }),
          w("text", {
            html: "<p>Dados protegidos com criptografia de ponta e padrões internacionais.</p>",
          }, {
            typography: { desktop: { fontSize: 15, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#64748b",
          }),
        ],
        [
          w("icon", { name: "heart", size: 40 }, {
            color: "#6366f1",
            align: { desktop: "center" },
            margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
          }),
          w("heading", { text: "Amado", tag: "h3" }, {
            typography: { desktop: { fontSize: 22, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#0f172a",
            margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
          }),
          w("text", {
            html: "<p>Mais de 10 mil clientes satisfeitos confiam na nossa solução todos os dias.</p>",
          }, {
            typography: { desktop: { fontSize: 15, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#64748b",
          }),
        ],
      ],
      {
        background: "#ffffff",
        padding: { desktop: { top: 80, right: 20, bottom: 80, left: 20, unit: "px" } },
      },
    ),
    // CTA
    s(
      [
        [
          w("heading", { text: "Pronto para começar?", tag: "h2" }, {
            typography: { desktop: { fontSize: 40, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.5, textAlign: "center", textTransform: "none" } },
            color: "#ffffff",
            margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } },
          }),
          w("button", { text: "Criar minha conta", href: "#" }, {
            typography: { desktop: { fontSize: 18, fontWeight: 700, lineHeight: 1, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#6366f1",
            background: "#ffffff",
            padding: { desktop: { top: 18, right: 36, bottom: 18, left: 36, unit: "px" } },
            border: { width: 0, style: "solid", color: "#000", radius: 10 },
            align: { desktop: "center" },
          }),
        ],
      ],
      {
        background: "#6366f1",
        padding: { desktop: { top: 80, right: 20, bottom: 80, left: 20, unit: "px" } },
      },
    ),
  ],
};

/* ------------------- PRESELL ------------------- */

const presellTemplate: TemplateDefinition = {
  id: "presell-classic",
  name: "Presell Clássica",
  category: "presell",
  description: "Headline impactante + storytelling + CTA — pronta para tráfego pago",
  thumbnail:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80",
  build: () => [
    s(
      [
        [
          w("heading", {
            text: "ATENÇÃO: Esta página será removida em breve",
            tag: "h2",
          }, {
            typography: { desktop: { fontSize: 14, fontWeight: 700, lineHeight: 1.4, letterSpacing: 1, textAlign: "center", textTransform: "uppercase" } },
            color: "#dc2626",
            margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } },
          }),
          w("heading", {
            text: "O método que está mudando vidas em 2026 (e ninguém quer que você saiba)",
            tag: "h1",
          }, {
            typography: { desktop: { fontSize: 44, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5, textAlign: "center", textTransform: "none" } },
            color: "#0f172a",
            margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } },
          }),
          w("text", {
            html: "<p>Descubra como pessoas comuns estão alcançando resultados extraordinários com uma estratégia simples — sem precisar de experiência prévia.</p>",
          }, {
            typography: { desktop: { fontSize: 19, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#475569",
            margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
          }),
          w("image", {
            src: "https://images.unsplash.com/photo-1552581234-26160f608093?w=1200&q=80",
            alt: "Resultado",
          }, {
            align: { desktop: "center" },
            width: { desktop: "100%" },
            margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
            border: { width: 0, style: "solid", color: "#000", radius: 12 },
          }),
          w("text", {
            html: "<p>Imagine acordar amanhã sabendo exatamente o que fazer para sair da estagnação. Mais de <strong>50.000 pessoas</strong> já aplicaram este método e estão colhendo os frutos.</p><p>A boa notícia? Você pode começar hoje mesmo, com poucos minutos por dia.</p>",
          }, {
            typography: { desktop: { fontSize: 17, fontWeight: 400, lineHeight: 1.7, letterSpacing: 0, textAlign: "left", textTransform: "none" } },
            color: "#1e293b",
            margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
          }),
          w("button", { text: "QUERO SABER MAIS →", href: "#" }, {
            typography: { desktop: { fontSize: 20, fontWeight: 800, lineHeight: 1, letterSpacing: 0.5, textAlign: "center", textTransform: "uppercase" } },
            color: "#ffffff",
            background: "#16a34a",
            padding: { desktop: { top: 20, right: 40, bottom: 20, left: 40, unit: "px" } },
            border: { width: 0, style: "solid", color: "#000", radius: 8 },
            align: { desktop: "center" },
          }),
        ],
      ],
      {
        background: "#ffffff",
        padding: { desktop: { top: 60, right: 20, bottom: 60, left: 20, unit: "px" } },
      },
    ),
  ],
};

/* ------------------- VSL ------------------- */

const vslTemplate: TemplateDefinition = {
  id: "vsl-classic",
  name: "VSL — Vídeo de Vendas",
  category: "vsl",
  description: "Vídeo em destaque + headline + CTA escondido até o pitch",
  thumbnail:
    "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&q=80",
  build: () => [
    s(
      [
        [
          w("heading", {
            text: "Assista ao vídeo abaixo até o final",
            tag: "h1",
          }, {
            typography: { desktop: { fontSize: 32, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#ffffff",
            margin: { desktop: { top: 0, right: 0, bottom: 12, left: 0, unit: "px" } },
          }),
          w("text", {
            html: "<p>Para descobrir o segredo que poucos conhecem.</p>",
          }, {
            typography: { desktop: { fontSize: 18, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#cbd5e1",
            margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
          }),
          w("video", {
            provider: "youtube",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            controls: true,
          }, {
            margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
          }),
          w("button", { text: "Quero garantir minha vaga →", href: "#" }, {
            typography: { desktop: { fontSize: 18, fontWeight: 700, lineHeight: 1, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#0f172a",
            background: "#facc15",
            padding: { desktop: { top: 18, right: 36, bottom: 18, left: 36, unit: "px" } },
            border: { width: 0, style: "solid", color: "#000", radius: 8 },
            align: { desktop: "center" },
          }),
        ],
      ],
      {
        background: "#0f172a",
        padding: { desktop: { top: 80, right: 20, bottom: 80, left: 20, unit: "px" } },
      },
    ),
  ],
};

/* ------------------- LEAD CAPTURE ------------------- */

const leadCaptureTemplate: TemplateDefinition = {
  id: "lead-capture",
  name: "Captura de Leads",
  category: "lead",
  description: "Headline + benefícios + formulário com validação e webhook",
  thumbnail:
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80",
  build: () => [
    s(
      [
        [
          w("heading", {
            text: "Receba grátis nosso guia completo",
            tag: "h1",
          }, {
            typography: { desktop: { fontSize: 42, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5, textAlign: "left", textTransform: "none" } },
            color: "#0f172a",
            margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
          }),
          w("text", {
            html: "<p>Material exclusivo com as 10 estratégias que estão gerando os melhores resultados em 2026.</p><ul style='margin:16px 0;padding-left:20px'><li>✅ Mais de 50 páginas de conteúdo</li><li>✅ Cases reais e templates</li><li>✅ Atualizado mensalmente</li></ul>",
          }, {
            typography: { desktop: { fontSize: 17, fontWeight: 400, lineHeight: 1.7, letterSpacing: 0, textAlign: "left", textTransform: "none" } },
            color: "#475569",
          }),
        ],
        [
          w("heading", { text: "Receba agora", tag: "h3" }, {
            typography: { desktop: { fontSize: 22, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0, textAlign: "center", textTransform: "none" } },
            color: "#0f172a",
            margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
          }),
          w("form", {
            fields: [
              { id: id("f_"), type: "text", name: "name", label: "Nome", placeholder: "Seu nome", required: true },
              { id: id("f_"), type: "email", name: "email", label: "E-mail", placeholder: "voce@email.com", required: true },
              { id: id("f_"), type: "tel", name: "phone", label: "WhatsApp", placeholder: "(00) 00000-0000", required: false },
            ],
            submitText: "Quero o guia grátis",
            successMessage: "Pronto! Verifique seu e-mail em alguns minutos.",
            webhookUrl: "",
            fieldGap: 12,
            buttonBg: "#16a34a",
            buttonColor: "#ffffff",
            buttonRadius: 8,
            inputBg: "#ffffff",
            inputBorderColor: "#d0d5dd",
            inputRadius: 6,
            labelColor: "#1a1a1a",
          }, {
            background: "#f8fafc",
            padding: { desktop: { top: 24, right: 24, bottom: 24, left: 24, unit: "px" } },
            border: { width: 1, style: "solid", color: "#e2e8f0", radius: 12 },
          }),
        ],
      ],
      {
        background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)",
        padding: { desktop: { top: 80, right: 20, bottom: 80, left: 20, unit: "px" } },
      },
    ),
  ],
};

/** Menu + ticker + hero — páginas estilo site. */
const landingNavHeroTemplate: TemplateDefinition = {
  id: "landing-nav-hero",
  name: "Landing — menu + ticker + hero",
  category: "landing",
  description: "Faixa animada, menu horizontal e bloco hero — bom para marca e ofertas",
  thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "ticker",
            {
              items: ["Envio seguro em todo o país", "Suporte dedicado", "Garantia de satisfação"],
              speed: 30,
              bg: "#f1f5f9",
              color: "#334155",
            },
            { margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } } },
          ),
        ],
      ],
      {
        background: "#f8fafc",
        padding: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
      },
    ),
    s(
      [
        [
          w(
            "navMenu",
            {
              align: "center",
              gap: 28,
              items: [
                { id: id("nav_"), label: "Início", href: "#" },
                { id: id("nav_"), label: "Solução", href: "#solucao" },
                { id: id("nav_"), label: "Preços", href: "#precos" },
                { id: id("nav_"), label: "Contacto", href: "#contato" },
              ],
            },
            {},
          ),
        ],
      ],
      {
        background: "#ffffff",
        padding: { desktop: { top: 12, right: 20, bottom: 12, left: 20, unit: "px" } },
      },
    ),
    s(
      [
        [
          w(
            "heading",
            { text: "A solução que o seu negócio precisava", tag: "h1" },
            {
              typography: {
                desktop: {
                  fontSize: 48,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: -0.5,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<p>Apresente o benefício principal em duas linhas. Substitua por texto da sua oferta e ligue o botão ao link público da presell.</p>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 19,
                  fontWeight: 400,
                  lineHeight: 1.65,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#475569",
              margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } },
            },
          ),
          w(
            "button",
            { text: "Quero começar →", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 17,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#e63946",
              padding: { desktop: { top: 16, right: 32, bottom: 16, left: 32, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 10 },
              align: { desktop: "center" },
            },
          ),
        ],
      ],
      {
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        padding: { desktop: { top: 72, right: 24, bottom: 88, left: 24, unit: "px" } },
      },
    ),
  ],
};

/** Três colunas com caixas de informação — prova social leve. */
const presellInfoTrioTemplate: TemplateDefinition = {
  id: "presell-info-trio",
  name: "Presell — 3 benefícios (info box)",
  category: "presell",
  description: "Três argumentos em colunas + headline — ideal para aquecimento",
  thumbnail: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "heading",
            { text: "Por que milhares escolhem esta solução", tag: "h2" },
            {
              typography: {
                desktop: {
                  fontSize: 36,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: -0.3,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 40, left: 0, unit: "px" } },
            },
          ),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 56, right: 20, bottom: 16, left: 20, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "infoBox",
            {
              iconName: "zap",
              title: "Resultados rápidos",
              description: "Comece a ver mudanças em poucos dias, sem complicar o seu dia a dia.",
              ctaText: "",
              layout: "stacked",
              align: "center",
            },
            { padding: { desktop: { top: 16, right: 12, bottom: 16, left: 12, unit: "px" } } },
          ),
        ],
        [
          w(
            "infoBox",
            {
              iconName: "shield",
              title: "Compra segura",
              description: "Processo transparente e suporte quando precisar de ajuda.",
              ctaText: "",
              layout: "stacked",
              align: "center",
            },
            { padding: { desktop: { top: 16, right: 12, bottom: 16, left: 12, unit: "px" } } },
          ),
        ],
        [
          w(
            "infoBox",
            {
              iconName: "heart",
              title: "Recomendado por quem usa",
              description: "Histórias reais de quem já aplicou o método com sucesso.",
              ctaText: "",
              layout: "stacked",
              align: "center",
            },
            { padding: { desktop: { top: 16, right: 12, bottom: 16, left: 12, unit: "px" } } },
          ),
        ],
      ],
      {
        background: "#f8fafc",
        padding: { desktop: { top: 24, right: 20, bottom: 56, left: 20, unit: "px" } },
      },
    ),
    s(
      [
        [
          w(
            "button",
            { text: "Quero saber mais →", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#16a34a",
              padding: { desktop: { top: 18, right: 40, bottom: 18, left: 40, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 8 },
              align: { desktop: "center" },
            },
          ),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 24, right: 20, bottom: 64, left: 20, unit: "px" } } },
    ),
  ],
};

/** Contagem + alerta + CTA — webinars e lançamentos. */
const leadWebinarTemplate: TemplateDefinition = {
  id: "lead-webinar",
  name: "Webinar / lançamento (urgência)",
  category: "lead",
  description: "Contagem regressiva, alerta e botão — reforça escassez de forma clara",
  thumbnail: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "alert",
            {
              variant: "warning",
              title: "Vagas limitadas",
              message: "<p>Ajuste a data no widget «Contagem» e o texto deste alerta ao seu evento.</p>",
              showIcon: true,
              dismissible: false,
            },
            { margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } } },
          ),
          w(
            "heading",
            { text: "Inscreva-se antes que as vagas esgotem", tag: "h1" },
            {
              typography: {
                desktop: {
                  fontSize: 38,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: -0.3,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w(
            "countdown",
            {
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              showLabels: true,
              showDays: true,
            },
            { margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } }, align: { desktop: "center" } },
          ),
          w(
            "text",
            {
              html: "<p>Explique o que o visitante vai ganhar ao participar. Use uma única promessa clara.</p>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 17,
                  fontWeight: 400,
                  lineHeight: 1.65,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#475569",
              margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } },
            },
          ),
          w(
            "button",
            { text: "Garantir a minha vaga", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#ea580c",
              padding: { desktop: { top: 18, right: 36, bottom: 18, left: 36, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 10 },
              align: { desktop: "center" },
            },
          ),
        ],
      ],
      {
        background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 55%)",
        padding: { desktop: { top: 56, right: 24, bottom: 72, left: 24, unit: "px" } },
      },
    ),
  ],
};

/** Vídeo + depoimentos + preço — página de oferta completa. */
const vslOfferStackTemplate: TemplateDefinition = {
  id: "vsl-offer-stack",
  name: "VSL + prova + preço",
  category: "vsl",
  description: "Vídeo, blocos de confiança e tabela de preços — fecho de oferta",
  thumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "heading",
            { text: "Assista ao vídeo e descubra como funciona", tag: "h2" },
            {
              typography: {
                desktop: {
                  fontSize: 32,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w("video", { provider: "youtube", url: "", controls: true }, {
            margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
          }),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 48, right: 20, bottom: 32, left: 20, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "testimonials",
            {
              items: [
                {
                  id: id("t_"),
                  name: "Cliente satisfeito",
                  role: "Comprador verificado",
                  avatar: "",
                  quote: "Substitua por um depoimento real da sua audiência.",
                  rating: 5,
                },
              ],
              autoplay: true,
              intervalMs: 6000,
            },
            {},
          ),
        ],
      ],
      { background: "#f8fafc", padding: { desktop: { top: 40, right: 20, bottom: 40, left: 20, unit: "px" } } },
    ),
    s(
      [
        [
          w("priceTable", {}, {}),
          w(
            "button",
            { text: "Comprar agora — melhor oferta", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#16a34a",
              padding: { desktop: { top: 18, right: 40, bottom: 18, left: 40, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 8 },
              align: { desktop: "center" },
              margin: { desktop: { top: 24, right: 0, bottom: 0, left: 0, unit: "px" } },
            },
          ),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 32, right: 20, bottom: 64, left: 20, unit: "px" } } },
    ),
  ],
};

/** Landing escura tipo SaaS B2B: hero, métricas, lista de valor, FAQ e CTA final. */
const landingProDarkTemplate: TemplateDefinition = {
  id: "landing-pro-dark",
  name: "Landing — SaaS profissional (escuro)",
  category: "landing",
  description: "Hero em gradiente escuro, números de confiança, benefícios e FAQ — ideal para software e serviços",
  thumbnail: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "heading",
            { text: "A plataforma que equipas de vendas usam para fechar mais rápido", tag: "h1" },
            {
              typography: {
                desktop: {
                  fontSize: 46,
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: -0.5,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#f8fafc",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<p>Automatize follow-ups, veja métricas em tempo real e mantenha o CRM alinhado com a equipa — sem folhas de cálculo nem ferramentas desligadas.</p>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 18,
                  fontWeight: 400,
                  lineHeight: 1.65,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#94a3b8",
              margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
            },
          ),
          w(
            "button",
            { text: "Pedir demonstração", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              background: "#38bdf8",
              padding: { desktop: { top: 16, right: 32, bottom: 16, left: 32, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 10 },
              align: { desktop: "center" },
            },
          ),
        ],
      ],
      {
        background: "linear-gradient(165deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)",
        padding: { desktop: { top: 88, right: 24, bottom: 88, left: 24, unit: "px" } },
      },
    ),
    s(
      [
        [
          w(
            "heading",
            { text: "+40%", tag: "h3" },
            {
              typography: {
                desktop: {
                  fontSize: 36,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            { html: "<p style='text-align:center'>Taxa de resposta em campanhas outbound (média dos clientes).</p>" },
            {
              typography: {
                desktop: {
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#64748b",
            },
          ),
        ],
        [
          w(
            "heading",
            { text: "24/7", tag: "h3" },
            {
              typography: {
                desktop: {
                  fontSize: 36,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            { html: "<p style='text-align:center'>Sincronização e alertas para não perder oportunidades.</p>" },
            {
              typography: {
                desktop: {
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#64748b",
            },
          ),
        ],
        [
          w(
            "heading",
            { text: "ISO-ready", tag: "h3" },
            {
              typography: {
                desktop: {
                  fontSize: 36,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            { html: "<p style='text-align:center'>Controlo de acessos, registo de atividade e backups.</p>" },
            {
              typography: {
                desktop: {
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#64748b",
            },
          ),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 56, right: 20, bottom: 56, left: 20, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "heading",
            { text: "Por que equipas mudam para esta solução", tag: "h2" },
            {
              typography: {
                desktop: {
                  fontSize: 32,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: -0.3,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } },
            },
          ),
          w(
            "iconList",
            {
              items: [
                {
                  id: id("il_"),
                  iconName: "workflow",
                  title: "Fluxos claros",
                  description: "<p>Defina etapas, responsáveis e prazos num só sítio — menos reuniões de alinhamento.</p>",
                  href: "",
                },
                {
                  id: id("il_"),
                  iconName: "chartColumn",
                  title: "Relatórios acionáveis",
                  description: "<p>Veja conversão por canal e ajuste mensagens com base em dados, não em suposições.</p>",
                  href: "",
                },
                {
                  id: id("il_"),
                  iconName: "plug",
                  title: "Integrações",
                  description: "<p>Ligue e-mail, calendário e ferramentas que a equipa já usa no dia a dia.</p>",
                  href: "",
                },
                {
                  id: id("il_"),
                  iconName: "headphones",
                  title: "Onboarding guiado",
                  description: "<p>Templates e suporte para colocar a equipa operacional em poucos dias.</p>",
                  href: "",
                },
              ],
              iconSize: 24,
              iconColor: "#0284c7",
              gap: 20,
              titleColor: "#0f172a",
              descColor: "#64748b",
            },
            {},
          ),
        ],
      ],
      { background: "#f8fafc", padding: { desktop: { top: 64, right: 24, bottom: 64, left: 24, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "heading",
            { text: "Perguntas frequentes", tag: "h2" },
            {
              typography: {
                desktop: {
                  fontSize: 30,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#f8fafc",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w(
            "faq",
            {
              items: [
                {
                  id: id("q_"),
                  question: "Há período experimental?",
                  answer: "<p>Sim — pode testar com a sua equipa antes de comprometer um plano anual. Ajuste os textos à sua política real.</p>",
                },
                {
                  id: id("q_"),
                  question: "Os dados ficam na UE?",
                  answer: "<p>Configure a cópia conforme a sua infraestrutura e requisitos de compliance (RGPD, etc.).</p>",
                },
                {
                  id: id("q_"),
                  question: "Como é o suporte?",
                  answer: "<p>Chat, e-mail e documentação. Planos superiores incluem tempo de resposta acordado.</p>",
                },
              ],
              allowMultiple: false,
              defaultOpen: 0,
              itemBg: "#1e293b",
              itemBorderColor: "#334155",
              questionColor: "#f1f5f9",
              answerColor: "#94a3b8",
              accentColor: "#38bdf8",
            },
            {},
          ),
        ],
      ],
      { background: "#0f172a", padding: { desktop: { top: 56, right: 24, bottom: 56, left: 24, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "ctaBox",
            {
              title: "Veja a plataforma com o seu próprio fluxo",
              description: "Agende uma sessão de 20 minutos. Sem compromisso — mostramos o que faz sentido para o tamanho da sua equipa.",
              primaryText: "Agendar conversa",
              primaryHref: "#",
              secondaryText: "Ver preços",
              secondaryHref: "#precos",
              layout: "centered",
              background: "#0c4a6e",
              gradient: "linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)",
              textColor: "#ffffff",
              primaryBg: "#f8fafc",
              primaryColor: "#0f172a",
              borderRadius: 16,
              imageUrl: "",
            },
            {},
          ),
        ],
      ],
      { background: "#e0f2fe", padding: { desktop: { top: 48, right: 20, bottom: 72, left: 20, unit: "px" } } },
    ),
  ],
};

/** Landing com título dinâmico, separação por tabs e prova social. */
const landingMotionTabsTemplate: TemplateDefinition = {
  id: "landing-motion-tabs",
  name: "Landing — título dinâmico + tabs",
  category: "landing",
  description: "Headline animada, conteúdo em separadores e depoimentos — forte para agências e infoprodutos",
  thumbnail: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "animatedHeadline",
            {
              prefix: "Construa uma presença digital",
              rotatingWords: ["consistente", "escalável", "mensurável"],
              suffix: "com a mesma equipa.",
              animation: "fade",
              intervalMs: 2400,
              tag: "h1",
              highlightColor: "#ea580c",
            },
            {
              typography: {
                desktop: {
                  fontSize: 42,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: -0.4,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<p style='text-align:center'>Substitua por uma promessa única e ligue os botões ao teu funil ou calendário.</p>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 18,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#475569",
              margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } },
            },
          ),
          w(
            "button",
            { text: "Falar connosco", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#ea580c",
              padding: { desktop: { top: 16, right: 28, bottom: 16, left: 28, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 10 },
              align: { desktop: "center" },
            },
          ),
        ],
      ],
      {
        background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)",
        padding: { desktop: { top: 72, right: 24, bottom: 56, left: 24, unit: "px" } },
      },
    ),
    s(
      [
        [
          w(
            "tabs",
            {
              tabs: [
                {
                  id: id("tab_"),
                  label: "Estratégia",
                  html: "<p>Defina posicionamento, oferta principal e mensagens-chave antes de investir em tráfego.</p>",
                },
                {
                  id: id("tab_"),
                  label: "Execução",
                  html: "<p>Páginas, criativos e automações alinhados — menos retrabalho entre equipas.</p>",
                },
                {
                  id: id("tab_"),
                  label: "Otimização",
                  html: "<p>Testes A/B, heatmaps e relatórios para melhorar conversão mês a mês.</p>",
                },
              ],
              tabBg: "#f1f5f9",
              tabActiveBg: "#ffffff",
              tabTextColor: "#64748b",
              tabActiveTextColor: "#0f172a",
              accentColor: "#ea580c",
              panelBg: "#ffffff",
              panelTextColor: "#334155",
              borderColor: "#e2e8f0",
              borderRadius: 14,
            },
            {},
          ),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 24, right: 24, bottom: 48, left: 24, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "heading",
            { text: "Equipas que confiam neste tipo de abordagem", tag: "h2" },
            {
              typography: {
                desktop: {
                  fontSize: 28,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w(
            "testimonials",
            {
              items: [
                {
                  id: id("t_"),
                  name: "Mariana Duarte",
                  role: "Head de Growth",
                  avatar: "",
                  quote: "Passámos de campanhas desencontradas a um funil único — as conversões subiram em seis semanas.",
                  rating: 5,
                },
                {
                  id: id("t_"),
                  name: "Ricardo Pinto",
                  role: "Fundador, Loja X",
                  avatar: "",
                  quote: "Finalmente uma página que reflete a marca e não só o produto. Menos bounce, mais leads qualificados.",
                  rating: 5,
                },
                {
                  id: id("t_"),
                  name: "Sofia Almeida",
                  role: "Diretora Comercial",
                  avatar: "",
                  quote: "O processo foi claro: wireframe, copy e lançamento sem surpresas no orçamento.",
                  rating: 5,
                },
              ],
              autoplay: true,
              intervalMs: 5500,
              showStars: true,
              showAvatars: true,
              cardBg: "#ffffff",
              textColor: "#1e293b",
              accentColor: "#f59e0b",
            },
            {},
          ),
          w(
            "socialIcons",
            {
              items: [
                { id: id("soc_"), network: "linkedin", url: "#" },
                { id: id("soc_"), network: "instagram", url: "#" },
                { id: id("soc_"), network: "youtube", url: "#" },
              ],
              iconSize: 22,
              gap: 18,
              variant: "filled",
              iconBg: "#0f172a",
              iconColor: "#ffffff",
            },
            { margin: { desktop: { top: 28, right: 0, bottom: 0, left: 0, unit: "px" } } },
          ),
        ],
      ],
      { background: "#f1f5f9", padding: { desktop: { top: 48, right: 24, bottom: 64, left: 24, unit: "px" } } },
    ),
  ],
};

/** Presell longa com prova, lista de benefícios e FAQ antes do CTA. */
const presellAuthorityTemplate: TemplateDefinition = {
  id: "presell-authority",
  name: "Presell — autoridade + FAQ",
  category: "presell",
  description: "Alerta de escassez, história, imagem, benefícios em lista e perguntas frequentes",
  thumbnail: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "alert",
            {
              variant: "info",
              title: "Leitura de 3 minutos",
              message: "<p>Esta estrutura combina urgência leve com conteúdo denso. Ajuste datas e números ao teu caso real.</p>",
              showIcon: true,
              dismissible: false,
            },
            { margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } } },
          ),
          w(
            "heading",
            {
              text: "O que mudou no mercado (e por que ignorar isto pode custar-te vendas)",
              tag: "h1",
            },
            {
              typography: {
                desktop: {
                  fontSize: 40,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: -0.4,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<p>Os anúncios ficaram mais caros e as plataformas mais exigentes com destinos genéricos. Uma página intermédia bem feita aumenta a qualidade do tráfego e explica a oferta antes do clique final.</p>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 17,
                  fontWeight: 400,
                  lineHeight: 1.75,
                  letterSpacing: 0,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#334155",
              margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } },
            },
          ),
          w(
            "image",
            {
              src: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&q=80",
              alt: "Equipa a trabalhar",
            },
            {
              align: { desktop: "center" },
              width: { desktop: "100%" },
              margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 12 },
            },
          ),
          w(
            "iconList",
            {
              items: [
                {
                  id: id("il_"),
                  iconName: "check",
                  title: "Mensagem alinhada ao anúncio",
                  description: "<p>Reduz discrepâncias que geram reprovações ou baixa qualidade.</p>",
                  href: "",
                },
                {
                  id: id("il_"),
                  iconName: "check",
                  title: "Prova e contexto",
                  description: "<p>Visitante entende o problema antes de ver o preço na página do produtor.</p>",
                  href: "",
                },
                {
                  id: id("il_"),
                  iconName: "check",
                  title: "Um único CTA claro",
                  description: "<p>Menos fricção: uma ação principal por ecrã.</p>",
                  href: "",
                },
              ],
              iconSize: 22,
              iconColor: "#16a34a",
              gap: 14,
              titleColor: "#0f172a",
              descColor: "#64748b",
            },
            { margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } } },
          ),
          w(
            "faq",
            {
              items: [
                {
                  id: id("q_"),
                  question: "Isto substitui a página oficial da oferta?",
                  answer: "<p>Não — complementa. O visitante lê a tua página e só depois segue para o link de afiliado ou checkout.</p>",
                },
                {
                  id: id("q_"),
                  question: "Preciso de domínio próprio?",
                  answer: "<p>Podes usar o domínio da plataforma enquanto validas; depois migra para o teu domínio para reforçar confiança.</p>",
                },
              ],
              allowMultiple: true,
              defaultOpen: -1,
              itemBg: "#ffffff",
              itemBorderColor: "#e2e8f0",
              questionColor: "#0f172a",
              answerColor: "#64748b",
              accentColor: "#16a34a",
            },
            {},
          ),
          w(
            "button",
            { text: "Ver a oferta no site oficial →", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#16a34a",
              padding: { desktop: { top: 18, right: 36, bottom: 18, left: 36, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 10 },
              align: { desktop: "center" },
              margin: { desktop: { top: 28, right: 0, bottom: 0, left: 0, unit: "px" } },
            },
          ),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 48, right: 24, bottom: 64, left: 24, unit: "px" } } },
    ),
  ],
};

/** Comparativo em duas colunas + CTA — aquecimento direto. */
const presellComparisonTemplate: TemplateDefinition = {
  id: "presell-antes-depois",
  name: "Presell — comparativo (2 colunas)",
  category: "presell",
  description: "Lado a lado «sem» vs «com» a tua solução, ideal para destacar a transformação",
  thumbnail: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "heading",
            { text: "O que muda quando aplicas o método", tag: "h2" },
            {
              typography: {
                desktop: {
                  fontSize: 34,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: -0.3,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 32, left: 0, unit: "px" } },
            },
          ),
        ],
      ],
      { background: "#fafafa", padding: { desktop: { top: 48, right: 20, bottom: 16, left: 20, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "heading",
            { text: "Sem o sistema", tag: "h3" },
            {
              typography: {
                desktop: {
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: 0,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#991b1b",
              margin: { desktop: { top: 0, right: 0, bottom: 12, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<ul style='margin:0;padding-left:20px;color:#475569;line-height:1.7'><li>Decisões ao acaso</li><li>Tempo perdido em tarefas repetitivas</li><li>Resultados inconsistentes mês a mês</li></ul>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 15,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  letterSpacing: 0,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#475569",
            },
          ),
        ],
        [
          w(
            "heading",
            { text: "Com o sistema", tag: "h3" },
            {
              typography: {
                desktop: {
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: 0,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#166534",
              margin: { desktop: { top: 0, right: 0, bottom: 12, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<ul style='margin:0;padding-left:20px;color:#475569;line-height:1.7'><li>Passos claros e mensuráveis</li><li>Automação do que não exige criatividade</li><li>Previsibilidade e revisão semanal</li></ul>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 15,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  letterSpacing: 0,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#475569",
            },
          ),
        ],
      ],
      {
        background: "#ffffff",
        padding: { desktop: { top: 24, right: 24, bottom: 40, left: 24, unit: "px" } },
      },
    ),
    s(
      [
        [
          w("divider", { style: "solid", weight: 1 }, {}),
          w(
            "text",
            {
              html: "<p style='text-align:center;font-size:15px;color:#64748b'>Substitui as listas por números reais da tua audiência (tempo poupado, % de melhoria, etc.).</p>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 15,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#64748b",
              margin: { desktop: { top: 16, right: 0, bottom: 24, left: 0, unit: "px" } },
            },
          ),
          w(
            "button",
            { text: "Quero essa transformação →", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 17,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#16a34a",
              padding: { desktop: { top: 16, right: 36, bottom: 16, left: 36, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 8 },
              align: { desktop: "center" },
            },
          ),
        ],
      ],
      { background: "#fafafa", padding: { desktop: { top: 8, right: 20, bottom: 56, left: 20, unit: "px" } } },
    ),
  ],
};

/** VSL com cópia à esquerda e vídeo à direita (desktop). */
const vslSplitHeroTemplate: TemplateDefinition = {
  id: "vsl-split-hero",
  name: "VSL — vídeo + cópia (2 colunas)",
  category: "vsl",
  description: "Headline e bullets ao lado do vídeo — bom para explicar a promessa antes de carregar o player",
  thumbnail: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "heading",
            { text: "Em 12 minutos vês o método completo (sem enrolação)", tag: "h1" },
            {
              typography: {
                desktop: {
                  fontSize: 32,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: -0.3,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<p>No vídeo: o erro que 90% comete no primeiro passo, o framework em 3 fases e o que fazer ainda esta semana.</p><ul style='margin:16px 0 0;padding-left:20px;line-height:1.65;color:#475569'><li>Sem ferramentas caras</li><li>Adaptável ao teu ritmo</li><li>Passo a passo na descrição abaixo do player</li></ul>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: 1.65,
                  letterSpacing: 0,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#475569",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w(
            "alert",
            {
              variant: "warning",
              title: "Dica",
              message: "<p>Cola o URL do YouTube ou Bunny no widget de vídeo e ajusta o texto ao teu nicho.</p>",
              showIcon: true,
              dismissible: false,
            },
            {},
          ),
        ],
        [
          w("video", { provider: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", controls: true }, {
            margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
          }),
          w(
            "button",
            { text: "Continuar para a oferta →", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              background: "#facc15",
              padding: { desktop: { top: 14, right: 28, bottom: 14, left: 28, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 8 },
              align: { desktop: "center" },
            },
          ),
        ],
      ],
      {
        background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
        padding: { desktop: { top: 56, right: 24, bottom: 64, left: 24, unit: "px" } },
      },
    ),
  ],
};

/** Funil VSL: vídeo, depoimentos, FAQ e fecho com preço. */
const vslFullFunnelTemplate: TemplateDefinition = {
  id: "vsl-full-funnel",
  name: "VSL — funil completo (vídeo + prova + FAQ + preço)",
  category: "vsl",
  description: "Sequência clássica de oferta: prova social, dúvidas e tabela de preços antes do checkout",
  thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "heading",
            { text: "Assiste até ao minuto 8 — é onde revelamos o bónus", tag: "h2" },
            {
              typography: {
                desktop: {
                  fontSize: 28,
                  fontWeight: 800,
                  lineHeight: 1.25,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#f8fafc",
              margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
            },
          ),
          w("video", { provider: "youtube", url: "", controls: true }, {
            margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
          }),
        ],
      ],
      { background: "#020617", padding: { desktop: { top: 48, right: 20, bottom: 48, left: 20, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "testimonials",
            {
              items: [
                {
                  id: id("t_"),
                  name: "Cliente A",
                  role: "Verificado",
                  avatar: "",
                  quote: "Substitui por screenshot ou métrica real quando tiveres permissão.",
                  rating: 5,
                },
                {
                  id: id("t_"),
                  name: "Cliente B",
                  role: "Verificado",
                  avatar: "",
                  quote: "Segundo depoimento curto — foco no resultado, não no elogio genérico.",
                  rating: 5,
                },
              ],
              autoplay: false,
              intervalMs: 8000,
              showStars: true,
              showAvatars: false,
              cardBg: "#ffffff",
              textColor: "#1e293b",
              accentColor: "#eab308",
            },
            {},
          ),
        ],
      ],
      { background: "#f1f5f9", padding: { desktop: { top: 40, right: 24, bottom: 40, left: 24, unit: "px" } } },
    ),
    s(
      [
        [
          w(
            "faq",
            {
              items: [
                {
                  id: id("q_"),
                  question: "Funciona para iniciantes?",
                  answer: "<p>Sim — adapta o texto ao nível da tua audiência e mostra o suporte disponível.</p>",
                },
                {
                  id: id("q_"),
                  question: "Há garantia?",
                  answer: "<p>Indica a política exacta (dias, reembolso, como pedir). Transparência aumenta conversão.</p>",
                },
                {
                  id: id("q_"),
                  question: "Quando recebo o acesso?",
                  answer: "<p>Descreve o envio imediato por e-mail ou o prazo de onboarding.</p>",
                },
              ],
              allowMultiple: false,
              defaultOpen: 0,
              itemBg: "#ffffff",
              itemBorderColor: "#e2e8f0",
              questionColor: "#0f172a",
              answerColor: "#64748b",
              accentColor: "#ca8a04",
            },
            {},
          ),
        ],
      ],
      { background: "#ffffff", padding: { desktop: { top: 40, right: 24, bottom: 32, left: 24, unit: "px" } } },
    ),
    s(
      [
        [
          w("priceTable", {}, {}),
          w(
            "button",
            { text: "Comprar com garantia", href: "#" },
            {
              typography: {
                desktop: {
                  fontSize: 17,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textAlign: "center",
                  textTransform: "none",
                },
              },
              color: "#ffffff",
              background: "#ca8a04",
              padding: { desktop: { top: 16, right: 40, bottom: 16, left: 40, unit: "px" } },
              border: { width: 0, style: "solid", color: "#000", radius: 10 },
              align: { desktop: "center" },
              margin: { desktop: { top: 20, right: 0, bottom: 0, left: 0, unit: "px" } },
            },
          ),
        ],
      ],
      { background: "#fffbeb", padding: { desktop: { top: 40, right: 24, bottom: 64, left: 24, unit: "px" } } },
    ),
  ],
};

/** Captura com coluna de confiança e formulário destacado. */
const leadTrustSplitTemplate: TemplateDefinition = {
  id: "lead-trust-split",
  name: "Leads — prova + formulário (2 colunas)",
  category: "lead",
  description: "Checklist de confiança ao lado do formulário — forte para ebooks, webinars e demos",
  thumbnail: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=80",
  build: () => [
    s(
      [
        [
          w(
            "heading",
            { text: "Recebe o kit em PDF + acesso à área de membros", tag: "h1" },
            {
              typography: {
                desktop: {
                  fontSize: 36,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: -0.4,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#0f172a",
              margin: { desktop: { top: 0, right: 0, bottom: 12, left: 0, unit: "px" } },
            },
          ),
          w(
            "text",
            {
              html: "<p>Sem spam. Usamos o e-mail só para enviar o material e avisos da série (podes sair a qualquer momento).</p>",
            },
            {
              typography: {
                desktop: {
                  fontSize: 15,
                  fontWeight: 400,
                  lineHeight: 1.65,
                  letterSpacing: 0,
                  textAlign: "left",
                  textTransform: "none",
                },
              },
              color: "#64748b",
              margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } },
            },
          ),
          w(
            "iconList",
            {
              items: [
                {
                  id: id("il_"),
                  iconName: "lock",
                  title: "Dados protegidos",
                  description: "<p>Formulário com validação e envio por webhook configurável.</p>",
                  href: "",
                },
                {
                  id: id("il_"),
                  iconName: "mail",
                  title: "Entrega imediata",
                  description: "<p>Ajusta a mensagem de sucesso ao teu fluxo (e-mail, WhatsApp, etc.).</p>",
                  href: "",
                },
                {
                  id: id("il_"),
                  iconName: "badgeCheck",
                  title: "Conteúdo atualizado",
                  description: "<p>Indica a cadência de atualização do recurso que estás a oferecer.</p>",
                  href: "",
                },
              ],
              iconSize: 22,
              iconColor: "#4f46e5",
              gap: 14,
              titleColor: "#0f172a",
              descColor: "#64748b",
            },
            {},
          ),
        ],
        [
          w(
            "form",
            {
              fields: [
                { id: id("f_"), type: "text", name: "name", label: "Nome", placeholder: "O teu nome", required: true },
                {
                  id: id("f_"),
                  type: "email",
                  name: "email",
                  label: "E-mail profissional",
                  placeholder: "nome@empresa.com",
                  required: true,
                },
                {
                  id: id("f_"),
                  type: "text",
                  name: "company",
                  label: "Empresa (opcional)",
                  placeholder: "Empresa ou projeto",
                  required: false,
                },
              ],
              submitText: "Quero receber o kit",
              successMessage: "Verifica o e-mail — enviámos o link de acesso.",
              webhookUrl: "",
              fieldGap: 14,
              buttonBg: "#4f46e5",
              buttonColor: "#ffffff",
              buttonRadius: 10,
              inputBg: "#ffffff",
              inputBorderColor: "#cbd5e1",
              inputRadius: 8,
              labelColor: "#0f172a",
            },
            {
              background: "#ffffff",
              padding: { desktop: { top: 28, right: 28, bottom: 28, left: 28, unit: "px" } },
              border: { width: 1, style: "solid", color: "#e2e8f0", radius: 16 },
              boxShadow: "0 20px 40px -12px rgba(15, 23, 42, 0.15)",
            },
          ),
        ],
      ],
      {
        background: "linear-gradient(160deg, #eef2ff 0%, #ffffff 55%)",
        padding: { desktop: { top: 72, right: 24, bottom: 80, left: 24, unit: "px" } },
      },
    ),
  ],
};

export const TEMPLATES: TemplateDefinition[] = [
  landingPageTemplate,
  landingNavHeroTemplate,
  landingProDarkTemplate,
  landingMotionTabsTemplate,
  presellTemplate,
  presellInfoTrioTemplate,
  presellAuthorityTemplate,
  presellComparisonTemplate,
  vslTemplate,
  vslOfferStackTemplate,
  vslSplitHeroTemplate,
  vslFullFunnelTemplate,
  leadCaptureTemplate,
  leadWebinarTemplate,
  leadTrustSplitTemplate,
];

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateDefinition["category"]; label: string }> = [
  { id: "landing", label: "Landing Page" },
  { id: "presell", label: "Presell" },
  { id: "vsl", label: "VSL" },
  { id: "lead", label: "Captura de Leads" },
];

/** Build a complete page document from a template. */
export function buildPageFromTemplate(template: TemplateDefinition): PageDocument["sections"] {
  return template.build();
}
