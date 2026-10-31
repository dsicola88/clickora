/**
 * Biblioteca profissional de landing + presell (admin page-builder e editor manual).
 * Tudo editável: textos, CTAs, cores, preços, FAQ, imagens.
 */
import type { PageDocument, SectionNode, WidgetNode } from "./types";
import { createColumn, createEmptyPage, createSection, createWidget, id } from "./factory";
import { normalizePageDocumentResponsive } from "./normalizeResponsive";

export type ProTemplateDef = {
  id: string;
  name: string;
  category: "landing" | "presell" | "vsl" | "lead";
  description: string;
  thumbnail: string;
  build: () => SectionNode[];
  buildDocument: () => PageDocument;
};

type Align = "left" | "center" | "right";

type Theme = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft?: string;
  onAccent?: string;
};

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

function pad(t: number, r: number, b: number, l: number) {
  return { desktop: { top: t, right: r, bottom: b, left: l, unit: "px" as const } };
}

function fx(w: WidgetNode, effects: NonNullable<WidgetNode["effects"]>) {
  w.effects = { ...w.effects, ...effects };
  return w;
}

function sec(
  cols: WidgetNode[][],
  styles: SectionNode["styles"],
  widths?: number[],
  layout: SectionNode["layout"] = "boxed",
): SectionNode {
  const s = createSection(cols.length);
  s.layout = layout;
  s.styles = { ...s.styles, ...styles };
  const n = cols.length;
  s.columns = cols.map((widgets, i) => {
    const pct = widths?.[i] ?? (n > 0 ? Math.floor(100 / n) : 100);
    const c = createColumn(pct);
    c.widgets = widgets;
    c.widthPercent = { desktop: pct, tablet: n > 1 ? 100 : pct, mobile: 100 };
    return c;
  });
  return s;
}

function h(text: string, tag: "h1" | "h2" | "h3", styles: WidgetNode["styles"]) {
  const w = createWidget("heading");
  w.content = { ...(w.content as object), text, tag };
  w.styles = { ...w.styles, ...styles };
  return w;
}

function p(html: string, styles: WidgetNode["styles"]) {
  const w = createWidget("text");
  w.content = { ...(w.content as object), html };
  w.styles = { ...w.styles, ...styles };
  return w;
}

function btn(theme: Theme, text: string, href: string, solid = true) {
  const w = createWidget("button");
  w.content = { ...(w.content as object), text, href, target: "_self" };
  w.styles = {
    ...w.styles,
    color: solid ? theme.onAccent ?? "#fff" : theme.text,
    background: solid ? theme.accent : "transparent",
    padding: pad(14, 28, 14, 28),
    border: {
      width: solid ? 0 : 1,
      style: "solid",
      color: solid ? theme.accent : `${theme.text}55`,
      radius: 10,
    },
    typography: typo({ fontSize: 15, fontWeight: 700, lineHeight: 1, textAlign: "center" }),
    align: { desktop: "center" },
    margin: pad(0, 8, 10, 8),
  };
  return fx(w, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 600,
    hoverTransform: "translateY(-2px)",
    transitionDurationMs: 200,
  });
}

function ctaRow(theme: Theme, primary: string, secondary: string, href = "#") {
  const a = btn(theme, primary, href, true);
  const b = btn(theme, secondary, href, false);
  a.styles = { ...a.styles, margin: pad(0, 0, 0, 0) };
  b.styles = { ...b.styles, margin: pad(0, 0, 0, 0) };
  const row = createWidget("container");
  row.content = {
    ...(row.content as object),
    direction: "row",
    justify: "flex-start",
    align: "center",
    wrap: "wrap",
    gap: 12,
    widgets: [a, b],
  };
  row.styles = { ...row.styles, margin: pad(8, 0, 12, 0), width: { desktop: "100%" } };
  return row;
}

function iconCard(theme: Theme, icon: string, title: string, body: string) {
  const box = createWidget("infoBox");
  box.content = {
    ...(box.content as object),
    iconName: icon,
    iconColor: theme.accent,
    iconBg: theme.accentSoft ?? `${theme.accent}22`,
    iconShape: "circle",
    title,
    description: body,
    ctaText: "",
    ctaHref: "#",
    layout: "stacked",
    align: "center",
    titleColor: theme.text,
    descColor: theme.muted,
    ctaColor: theme.accent,
    bg: theme.surface,
    borderRadius: 14,
  };
  box.styles = {
    ...box.styles,
    border: { width: 1, style: "solid", color: `${theme.accent}28`, radius: 14 },
    padding: pad(22, 18, 22, 18),
    margin: pad(6, 6, 6, 6),
  };
  return fx(box, { entranceAnimation: "fadeInUp", entranceTrigger: "scroll", entranceDurationMs: 620 });
}

function price(
  theme: Theme,
  opts: {
    badge?: string;
    title: string;
    subtitle: string;
    currency: string;
    price: string;
    period: string;
    features: string[];
    cta: string;
    hot?: boolean;
  },
) {
  const w = createWidget("priceTable");
  w.content = {
    ...(w.content as object),
    badge: opts.badge ?? "",
    title: opts.title,
    subtitle: opts.subtitle,
    currency: opts.currency,
    price: opts.price,
    period: opts.period,
    features: opts.features.map((text) => ({ id: id("pf_"), text, included: true })),
    ctaText: opts.cta,
    ctaHref: "#",
    highlighted: Boolean(opts.hot),
    // Cartões de preço claros (padrão profissional) mesmo em landings escuras.
    cardBg: "#ffffff",
    textColor: "#0f172a",
    accentColor: theme.accent,
    ctaBg: opts.hot ? theme.accent : "#eff6ff",
    ctaColor: opts.hot ? theme.onAccent ?? "#ffffff" : theme.accent,
    borderRadius: 14,
  };
  return fx(w, { entranceAnimation: "fadeInUp", entranceTrigger: "scroll", entranceDurationMs: 650 });
}

