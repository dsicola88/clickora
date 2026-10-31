/**
 * Landing DClickora — Navy / azul (mock SaaS).
 * Aplicável em Temas e modelos no admin (page builder de vendas)
 * e no editor manual de presell do afiliado.
 */
import type { PageDocument, SectionNode, WidgetNode } from "./types";
import { createColumn, createEmptyPage, createSection, createWidget, id } from "./factory";

export const DCLICKORA_NAVY_SAAS_THEME_ID = "dclickora-navy-saas";

const NAVY = "#060d21";
const NAVY_CARD = "#0d172b";
const ACCENT = "#0088ff";
const ACCENT_SOFT = "rgba(0,136,255,0.22)";
const WHITE = "#ffffff";
const MUTED = "#94a3b8";
const HERO_IMG = "/landing/hero-default.png";
const BRAND_IMG = "/brand-dclickora.png";

type Align = "left" | "center" | "right";

function typo(
  partial: Partial<{
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: number;
    textAlign: Align;
    textTransform: "none" | "uppercase";
  }>,
) {
  return {
    desktop: {
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0,
      textAlign: "left" as Align,
      textTransform: "none" as const,
      fontStyle: "normal" as const,
      textDecoration: "none" as const,
      wordSpacing: 0,
      ...partial,
    },
  };
}

function withEffects(
  widget: WidgetNode,
  effects: NonNullable<WidgetNode["effects"]>,
): WidgetNode {
  widget.effects = { ...widget.effects, ...effects };
  return widget;
}

function pad(top: number, right: number, bottom: number, left: number) {
  return { desktop: { top, right, bottom, left, unit: "px" as const } };
}

function section(
  columnsWidgets: WidgetNode[][],
  styles: SectionNode["styles"],
  columnWidths?: number[],
  layout: SectionNode["layout"] = "boxed",
): SectionNode {
  const sec = createSection(columnsWidgets.length);
  sec.layout = layout;
  sec.styles = { ...sec.styles, ...styles };
  const n = columnsWidgets.length;
  sec.columns = columnsWidgets.map((widgets, i) => {
    const pct = columnWidths?.[i] ?? (n > 0 ? Math.floor(100 / n) : 100);
    const col = createColumn(pct);
    col.widgets = widgets;
    col.widthPercent = { desktop: pct, tablet: n > 1 ? 100 : pct, mobile: 100 };
    return col;
  });
  return sec;
}

function heading(
  text: string,
  tag: "h1" | "h2" | "h3",
  styles: WidgetNode["styles"],
): WidgetNode {
  const w = createWidget("heading");
  w.content = { ...(w.content as object), text, tag };
  w.styles = { ...w.styles, ...styles };
  return w;
}

function html(body: string, styles: WidgetNode["styles"]): WidgetNode {
  const w = createWidget("text");
  w.content = { ...(w.content as object), html: body };
  w.styles = { ...w.styles, ...styles };
  return w;
}

function button(
  text: string,
  href: string,
  variant: "primary" | "ghost" | "outline-light",
): WidgetNode {
  const w = createWidget("button");
  w.content = { ...(w.content as object), text, href, target: "_self" };
  const primary = variant === "primary";
  const ghost = variant === "ghost";
  w.styles = {
    ...w.styles,
    color: primary ? WHITE : WHITE,
    background: primary ? ACCENT : "transparent",
    padding: pad(14, 26, 14, 26),
    border: {
      width: primary ? 0 : 1,
      style: "solid",
      color: ghost ? "transparent" : "rgba(255,255,255,0.35)",
      radius: 999,
    },
    typography: typo({
      fontSize: 14,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: 0.2,
      textAlign: "center",
    }),
    align: { desktop: "center" },
    margin: pad(0, 6, 0, 6),
  };
  withEffects(w, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 600,
    hoverTransform: "translateY(-2px)",
    hoverBoxShadow: primary ? `0 12px 28px ${ACCENT_SOFT}` : undefined,
    transitionDurationMs: 200,
  });
  return w;
}

