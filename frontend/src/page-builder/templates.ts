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

export const TEMPLATES: TemplateDefinition[] = [
  landingPageTemplate,
  landingNavHeroTemplate,
  presellTemplate,
  presellInfoTrioTemplate,
  vslTemplate,
  vslOfferStackTemplate,
  leadCaptureTemplate,
  leadWebinarTemplate,
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