function faqBlock(theme: Theme, items: Array<{ q: string; a: string }>) {
  const w = createWidget("faq");
  const dark = !theme.bg.startsWith("#f") && theme.bg !== "#ffffff";
  w.content = {
    ...(w.content as object),
    allowMultiple: false,
    defaultOpen: 0,
    itemBg: dark ? theme.surface : "#ffffff",
    itemBorderColor: `${theme.accent}33`,
    questionColor: theme.text,
    answerColor: theme.muted,
    accentColor: theme.accent,
    items: items.map(({ q, a }) => ({ id: id("q_"), question: q, answer: a })),
  };
  return w;
}

function testimonials(theme: Theme, items: Array<{ name: string; role: string; quote: string }>) {
  const w = createWidget("testimonials");
  const light = theme.bg.startsWith("#f") || theme.bg === "#ffffff";
  w.content = {
    ...(w.content as object),
    autoplay: true,
    intervalMs: 5200,
    showStars: true,
    showAvatars: false,
    cardBg: light ? "#ffffff" : theme.surface,
    textColor: theme.text,
    accentColor: theme.accent,
    items: items.map((it) => ({
      id: id("t_"),
      name: it.name,
      role: it.role,
      avatar: "",
      quote: it.quote,
      rating: 5,
    })),
  };
  return w;
}

function nav(theme: Theme, brand: string, links: Array<{ label: string; href: string }>) {
  const logo = h(brand, "h3", {
    color: theme.text,
    typography: typo({ fontSize: 18, fontWeight: 800, letterSpacing: -0.2, textAlign: "left" }),
    margin: pad(0, 0, 0, 0),
  });
  const menu = createWidget("navMenu");
  menu.content = {
    ...(menu.content as object),
    align: "center",
    gap: 24,
    color: theme.muted,
    hoverColor: theme.text,
    activeColor: theme.accent,
    fontSize: 14,
    fontWeight: 500,
    pointer: "underline",
    toggleColor: theme.text,
    stickyMode: "sticky",
    items: links.map((l) => ({ id: id("nav_"), label: l.label, href: l.href })),
  };
  const cta = btn(theme, "Começar", "#", true);
  cta.styles = { ...cta.styles, padding: pad(10, 18, 10, 18), margin: pad(0, 0, 0, 0), align: { desktop: "right" } };
  return sec(
    [[logo], [menu], [cta]],
    { background: theme.bg, padding: pad(14, 24, 14, 24) },
    [24, 52, 24],
    "full",
  );
}

function closing(theme: Theme, title: string, cta: string) {
  const box = createWidget("ctaBox");
  box.content = {
    ...(box.content as object),
    title,
    description: "Textos e links 100% editáveis no painel de propriedades.",
    primaryText: cta,
    primaryHref: "#",
    secondaryText: "Falar connosco",
    secondaryHref: "#",
    layout: "centered",
    background: theme.surface,
    gradient: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.bg} 100%)`,
    textColor: theme.text,
    primaryBg: theme.accent,
    primaryColor: theme.onAccent ?? "#fff",
    borderRadius: 18,
    imageUrl: "",
  };
  return sec([[box]], { background: theme.bg, padding: pad(40, 24, 56, 24) });
}

function makeDoc(name: string, theme: Theme, themeId: string, sections: SectionNode[]): PageDocument {
  const doc = createEmptyPage(name);
  doc.settings = {
    maxContentWidth: 1140,
    background: theme.bg,
    themePreset: themeId,
    globalDesign: {
      primary: theme.accent,
      accent: theme.accent,
      muted: theme.muted,
      text: theme.text,
      secondary: theme.surface,
      fontPrimary: "system-ui, -apple-system, Segoe UI, sans-serif",
      fontSecondary: "system-ui, -apple-system, Segoe UI, sans-serif",
    },
  };
  doc.sections = sections;
  doc.id = id("page_");
  doc.updatedAt = Date.now();
  return normalizePageDocumentResponsive(doc);
}

function def(
  meta: Omit<ProTemplateDef, "build" | "buildDocument">,
  theme: Theme,
  buildSections: () => SectionNode[],
): ProTemplateDef {
  return {
    ...meta,
    build: buildSections,
    buildDocument: () => makeDoc(meta.name, theme, meta.id, buildSections()),
  };
}

/* ------------------------------------------------------------------ */
/* 1) Agency Studio — light editorial                                  */
/* ------------------------------------------------------------------ */
const agency: Theme = {
  bg: "#fafafa",
  surface: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  accent: "#111827",
  accentSoft: "rgba(17,24,39,0.08)",
  onAccent: "#ffffff",
};

const landingAgencyStudio = def(
  {
    id: "landing-agency-studio",
    name: "Landing — Agência / Studio",
    category: "landing",
    description: "Editorial claro: menu, hero tipográfico, serviços, portfolio strip, FAQ e CTA",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80",
  },
  agency,
  () => [
    nav(agency, "Studio", [
      { label: "Serviços", href: "#servicos" },
      { label: "Trabalho", href: "#trabalho" },
      { label: "Contacto", href: "#contacto" },
    ]),
    sec(
      [
        [
          p(`<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280">Design · Produto · Growth</p>`, {
            color: agency.muted,
            typography: typo({ fontSize: 12, fontWeight: 700, textAlign: "left", textTransform: "uppercase" }),
            margin: pad(0, 0, 16, 0),
          }),
          fx(
            h("Marcas que querem clareza, não ruído.", "h1", {
              color: agency.text,
              typography: typo({ fontSize: 48, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1, textAlign: "left" }),
              margin: pad(0, 0, 16, 0),
            }),
            { entranceAnimation: "fadeInUp", entranceTrigger: "load", entranceDurationMs: 700 },
          ),
          p(`<p style="margin:0">Landing pages, sistemas de design e funis de conversão — configuráveis e prontos a publicar.</p>`, {
            color: agency.muted,
            typography: typo({ fontSize: 18, fontWeight: 400, lineHeight: 1.6, textAlign: "left" }),
            margin: pad(0, 0, 24, 0),
          }),
          ctaRow(agency, "Pedir proposta", "Ver trabalho"),
        ],
        [
          (() => {
            const img = createWidget("image");
            img.content = {
              ...(img.content as object),
              src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&q=80",
              alt: "Equipa em estúdio",
            };
            img.styles = {
              ...img.styles,
              border: { width: 0, style: "solid", color: "#000", radius: 18 },
              boxShadow: "0 30px 60px -24px rgba(17,24,39,0.35)",
            };
            return img;
          })(),
        ],
      ],
      { background: agency.bg, padding: pad(64, 28, 56, 28) },
      [55, 45],
      "full",
    ),
    sec(
      [
        [iconCard(agency, "pen-tool", "Identidade", "Sistemas visuais consistentes para produto e ads.")],
        [iconCard(agency, "layout-dashboard", "Landings", "Páginas de conversão com hierarquia clara.")],
        [iconCard(agency, "chart-line", "Growth", "Testes A/B e funis alinhados ao anúncio.")],
      ],
      { background: "#f3f4f6", padding: pad(48, 20, 48, 20) },
    ),
    sec(
      [
        [
          h("Perguntas frequentes", "h2", {
            color: agency.text,
            typography: typo({ fontSize: 28, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 20, 0),
          }),
          faqBlock(agency, [
            { q: "Quanto tempo até publicar?", a: "A maior parte das landings fica pronta em dias — editas textos e CTAs no painel." },
            { q: "Posso mudar cores e tipografia?", a: "Sim. Cada widget tem propriedades de estilo independentes." },
            { q: "Serve para afiliados?", a: "Sim — usa o mesmo editor manual de presell." },
          ]),
        ],
      ],
      { background: agency.bg, padding: pad(48, 24, 40, 24) },
    ),
    closing(agency, "Pronto para uma página que parece de agência?", "Agendar call"),
  ],
);