function featureCol(icon: string, title: string, body: string): WidgetNode[] {
  const ic = createWidget("icon");
  ic.content = {
    ...(ic.content as object),
    name: icon,
    size: 22,
    shape: "circle",
    shapeBg: "rgba(0,136,255,0.15)",
  };
  ic.styles = {
    ...ic.styles,
    color: ACCENT,
    align: { desktop: "center" },
    margin: pad(0, 0, 14, 0),
  };
  const h = heading(title, "h3", {
    color: WHITE,
    typography: typo({ fontSize: 16, fontWeight: 700, lineHeight: 1.3, textAlign: "center" }),
    margin: pad(0, 0, 8, 0),
  });
  const t = html(`<p style="margin:0">${body}</p>`, {
    color: MUTED,
    typography: typo({ fontSize: 13, fontWeight: 400, lineHeight: 1.55, textAlign: "center" }),
  });
  return [ic, h, t];
}

function priceCard(opts: {
  badge?: string;
  title: string;
  subtitle: string;
  currency: string;
  price: string;
  period: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  highlighted: boolean;
}): WidgetNode {
  const w = createWidget("priceTable");
  w.content = {
    ...(w.content as object),
    badge: opts.badge ?? "",
    title: opts.title,
    subtitle: opts.subtitle,
    currency: opts.currency,
    price: opts.price,
    period: opts.period,
    features: opts.features.map((text) => ({
      id: id("pf_"),
      text,
      included: true,
    })),
    ctaText: opts.ctaText,
    ctaHref: opts.ctaHref,
    highlighted: opts.highlighted,
    cardBg: WHITE,
    textColor: "#0f172a",
    accentColor: ACCENT,
    ctaBg: opts.highlighted ? ACCENT : "#eff6ff",
    ctaColor: opts.highlighted ? WHITE : ACCENT,
    borderRadius: 16,
  };
  w.styles = {
    ...w.styles,
    padding: pad(8, 8, 8, 8),
  };
  withEffects(w, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 650,
  });
  return w;
}

function buildNav(): SectionNode {
  const logo = createWidget("image");
  logo.content = {
    ...(logo.content as object),
    src: BRAND_IMG,
    alt: "DClickora",
    link: "#",
  };
  logo.styles = {
    ...logo.styles,
    align: { desktop: "left" },
    width: { desktop: "148px", tablet: "132px", mobile: "120px" },
    margin: pad(0, 0, 0, 0),
  };

  const menu = createWidget("navMenu");
  menu.content = {
    ...(menu.content as object),
    align: "center",
    gap: 28,
    color: MUTED,
    hoverColor: WHITE,
    activeColor: ACCENT,
    fontSize: 14,
    fontWeight: 500,
    pointer: "underline",
    toggleColor: WHITE,
    stickyMode: "sticky",
    items: [
      { id: id("nav_"), label: "Funcionalidades", href: "#funcionalidades" },
      { id: id("nav_"), label: "Planos", href: "#planos" },
      { id: id("nav_"), label: "Perguntas Frequentes", href: "#faq" },
      { id: id("nav_"), label: "Suporte", href: "/auth" },
    ],
  };

  const entrar = button("Entrar", "/auth", "ghost");
  entrar.styles = {
    ...entrar.styles,
    color: MUTED,
    padding: pad(10, 16, 10, 16),
    margin: pad(0, 4, 0, 0),
    align: { desktop: "right" },
  };
  const start = button("Começar Grátis", "/auth", "primary");
  start.styles = {
    ...start.styles,
    padding: pad(10, 20, 10, 20),
    margin: pad(0, 0, 0, 4),
    align: { desktop: "right" },
  };

  return section(
    [[logo], [menu], [entrar, start]],
    {
      background: "rgba(6,13,33,0.92)",
      padding: pad(14, 28, 14, 28),
    },
    [22, 48, 30],
    "full",
  );
}

function buildHero(): SectionNode {
  const badge = html(
    `<p style="margin:0;display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid rgba(0,136,255,0.35);background:rgba(0,136,255,0.1);color:#7dd3fc;font-size:12px;font-weight:600;letter-spacing:0.02em">⚡ Plataforma para Afiliados e Media Buyers</p>`,
    {
      color: ACCENT,
      typography: typo({ fontSize: 12, fontWeight: 600, textAlign: "left" }),
      margin: pad(0, 0, 20, 0),
      align: { desktop: "left" },
    },
  );
  withEffects(badge, {
    entranceAnimation: "fadeIn",
    entranceTrigger: "load",
    entranceDurationMs: 500,
  });

  const title = heading("Da criação da presell ao acompanhamento das conversões.", "h1", {
    color: WHITE,
    typography: typo({
      fontSize: 40,
      fontWeight: 800,
      lineHeight: 1.12,
      letterSpacing: -0.6,
      textAlign: "left",
    }),
    margin: pad(0, 0, 8, 0),
  });
  withEffects(title, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "load",
    entranceDurationMs: 700,
  });

  const accentLine = heading("Tudo numa só plataforma.", "h2", {
    color: ACCENT,
    typography: typo({
      fontSize: 36,
      fontWeight: 800,
      lineHeight: 1.15,
      letterSpacing: -0.5,
      textAlign: "left",
    }),
    margin: pad(0, 0, 18, 0),
  });
  withEffects(accentLine, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "load",
    entranceDelayMs: 80,
    entranceDurationMs: 700,
  });

  const sub = html(
    `<p style="margin:0">Cria presells, acompanha cliques e regista conversões. Gerencia a tua operação de afiliado de forma simples e eficiente.</p>`,
    {
      color: MUTED,
      typography: typo({ fontSize: 16, fontWeight: 400, lineHeight: 1.65, textAlign: "left" }),
      margin: pad(0, 0, 24, 0),
    },
  );

  const cta1 = button("Começar Gratuitamente →", "/auth", "primary");
  cta1.styles = { ...cta1.styles, align: { desktop: "left" }, margin: pad(0, 0, 0, 0) };
  const cta2 = button("Falar com um Especialista", "/auth", "outline-light");
  cta2.styles = { ...cta2.styles, align: { desktop: "left" }, margin: pad(0, 0, 0, 0) };
  const ctaRow = createWidget("container");
  ctaRow.content = {
    ...(ctaRow.content as object),
    direction: "row",
    justify: "flex-start",
    align: "center",
    wrap: "wrap",
    gap: 12,
    widgets: [cta1, cta2],
  };
  ctaRow.styles = {
    ...ctaRow.styles,
    margin: pad(0, 0, 16, 0),
    width: { desktop: "100%" },
  };

  const trust = html(
    `<p style="margin:0;display:flex;align-items:center;gap:8px;color:#86efac;font-size:13px;font-weight:600"><span style="display:inline-flex;width:18px;height:18px;border-radius:999px;background:#22c55e;color:#052e16;align-items:center;justify-content:center;font-size:11px">✓</span> Sem cartão de crédito. Começa hoje.</p>`,
    {
      color: "#86efac",
      typography: typo({ fontSize: 13, fontWeight: 600, textAlign: "left" }),
      margin: pad(4, 0, 0, 0),
    },
  );

  const img = createWidget("image");
  img.content = {
    ...(img.content as object),
    src: HERO_IMG,
    alt: "Painel DClickora no portátil — visitas, cliques e conversões",
    link: "",
  };
  img.styles = {
    ...img.styles,
    align: { desktop: "center" },
    width: { desktop: "100%" },
    border: { width: 0, style: "solid", color: "#000", radius: 16 },
    boxShadow: `0 40px 80px -20px ${ACCENT_SOFT}, 0 0 0 1px rgba(0,136,255,0.12)`,
  };
  withEffects(img, {
    entranceAnimation: "fadeIn",
    entranceTrigger: "load",
    entranceDelayMs: 120,
    entranceDurationMs: 800,
  });

  return section(
    [[badge, title, accentLine, sub, ctaRow, trust], [img]],
    {
      background: `radial-gradient(ellipse 55% 50% at 78% 35%, ${ACCENT_SOFT} 0%, transparent 60%), linear-gradient(180deg, ${NAVY} 0%, #08122a 100%)`,
      padding: pad(56, 28, 48, 28),
    },
    [52, 48],
    "full",
  );
}

function buildFeatures(): SectionNode {
  const anchor = createWidget("menuAnchor");
  anchor.content = { ...(anchor.content as object), anchorId: "funcionalidades" };
  const cols = [
    featureCol("zap", "Uma só plataforma", "Presell, tracking e resultados no mesmo painel."),
    featureCol("shield", "Sem WordPress", "Publica sem alojamento, tema ou plugins."),
    featureCol("chart-column", "Tracking e Postback", "Do clique do anúncio à venda na rede."),
    featureCol("rocket", "Começa grátis", "Starter sem cartão. Escala quando precisares."),
  ];
  cols[0] = [anchor, ...cols[0]];
  return section(
    cols,
    {
      background: NAVY,
      padding: pad(28, 24, 48, 24),
    },
    undefined,
    "boxed",
  );
}