/* ------------------------------------------------------------------ */
/* 2) Fintech Trust — dark emerald                                     */
/* ------------------------------------------------------------------ */
const fintech: Theme = {
  bg: "#04140f",
  surface: "#0a1f18",
  text: "#ecfdf5",
  muted: "#86efac",
  accent: "#34d399",
  accentSoft: "rgba(52,211,153,0.16)",
  onAccent: "#042f1a",
};

const landingFintechTrust = def(
  {
    id: "landing-fintech-trust",
    name: "Landing — Fintech / Trust",
    category: "landing",
    description: "Escuro esmeralda: hero de confiança, métricas, segurança, preços e FAQ",
    thumbnail: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&q=80",
  },
  fintech,
  () => [
    nav(fintech, "Ledger", [
      { label: "Produto", href: "#produto" },
      { label: "Segurança", href: "#seguranca" },
      { label: "Preços", href: "#precos" },
    ]),
    sec(
      [
        [
          p(`<p style="margin:0;padding:8px 14px;border-radius:999px;border:1px solid rgba(52,211,153,0.35);display:inline-block;font-size:12px;font-weight:600">Conformidade · Auditoria · Controlo</p>`, {
            color: fintech.accent,
            typography: typo({ fontSize: 12, fontWeight: 600, textAlign: "center" }),
            margin: pad(0, 0, 18, 0),
            align: { desktop: "center" },
          }),
          h("Controlo financeiro com a clareza que a equipa precisa", "h1", {
            color: fintech.text,
            typography: typo({ fontSize: 42, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.6, textAlign: "center" }),
            margin: pad(0, 0, 14, 0),
          }),
          p(`<p style="margin:0;text-align:center">Dashboards, alertas e trilhos de auditoria — sem folhas de cálculo soltas.</p>`, {
            color: fintech.muted,
            typography: typo({ fontSize: 17, fontWeight: 400, lineHeight: 1.6, textAlign: "center" }),
            margin: pad(0, 0, 24, 0),
          }),
          (() => {
            const row = ctaRow(fintech, "Pedir demo", "Ver segurança");
            row.content = { ...(row.content as object), justify: "center" };
            return row;
          })(),
        ],
      ],
      {
        background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${fintech.accentSoft} 0%, transparent 55%), ${fintech.bg}`,
        padding: pad(72, 24, 64, 24),
      },
      undefined,
      "full",
    ),
    sec(
      [
        [
          h("99.9%", "h3", {
            color: fintech.accent,
            typography: typo({ fontSize: 36, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 6, 0),
          }),
          p(`<p style="margin:0;text-align:center">Uptime alvo</p>`, {
            color: fintech.muted,
            typography: typo({ fontSize: 13, textAlign: "center" }),
          }),
        ],
        [
          h("SOC-ready", "h3", {
            color: fintech.accent,
            typography: typo({ fontSize: 28, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 6, 0),
          }),
          p(`<p style="margin:0;text-align:center">Acessos e logs</p>`, {
            color: fintech.muted,
            typography: typo({ fontSize: 13, textAlign: "center" }),
          }),
        ],
        [
          h("24/7", "h3", {
            color: fintech.accent,
            typography: typo({ fontSize: 36, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 6, 0),
          }),
          p(`<p style="margin:0;text-align:center">Monitorização</p>`, {
            color: fintech.muted,
            typography: typo({ fontSize: 13, textAlign: "center" }),
          }),
        ],
      ],
      { background: fintech.surface, padding: pad(40, 16, 40, 16) },
    ),
    sec(
      [
        [iconCard(fintech, "shield", "Encriptação", "Dados em trânsito e em repouso com boas práticas.")],
        [iconCard(fintech, "lock", "Permissões", "Papéis granulares por equipa e ambiente.")],
        [iconCard(fintech, "file-text", "Exportações", "Relatórios auditáveis sob pedido.")],
      ],
      { background: fintech.bg, padding: pad(48, 20, 32, 20) },
    ),
    sec(
      [
        [
          price(fintech, {
            title: "Start",
            subtitle: "Equipas pequenas",
            currency: "€",
            price: "49",
            period: "/mês",
            features: ["Até 5 utilizadores", "Dashboards base", "Suporte email"],
            cta: "Começar",
          }),
        ],
        [
          price(fintech, {
            badge: "Popular",
            title: "Growth",
            subtitle: "Operações em escala",
            currency: "€",
            price: "149",
            period: "/mês",
            features: ["Utilizadores ilimitados", "Alertas", "SSO", "API"],
            cta: "Assinar Growth",
            hot: true,
          }),
        ],
        [
          price(fintech, {
            title: "Enterprise",
            subtitle: "À medida",
            currency: "€",
            price: "—",
            period: "",
            features: ["SLA dedicado", "Auditoria", "Onboarding"],
            cta: "Falar com vendas",
          }),
        ],
      ],
      { background: fintech.bg, padding: pad(24, 16, 48, 16) },
    ),
    closing(fintech, "Menos risco. Mais visibilidade.", "Agendar demo"),
  ],
);

/* ------------------------------------------------------------------ */
/* 3) Product Launch — waitlist                                        */
/* ------------------------------------------------------------------ */
const launch: Theme = {
  bg: "#0b1020",
  surface: "#151b2e",
  text: "#f8fafc",
  muted: "#94a3b8",
  accent: "#a78bfa",
  accentSoft: "rgba(167,139,250,0.2)",
  onAccent: "#1e1b4b",
};

const landingProductLaunch = def(
  {
    id: "landing-product-launch",
    name: "Landing — Lançamento / Waitlist",
    category: "landing",
    description: "Hero de lançamento, countdown, benefícios, formulário e prova social",
    thumbnail: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80",
  },
  launch,
  () => [
    sec(
      [
        [
          p(`<p style="margin:0;color:#c4b5fd;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase">Lançamento em breve</p>`, {
            color: launch.accent,
            typography: typo({ fontSize: 12, fontWeight: 700, textAlign: "center", textTransform: "uppercase" }),
            margin: pad(0, 0, 14, 0),
          }),
          h("A próxima versão do teu funil começa aqui", "h1", {
            color: launch.text,
            typography: typo({ fontSize: 44, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.7, textAlign: "center" }),
            margin: pad(0, 0, 14, 0),
          }),
          p(`<p style="margin:0;text-align:center">Entra na lista: acesso antecipado, templates e onboarding guiado.</p>`, {
            color: launch.muted,
            typography: typo({ fontSize: 17, lineHeight: 1.6, textAlign: "center" }),
            margin: pad(0, 0, 22, 0),
          }),
          (() => {
            const cd = createWidget("countdown");
            cd.content = {
              ...(cd.content as object),
              deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
              showLabels: true,
              showDays: true,
              digitBg: launch.surface,
              digitColor: launch.text,
              labelColor: launch.muted,
              separatorColor: launch.accent,
              digitSize: 44,
            };
            cd.styles = { ...cd.styles, margin: pad(0, 0, 24, 0), align: { desktop: "center" } };
            return cd;
          })(),
          (() => {
            const form = createWidget("form");
            form.content = {
              ...(form.content as object),
              submitText: "Quero acesso antecipado",
              successMessage: "Estás na lista. Vamos avisar-te.",
              buttonBg: launch.accent,
              buttonColor: launch.onAccent,
              labelColor: launch.text,
              inputBg: "#0b1020",
              inputBorderColor: `${launch.accent}55`,
              fields: [
                {
                  id: id("f_"),
                  type: "text",
                  name: "name",
                  label: "Nome",
                  required: true,
                  placeholder: "O teu nome",
                },
                {
                  id: id("f_"),
                  type: "email",
                  name: "email",
                  label: "Email",
                  required: true,
                  placeholder: "tu@empresa.com",
                },
              ],
            };
            form.styles = {
              ...form.styles,
              background: launch.surface,
              border: { width: 1, style: "solid", color: `${launch.accent}44`, radius: 16 },
              padding: pad(24, 20, 24, 20),
            };
            return form;
          })(),
        ],
      ],
      {
        background: `radial-gradient(ellipse 50% 40% at 50% 0%, ${launch.accentSoft} 0%, transparent 60%), ${launch.bg}`,
        padding: pad(80, 24, 72, 24),
      },
      undefined,
      "full",
    ),
    sec(
      [
        [iconCard(launch, "sparkles", "Acesso early", "Features antes do público geral.")],
        [iconCard(launch, "gift", "Bónus", "Pack de templates no dia 1.")],
        [iconCard(launch, "users", "Comunidade", "Canal privado de founders.")],
      ],
      { background: launch.bg, padding: pad(40, 20, 56, 20) },
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* 4) B2B Consulting                                                   */
/* ------------------------------------------------------------------ */
const b2b: Theme = {
  bg: "#ffffff",
  surface: "#f8fafc",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#0ea5e9",
  accentSoft: "rgba(14,165,233,0.12)",
  onAccent: "#ffffff",
};

const landingB2bConsulting = def(
  {
    id: "landing-b2b-consulting",
    name: "Landing — Consultoria B2B",
    category: "landing",
    description: "Split hero, processo em passos, depoimentos, FAQ e CTA de agenda",
    thumbnail: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80",
  },
  b2b,
  () => [
    nav(b2b, "Northstar", [
      { label: "Método", href: "#metodo" },
      { label: "Resultados", href: "#resultados" },
      { label: "FAQ", href: "#faq" },
    ]),
    sec(
      [
        [
          h("Diagnóstico claro. Plano executável. Equipa alinhada.", "h1", {
            color: b2b.text,
            typography: typo({ fontSize: 40, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.5, textAlign: "left" }),
            margin: pad(0, 0, 14, 0),
          }),
          p(`<p style="margin:0">Consultoria para empresas que querem crescimento previsível — sem slides vazios.</p>`, {
            color: b2b.muted,
            typography: typo({ fontSize: 17, lineHeight: 1.6, textAlign: "left" }),
            margin: pad(0, 0, 22, 0),
          }),
          ctaRow(b2b, "Marcar diagnóstico", "Ver método"),
        ],
        [
          (() => {
            const list = createWidget("iconList");
            list.content = {
              ...(list.content as object),
              iconColor: b2b.accent,
              titleColor: b2b.text,
              descColor: b2b.muted,
              items: [
                { id: id("il_"), iconName: "check", title: "Workshop de 90 min", description: "<p>Mapa do funil e gaps.</p>" },
                { id: id("il_"), iconName: "check", title: "Plano 30/60/90", description: "<p>Prioridades com owners.</p>" },
                { id: id("il_"), iconName: "check", title: "Ritual semanal", description: "<p>Métricas e decisões.</p>" },
              ],
            };
            return list;
          })(),
        ],
      ],
      { background: b2b.bg, padding: pad(64, 28, 48, 28) },
      [52, 48],
      "full",
    ),
    sec(
      [
        [iconCard(b2b, "search", "1. Diagnosticar", "Dados, canais e fricções reais.")],
        [iconCard(b2b, "map", "2. Priorizar", "Só o que move receita este trimestre.")],
        [iconCard(b2b, "rocket", "3. Executar", "Sprints curtos com donos claros.")],
      ],
      { background: b2b.surface, padding: pad(48, 20, 48, 20) },
    ),
    sec(
      [
        [
          h("O que os clientes dizem", "h2", {
            color: b2b.text,
            typography: typo({ fontSize: 26, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 20, 0),
          }),
          testimonials(b2b, [
            { name: "Inês Rocha", role: "COO", quote: "Saiímos com um plano que a equipa finalmente executa." },
            { name: "Pedro Nunes", role: "Head of Growth", quote: "Menos reuniões, mais decisões com número." },
          ]),
        ],
      ],
      { background: b2b.bg, padding: pad(48, 24, 40, 24) },
    ),
    closing(b2b, "Vamos ver se faz sentido trabalhar juntos?", "Agendar 20 min"),
  ],
);

/* ------------------------------------------------------------------ */
/* 5) App Download                                                     */
/* ------------------------------------------------------------------ */
const app: Theme = {
  bg: "#020617",
  surface: "#0f172a",
  text: "#f1f5f9",
  muted: "#94a3b8",
  accent: "#38bdf8",
  accentSoft: "rgba(56,189,248,0.18)",
  onAccent: "#0f172a",
};

const landingAppDownload = def(
  {
    id: "landing-app-download",
    name: "Landing — App / Download",
    category: "landing",
    description: "Hero mobile, features, ratings, stores CTA e FAQ leve",
    thumbnail: "https://images.unsplash.com/photo-1512941937453-6eefad34f4b5?w=400&q=80",
  },
  app,
  () => [
    sec(
      [
        [
          h("A app que simplifica o teu dia", "h1", {
            color: app.text,
            typography: typo({ fontSize: 42, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.6, textAlign: "left" }),
            margin: pad(0, 0, 12, 0),
          }),
          p(`<p style="margin:0">Notificações inteligentes, sync em tempo real e um ecrã limpo — iOS e Android.</p>`, {
            color: app.muted,
            typography: typo({ fontSize: 16, lineHeight: 1.6, textAlign: "left" }),
            margin: pad(0, 0, 18, 0),
          }),
          (() => {
            const stars = createWidget("starRating");
            stars.content = {
              ...(stars.content as object),
              rating: 4.9,
              max: 5,
              size: 20,
              color: "#fbbf24",
              showScore: true,
              title: "4.9 · 12k avaliações",
            };
            stars.styles = { ...stars.styles, margin: pad(0, 0, 18, 0), align: { desktop: "left" } };
            return stars;
          })(),
          ctaRow(app, "App Store", "Google Play"),
        ],
        [
          (() => {
            const img = createWidget("image");
            img.content = {
              ...(img.content as object),
              src: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=700&q=80",
              alt: "Mockup de smartphone",
            };
            img.styles = {
              ...img.styles,
              border: { width: 0, style: "solid", color: "#000", radius: 24 },
              boxShadow: `0 40px 80px -20px ${app.accentSoft}`,
            };
            return img;
          })(),
        ],
      ],
      {
        background: `radial-gradient(ellipse 45% 55% at 80% 40%, ${app.accentSoft} 0%, transparent 55%), ${app.bg}`,
        padding: pad(64, 28, 56, 28),
      },
      [52, 48],
      "full",
    ),
    sec(
      [
        [iconCard(app, "bell", "Alertas", "Só o que importa, quando importa.")],
        [iconCard(app, "cloud", "Sync", "Dados alinhados em todos os dispositivos.")],
        [iconCard(app, "lock", "Privacidade", "Controlo local das tuas preferências.")],
        [iconCard(app, "zap", "Rápida", "Arranque em milissegundos.")],
      ],
      { background: app.surface, padding: pad(40, 16, 56, 16) },
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* 6) Ecommerce spotlight                                              */
/* ------------------------------------------------------------------ */
const ecom: Theme = {
  bg: "#fffaf5",
  surface: "#ffffff",
  text: "#1c1917",
  muted: "#78716c",
  accent: "#ea580c",
  accentSoft: "rgba(234,88,12,0.12)",
  onAccent: "#ffffff",
};

const landingEcommerceSpotlight = def(
  {
    id: "landing-ecommerce-spotlight",
    name: "Landing — Produto E‑commerce",
    category: "landing",
    description: "Hero de produto, benefícios, reviews, garantia e CTA de compra",
    thumbnail: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
  },
  ecom,
  () => [
    sec(
      [
        [
          (() => {
            const img = createWidget("image");
            img.content = {
              ...(img.content as object),
              src: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80",
              alt: "Produto em destaque",
            };
            img.styles = {
              ...img.styles,
              border: { width: 0, style: "solid", color: "#000", radius: 20 },
              boxShadow: "0 24px 48px -20px rgba(28,25,23,0.25)",
            };
            return img;
          })(),
        ],
        [
          p(`<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ea580c">Edição limitada</p>`, {
            color: ecom.accent,
            typography: typo({ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }),
            margin: pad(0, 0, 10, 0),
          }),
          h("O detalhe que eleva o teu dia a dia", "h1", {
            color: ecom.text,
            typography: typo({ fontSize: 38, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.4, textAlign: "left" }),
            margin: pad(0, 0, 12, 0),
          }),
          p(`<p style="margin:0">Materiais premium, envio rastreado e devolução simples. Substitui copy e preço no painel.</p>`, {
            color: ecom.muted,
            typography: typo({ fontSize: 16, lineHeight: 1.6 }),
            margin: pad(0, 0, 18, 0),
          }),
          h("€129", "h2", {
            color: ecom.text,
            typography: typo({ fontSize: 32, fontWeight: 800, textAlign: "left" }),
            margin: pad(0, 0, 16, 0),
          }),
          btn(ecom, "Comprar agora", "#", true),
          p(`<p style="margin:12px 0 0;font-size:13px">✓ Envio 48h · ✓ Garantia 30 dias · ✓ Pagamento seguro</p>`, {
            color: ecom.muted,
            typography: typo({ fontSize: 13 }),
          }),
        ],
      ],
      { background: ecom.bg, padding: pad(56, 28, 48, 28) },
      [48, 52],
      "full",
    ),
    sec(
      [
        [iconCard(ecom, "package", "Envio rápido", "Despacho em 24–48h úteis.")],
        [iconCard(ecom, "refresh-cw", "Trocas fáceis", "Política clara sem letras miúdas.")],
        [iconCard(ecom, "award", "Qualidade", "Materiais seleccionados e testados.")],
      ],
      { background: "#fff7ed", padding: pad(40, 20, 40, 20) },
    ),
    sec(
      [
        [
          h("Quem já comprou", "h2", {
            color: ecom.text,
            typography: typo({ fontSize: 26, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 18, 0),
          }),
          testimonials(ecom, [
            { name: "Marta", role: "Cliente verificada", quote: "Chegou rápido e exactamente como na foto." },
            { name: "Tiago", role: "Cliente verificado", quote: "Acabamento premium — volto a comprar." },
          ]),
        ],
      ],
      { background: ecom.bg, padding: pad(40, 24, 56, 24) },
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* 7) Presell PAS                                                      */
/* ------------------------------------------------------------------ */
const pas: Theme = {
  bg: "#ffffff",
  surface: "#f1f5f9",
  text: "#0f172a",
  muted: "#475569",
  accent: "#dc2626",
  accentSoft: "rgba(220,38,38,0.1)",
  onAccent: "#ffffff",
};

const presellPasBridge = def(
  {
    id: "presell-pas-bridge",
    name: "Presell — PAS (Problema → Solução)",
    category: "presell",
    description: "Alerta, problema, agitação, solução, benefícios e CTA para a oferta",
    thumbnail: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&q=80",
  },
  pas,
  () => [
    sec(
      [
        [
          (() => {
            const alert = createWidget("alert");
            alert.content = {
              ...(alert.content as object),
              variant: "warning",
              title: "Atenção afiliado / media buyer",
              message: "<p>Esta página aquece a oferta. Substitui o problema e o CTA pelo teu produto.</p>",
              showIcon: true,
              dismissible: false,
              borderRadius: 12,
            };
            return alert;
          })(),
        ],
      ],
      { background: "#fff7ed", padding: pad(20, 20, 8, 20) },
    ),
    sec(
      [
        [
          h("Cansado de páginas que não convertem o clique?", "h1", {
            color: pas.text,
            typography: typo({ fontSize: 36, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.4, textAlign: "center" }),
            margin: pad(0, 0, 14, 0),
          }),
          p(`<p style="margin:0;text-align:center">Anúncios caros + landing genérica = CPC alto e zero venda. O visitante precisa de contexto antes do checkout.</p>`, {
            color: pas.muted,
            typography: typo({ fontSize: 17, lineHeight: 1.65, textAlign: "center" }),
            margin: pad(0, 0, 8, 0),
          }),
        ],
      ],
      { background: pas.bg, padding: pad(40, 24, 24, 24) },
    ),
    sec(
      [
        [
          h("O que acontece se continuares igual", "h2", {
            color: pas.text,
            typography: typo({ fontSize: 24, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 20, 0),
          }),
        ],
      ],
      { background: pas.surface, padding: pad(32, 20, 8, 20) },
    ),
    sec(
      [
        [iconCard(pas, "trending-down", "CPC sobe", "Sem mensagem alinhada ao anúncio.")],
        [iconCard(pas, "circle-x", "Bounce alto", "Visitante não entende a promessa.")],
        [iconCard(pas, "clock", "Tempo perdido", "Optimizas ads sem página que aquece.")],
      ],
      { background: pas.surface, padding: pad(8, 16, 40, 16) },
    ),
    sec(
      [
        [
          h("A ponte: contexto → confiança → oferta", "h2", {
            color: pas.text,
            typography: typo({ fontSize: 28, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 12, 0),
          }),
          p(`<p style="margin:0;text-align:center">Uma presell bem feita explica o problema, mostra a transformação e envia para o checkout com intenção.</p>`, {
            color: pas.muted,
            typography: typo({ fontSize: 16, lineHeight: 1.6, textAlign: "center" }),
            margin: pad(0, 0, 22, 0),
          }),
          (() => {
            const list = createWidget("iconList");
            list.content = {
              ...(list.content as object),
              iconColor: pas.accent,
              titleColor: pas.text,
              descColor: pas.muted,
              items: [
                { id: id("il_"), iconName: "check", title: "Headline alinhada ao anúncio", description: "<p>Mesma promessa, zero dissonância.</p>" },
                { id: id("il_"), iconName: "check", title: "Prova e objecções", description: "<p>FAQ e benefícios antes do clique final.</p>" },
                { id: id("il_"), iconName: "check", title: "CTA único", description: "<p>Uma acção principal por ecrã.</p>" },
              ],
            };
            return list;
          })(),
          btn(pas, "Ver a oferta agora →", "#", true),
        ],
      ],
      { background: pas.bg, padding: pad(48, 24, 56, 24) },
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* 8) Presell editorial story                                          */
/* ------------------------------------------------------------------ */
const editorial: Theme = {
  bg: "#faf8f5",
  surface: "#ffffff",
  text: "#1c1917",
  muted: "#57534e",
  accent: "#0f766e",
  accentSoft: "rgba(15,118,110,0.12)",
  onAccent: "#ffffff",
};

const presellEditorialStory = def(
  {
    id: "presell-editorial-story",
    name: "Presell — Editorial / História",
    category: "presell",
    description: "Long-form tipográfico: abertura, história, prova, lista e CTA final",
    thumbnail: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&q=80",
  },
  editorial,
  () => [
    sec(
      [
        [
          p(`<p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:#0f766e">Relato · Operação real</p>`, {
            color: editorial.accent,
            typography: typo({ fontSize: 12, fontWeight: 700, textAlign: "center", textTransform: "uppercase" }),
            margin: pad(0, 0, 16, 0),
          }),
          h("Como deixámos de perder cliques entre o anúncio e a venda", "h1", {
            color: editorial.text,
            typography: typo({ fontSize: 40, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5, textAlign: "center" }),
            margin: pad(0, 0, 16, 0),
          }),
          p(`<p style="margin:0;text-align:center;font-size:18px;line-height:1.7">Uma história curta sobre alinhamento de mensagem, página de aquecimento e tracking — edita cada parágrafo.</p>`, {
            color: editorial.muted,
            typography: typo({ fontSize: 18, lineHeight: 1.7, textAlign: "center" }),
          }),
        ],
      ],
      { background: editorial.bg, padding: pad(64, 28, 32, 28) },
      undefined,
      "full",
    ),
    sec(
      [
        [
          p(
            `<p style="margin:0 0 16px">Durante meses optimizámos só o anúncio. O CPC baixava, mas a conversão no checkout não acompanhava.</p>
             <p style="margin:0 0 16px">O visitante chegava frio: sem contexto, sem prova, sem ponte. A oferta parecia «mais do mesmo».</p>
             <p style="margin:0">Mudámos a ordem: primeiro a história e o porquê; depois o botão. O funil ficou legível — para a pessoa e para os relatórios.</p>`,
            {
              color: editorial.text,
              typography: typo({ fontSize: 17, lineHeight: 1.75, textAlign: "left" }),
              margin: pad(0, 0, 24, 0),
            },
          ),
          (() => {
            const img = createWidget("image");
            img.content = {
              ...(img.content as object),
              src: "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=1000&q=80",
              alt: "Ambiente de trabalho",
            };
            img.styles = {
              ...img.styles,
              border: { width: 0, style: "solid", color: "#000", radius: 14 },
              margin: pad(8, 0, 24, 0),
            };
            return img;
          })(),
          h("Três decisões que mudaram o resultado", "h2", {
            color: editorial.text,
            typography: typo({ fontSize: 24, fontWeight: 800, textAlign: "left" }),
            margin: pad(8, 0, 14, 0),
          }),
          (() => {
            const list = createWidget("iconList");
            list.content = {
              ...(list.content as object),
              iconColor: editorial.accent,
              titleColor: editorial.text,
              descColor: editorial.muted,
              items: [
                { id: id("il_"), iconName: "check", title: "Mesma promessa no ad e na página", description: "<p>Zero dissonância cognitiva.</p>" },
                { id: id("il_"), iconName: "check", title: "Prova antes do preço", description: "<p>Objecções tratadas na presell.</p>" },
                { id: id("il_"), iconName: "check", title: "Um CTA óbvio", description: "<p>O próximo passo nunca é ambíguo.</p>" },
              ],
            };
            return list;
          })(),
          btn(editorial, "Quero ver a solução →", "#", true),
        ],
      ],
      { background: editorial.surface, padding: pad(40, 28, 56, 28) },
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* 9) Presell proof wall                                               */
/* ------------------------------------------------------------------ */
const proof: Theme = {
  bg: "#0f172a",
  surface: "#1e293b",
  text: "#f8fafc",
  muted: "#94a3b8",
  accent: "#f59e0b",
  accentSoft: "rgba(245,158,11,0.16)",
  onAccent: "#1c1917",
};

const presellProofWall = def(
  {
    id: "presell-proof-wall",
    name: "Presell — Muro de prova social",
    category: "presell",
    description: "Ratings, depoimentos, logos, garantia e CTA forte para a oferta",
    thumbnail: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80",
  },
  proof,
  () => [
    sec(
      [
        [
          (() => {
            const stars = createWidget("starRating");
            stars.content = {
              ...(stars.content as object),
              rating: 4.8,
              max: 5,
              size: 22,
              color: proof.accent,
              showScore: true,
              title: "Baseado em feedback editável",
            };
            stars.styles = { ...stars.styles, align: { desktop: "center" }, margin: pad(0, 0, 14, 0) };
            return stars;
          })(),
          h("Não acredites só na nossa palavra", "h1", {
            color: proof.text,
            typography: typo({ fontSize: 36, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.4, textAlign: "center" }),
            margin: pad(0, 0, 12, 0),
          }),
          p(`<p style="margin:0;text-align:center">Substitui depoimentos, números e logos pelos da tua oferta. Mantém um CTA.</p>`, {
            color: proof.muted,
            typography: typo({ fontSize: 16, lineHeight: 1.6, textAlign: "center" }),
          }),
        ],
      ],
      { background: proof.bg, padding: pad(56, 24, 32, 24) },
      undefined,
      "full",
    ),
    sec(
      [
        [
          h("+2.400", "h3", {
            color: proof.accent,
            typography: typo({ fontSize: 32, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 4, 0),
          }),
          p(`<p style="margin:0;text-align:center">Clientes / pedidos</p>`, {
            color: proof.muted,
            typography: typo({ fontSize: 13, textAlign: "center" }),
          }),
        ],
        [
          h("4.8★", "h3", {
            color: proof.accent,
            typography: typo({ fontSize: 32, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 4, 0),
          }),
          p(`<p style="margin:0;text-align:center">Avaliação média</p>`, {
            color: proof.muted,
            typography: typo({ fontSize: 13, textAlign: "center" }),
          }),
        ],
        [
          h("30 dias", "h3", {
            color: proof.accent,
            typography: typo({ fontSize: 32, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 4, 0),
          }),
          p(`<p style="margin:0;text-align:center">Garantia (editar)</p>`, {
            color: proof.muted,
            typography: typo({ fontSize: 13, textAlign: "center" }),
          }),
        ],
      ],
      { background: proof.surface, padding: pad(36, 16, 36, 16) },
    ),
    sec(
      [
        [
          testimonials(proof, [
            { name: "Sofia L.", role: "Compradora", quote: "Chegou rápido e o suporte respondeu no mesmo dia." },
            { name: "André M.", role: "Comprador", quote: "Exactamente o que o anúncio prometia — sem surpresas." },
            { name: "Rita C.", role: "Compradora", quote: "Voltei a comprar. Processo simples do clique à entrega." },
          ]),
        ],
      ],
      { background: proof.bg, padding: pad(40, 20, 32, 20) },
    ),
    sec(
      [
        [
          (() => {
            const alert = createWidget("alert");
            alert.content = {
              ...(alert.content as object),
              variant: "success",
              title: "Garantia transparente",
              message: "<p>Edita este bloco com a política real da oferta (reembolso, suporte, prazos).</p>",
              showIcon: true,
              dismissible: false,
              borderRadius: 12,
            };
            return alert;
          })(),
          btn(proof, "Quero aproveitar a oferta →", "#", true),
        ],
      ],
      { background: proof.bg, padding: pad(16, 24, 56, 24) },
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* 10) Presell urgency bridge                                          */
/* ------------------------------------------------------------------ */
const urgency: Theme = {
  bg: "#fffbeb",
  surface: "#ffffff",
  text: "#1c1917",
  muted: "#78716c",
  accent: "#b45309",
  accentSoft: "rgba(180,83,9,0.12)",
  onAccent: "#ffffff",
};

const presellUrgencyBridge = def(
  {
    id: "presell-urgency-bridge",
    name: "Presell — Urgência + ponte",
    category: "presell",
    description: "Faixa de escassez, countdown, benefícios, FAQ curta e CTA repetido",
    thumbnail: "https://images.unsplash.com/photo-1506784365847-bbad939e9345?w=400&q=80",
  },
  urgency,
  () => [
    sec(
      [
        [
          (() => {
            const ticker = createWidget("ticker");
            ticker.content = {
              ...(ticker.content as object),
              items: [
                "Vagas limitadas nesta condição",
                "Oferta temporária — edita os textos",
                "Checkout seguro",
              ],
              speed: 28,
              bg: urgency.accent,
              color: "#fff7ed",
            };
            return ticker;
          })(),
        ],
      ],
      { background: urgency.accent, padding: pad(0, 0, 0, 0) },
      undefined,
      "full",
    ),
    sec(
      [
        [
          h("Esta condição não fica para sempre", "h1", {
            color: urgency.text,
            typography: typo({ fontSize: 36, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.4, textAlign: "center" }),
            margin: pad(0, 0, 12, 0),
          }),
          p(`<p style="margin:0;text-align:center">Usa urgência com honestidade: stock, bónus ou preço promocional real. Sem claims falsos.</p>`, {
            color: urgency.muted,
            typography: typo({ fontSize: 16, lineHeight: 1.6, textAlign: "center" }),
            margin: pad(0, 0, 20, 0),
          }),
          (() => {
            const cd = createWidget("countdown");
            cd.content = {
              ...(cd.content as object),
              deadline: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
              showLabels: true,
              showDays: true,
              digitBg: urgency.text,
              digitColor: "#fffbeb",
              labelColor: urgency.muted,
              separatorColor: urgency.accent,
              digitSize: 42,
            };
            cd.styles = { ...cd.styles, margin: pad(0, 0, 22, 0), align: { desktop: "center" } };
            return cd;
          })(),
          btn(urgency, "Garantir a minha vaga →", "#", true),
        ],
      ],
      { background: urgency.bg, padding: pad(48, 24, 32, 24) },
    ),
    sec(
      [
        [iconCard(urgency, "gift", "Bónus incluído", "Descreve o extra real da promoção.")],
        [iconCard(urgency, "shield", "Compra segura", "Métodos e política editáveis.")],
        [iconCard(urgency, "headphones", "Suporte", "Canal e horários da oferta.")],
      ],
      { background: urgency.surface, padding: pad(32, 16, 32, 16) },
    ),
    sec(
      [
        [
          h("Dúvidas rápidas", "h2", {
            color: urgency.text,
            typography: typo({ fontSize: 24, fontWeight: 800, textAlign: "center" }),
            margin: pad(0, 0, 16, 0),
          }),
          faqBlock(urgency, [
            { q: "A urgência é real?", a: "Deve ser. Edita datas e stock com base na oferta verdadeira." },
            { q: "Posso mudar o CTA?", a: "Sim — botões, href e textos no painel de propriedades." },
            { q: "Serve para Ads?", a: "Sim: alinha headline da presell ao anúncio e liga o tracking." },
          ]),
          btn(urgency, "Ir para a oferta agora", "#", true),
        ],
      ],
      { background: urgency.bg, padding: pad(40, 24, 56, 24) },
    ),
  ],
);

export const PRO_STUDIO_TEMPLATES: ProTemplateDef[] = [
  landingAgencyStudio,
  landingFintechTrust,
  landingProductLaunch,
  landingB2bConsulting,
  landingAppDownload,
  landingEcommerceSpotlight,
  presellPasBridge,
  presellEditorialStory,
  presellProofWall,
  presellUrgencyBridge,
];