function buildHowIntro(): SectionNode {
  const title = heading("Da campanha à conversão. Tudo conectado.", "h2", {
    color: WHITE,
    typography: typo({
      fontSize: 30,
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: -0.3,
      textAlign: "center",
    }),
  });
  withEffects(title, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 650,
  });
  return section(
    [[title]],
    {
      background: NAVY,
      padding: pad(24, 24, 8, 24),
    },
  );
}

function stepInfoBox(n: string, icon: string, title: string, body: string): WidgetNode {
  const box = createWidget("infoBox");
  box.content = {
    ...(box.content as object),
    iconName: icon,
    iconColor: ACCENT,
    iconBg: "rgba(0,136,255,0.14)",
    iconShape: "circle",
    title: `${n}. ${title}`,
    description: body,
    ctaText: "",
    ctaHref: "#",
    layout: "stacked",
    align: "center",
    titleColor: WHITE,
    descColor: MUTED,
    ctaColor: ACCENT,
    bg: NAVY_CARD,
    borderRadius: 16,
  };
  box.styles = {
    ...box.styles,
    border: { width: 1, style: "solid", color: "rgba(0,136,255,0.2)", radius: 16 },
    padding: pad(28, 20, 28, 20),
    margin: pad(8, 8, 8, 8),
  };
  withEffects(box, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 650,
  });
  return box;
}

function buildHowSteps(): SectionNode {
  return section(
    [
      [stepInfoBox("1", "layout-template", "Cria a tua presell", "Editor visual com blocos, CTAs e oferta — sem código.")],
      [stepInfoBox("2", "send", "Publica e divulga", "Link /p/uuid ou domínio próprio. Liga o anúncio com UTM/GCLID.")],
      [
        stepInfoBox(
          "3",
          "chart-column",
          "Acompanha os resultados",
          "Cliques, conversões e postback das redes no mesmo sítio.",
        ),
      ],
    ],
    {
      background: NAVY,
      padding: pad(16, 20, 56, 20),
    },
  );
}

function buildSocialProof(): SectionNode {
  const mkStat = (value: string, caption: string) => {
    const h = heading(value, "h3", {
      color: WHITE,
      typography: typo({ fontSize: 28, fontWeight: 800, lineHeight: 1.1, textAlign: "center" }),
      margin: pad(0, 0, 6, 0),
    });
    const t = html(`<p style="margin:0">${caption}</p>`, {
      color: MUTED,
      typography: typo({ fontSize: 13, fontWeight: 400, lineHeight: 1.4, textAlign: "center" }),
    });
    return [h, t] as WidgetNode[];
  };
  return section(
    [mkStat("1 painel", "Presell + tracking"), mkStat("0 WP", "Sem plugins"), mkStat("Postback", "Redes afiliadas"), mkStat("Starter", "Sem cartão")],
    {
      background: NAVY_CARD,
      padding: pad(36, 20, 36, 20),
      border: { width: 0, style: "solid", color: "#000", radius: 0 },
    },
  );
}

function buildTestimonials(): SectionNode {
  const title = heading("Quem opera tráfego pago prefere menos ferramentas", "h2", {
    color: WHITE,
    typography: typo({ fontSize: 26, fontWeight: 800, lineHeight: 1.25, textAlign: "center" }),
    margin: pad(0, 0, 8, 0),
  });
  const sub = html(
    `<p style="margin:0">Depoimentos editáveis — substitui por feedback real da tua operação ou remove a secção.</p>`,
    {
      color: MUTED,
      typography: typo({ fontSize: 14, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }),
      margin: pad(0, 0, 20, 0),
    },
  );
  const tw = createWidget("testimonials");
  tw.content = {
    ...(tw.content as object),
    autoplay: true,
    intervalMs: 5500,
    showStars: true,
    showAvatars: false,
    cardBg: NAVY_CARD,
    textColor: WHITE,
    accentColor: ACCENT,
    items: [
      {
        id: id("t_"),
        name: "Media buyer",
        role: "Google Ads · redes afiliadas",
        avatar: "",
        quote: "Presell e tracking no mesmo sítio — menos tabs e menos furos no funil.",
        rating: 5,
      },
      {
        id: id("t_"),
        name: "Gestor de afiliados",
        role: "Operação multi-oferta",
        avatar: "",
        quote: "Publico a página, ligo o postback e vejo a conversão no painel sem WordPress.",
        rating: 5,
      },
      {
        id: id("t_"),
        name: "Afiliado Pro",
        role: "Tráfego pago",
        avatar: "",
        quote: "Comecei no Starter sem cartão. Quando a operação pediu escala, subi de plano.",
        rating: 5,
      },
    ],
  };
  return section(
    [[title, sub, tw]],
    { background: NAVY, padding: pad(48, 24, 40, 24) },
  );
}

function buildPricingIntro(): SectionNode {
  const label = heading("PLANOS E PREÇOS", "h3", {
    color: ACCENT,
    typography: typo({
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 2,
      textAlign: "center",
      textTransform: "uppercase",
    }),
    margin: pad(0, 0, 10, 0),
  });
  const title = heading("Escolhe o plano que acompanha o teu crescimento.", "h2", {
    color: WHITE,
    typography: typo({
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1.25,
      letterSpacing: -0.3,
      textAlign: "center",
    }),
  });
  const note = html(
    `<p style="margin:0">Preços e textos editáveis no painel de propriedades. No admin de vendas podes trocar por Planos vivos.</p>`,
    {
      color: MUTED,
      typography: typo({ fontSize: 14, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }),
      margin: pad(12, 0, 0, 0),
    },
  );
  const anchor = createWidget("menuAnchor");
  anchor.content = { ...(anchor.content as object), anchorId: "planos" };
  return section(
    [[anchor, label, title, note]],
    {
      background: `linear-gradient(180deg, ${NAVY} 0%, #08122a 100%)`,
      padding: pad(40, 24, 16, 24),
    },
  );
}

function buildPricingCards(): SectionNode {
  return section(
    [
      [
        priceCard({
          title: "Starter",
          subtitle: "Para validar o funil",
          currency: "$",
          price: "0",
          period: " / grátis",
          features: [
            "Presells no plano Starter",
            "Tracking básico de cliques",
            "Publicação na dclickora",
            "Sem cartão nesta página",
          ],
          ctaText: "Começar Gratuitamente",
          ctaHref: "/auth",
          highlighted: false,
        }),
      ],
      [
        priceCard({
          badge: "Mais Popular",
          title: "Pro Mensal",
          subtitle: "Para quem já anuncia",
          currency: "$",
          price: "24",
          period: "/mês",
          features: [
            "Tudo do Starter",
            "Postback das redes",
            "Mais quotas de cliques",
            "Suporte prioritário",
          ],
          ctaText: "Assinar Pro Mensal",
          ctaHref: "/auth",
          highlighted: true,
        }),
      ],
      [
        priceCard({
          title: "Pro Anual",
          subtitle: "Melhor custo-benefício",
          currency: "$",
          price: "196",
          period: "/ano",
          features: [
            "Tudo do Pro Mensal",
            "Mais domínios",
            "Módulo Ads (conforme plano)",
            "Poupança vs mensal",
          ],
          ctaText: "Assinar Pro Anual",
          ctaHref: "/auth",
          highlighted: false,
        }),
      ],
    ],
    {
      background: "#08122a",
      padding: pad(12, 16, 56, 16),
    },
  );
}

function buildFaq(): SectionNode {
  const title = heading("Perguntas frequentes", "h2", {
    color: WHITE,
    typography: typo({
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1.2,
      textAlign: "left",
    }),
    margin: pad(0, 0, 16, 0),
  });
  const allBtn = button("Ver todas as perguntas →", "#faq", "outline-light");
  allBtn.styles = {
    ...allBtn.styles,
    align: { desktop: "left" },
    margin: pad(0, 0, 0, 0),
    padding: pad(12, 20, 12, 20),
  };

  const faq = createWidget("faq");
  faq.content = {
    ...(faq.content as object),
    allowMultiple: false,
    defaultOpen: 0,
    itemBg: NAVY_CARD,
    itemBorderColor: "rgba(0,136,255,0.22)",
    questionColor: WHITE,
    answerColor: MUTED,
    accentColor: ACCENT,
    items: [
      {
        id: id("q_"),
        question: "O plano gratuito inclui o quê?",
        answer:
          "Crias a conta e ficas no Starter. O cartão do plano mostra quotas de presells e cliques. Não pedimos cartão nesta página. Postback das redes fica nos planos pagos.",
      },
      {
        id: id("q_"),
        question: "Preciso de WordPress?",
        answer:
          "Não. A presell publica na dclickora. Domínio próprio (quando o plano inclui) aponta para essa página — não é hosting à parte.",
      },
      {
        id: id("q_"),
        question: "Como funciona o tracking e o postback?",
        answer:
          "O clique guarda UTM/GCLID. Quando a rede envia o postback, a conversão liga-se ao mesmo clique no painel.",
      },
      {
        id: id("q_"),
        question: "Posso editar esta página no afiliado?",
        answer:
          "Sim. No editor manual de presell abre Temas e modelos, aplica «Landing DClickora — Navy SaaS» e altera textos, preços, CTAs e cores no painel.",
      },
    ],
  };

  const anchor = createWidget("menuAnchor");
  anchor.content = { ...(anchor.content as object), anchorId: "faq" };
  return section(
    [[anchor, title, allBtn], [faq]],
    {
      background: NAVY,
      padding: pad(48, 28, 56, 28),
    },
    [38, 62],
  );
}

function buildClosing(): SectionNode {
  const trophy = createWidget("icon");
  trophy.content = {
    ...(trophy.content as object),
    name: "trophy",
    size: 28,
    shape: "circle",
    shapeBg: "rgba(234,179,8,0.15)",
  };
  trophy.styles = {
    ...trophy.styles,
    color: "#eab308",
    align: { desktop: "left" },
    margin: pad(0, 0, 0, 0),
  };

  const copy = heading("Menos ferramentas dispersas. Mais controlo sobre a tua operação.", "h2", {
    color: WHITE,
    typography: typo({
      fontSize: 22,
      fontWeight: 700,
      lineHeight: 1.35,
      textAlign: "left",
    }),
  });

  const cta = button("Começar Agora — Starter Grátis →", "/auth", "primary");
  cta.styles = {
    ...cta.styles,
    align: { desktop: "right" },
    margin: pad(0, 0, 0, 0),
  };
  cta.effects = {
    ...cta.effects,
    continuousAnimation: "pulse",
    continuousDurationMs: 2800,
  };

  return section(
    [[trophy], [copy], [cta]],
    {
      background: `linear-gradient(90deg, ${NAVY_CARD} 0%, #0a1a38 50%, ${NAVY_CARD} 100%)`,
      padding: pad(28, 28, 28, 28),
      border: { width: 1, style: "solid", color: "rgba(0,136,255,0.2)", radius: 16 },
      margin: pad(0, 24, 48, 24),
    },
    [10, 55, 35],
  );
}

/** Secções completas (append / replace sem settings). */
export function buildDclickoraNavySaasSections(): SectionNode[] {
  return [
    buildNav(),
    buildHero(),
    buildSocialProof(),
    buildFeatures(),
    buildHowIntro(),
    buildHowSteps(),
    buildPricingIntro(),
    buildPricingCards(),
    buildTestimonials(),
    buildFaq(),
    buildClosing(),
  ];
}

/** Documento completo com tema navy — preferir em «Substituir página». */
export function createDclickoraNavySaasDocument(): PageDocument {
  const doc = createEmptyPage("Landing DClickora — Navy SaaS");
  doc.settings = {
    maxContentWidth: 1140,
    background: NAVY,
    themePreset: DCLICKORA_NAVY_SAAS_THEME_ID,
    globalDesign: {
      primary: ACCENT,
      accent: ACCENT,
      muted: MUTED,
      text: WHITE,
      secondary: NAVY_CARD,
      fontPrimary: "system-ui, -apple-system, Segoe UI, sans-serif",
      fontSecondary: "system-ui, -apple-system, Segoe UI, sans-serif",
    },
  };
  doc.sections = buildDclickoraNavySaasSections();
  doc.id = id("page_");
  doc.updatedAt = Date.now();
  return doc;
}

export const landingDclickoraNavySaasTemplate = {
  id: DCLICKORA_NAVY_SAAS_THEME_ID,
  name: "Landing DClickora — Navy SaaS",
  category: "landing" as const,
  description:
    "Mock azul/navy: menu, hero com portátil, 4 pilares, funil 3 passos, planos editáveis, FAQ e CTA — admin e afiliado",
  thumbnail: HERO_IMG,
  build: () => buildDclickoraNavySaasSections(),
  buildDocument: () => createDclickoraNavySaasDocument(),
};
