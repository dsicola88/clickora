import type { PageDocument, SectionNode, WidgetNode } from "@/page-builder/types";
import { createEmptyPage, createSection, createWidget, id } from "@/page-builder/factory";

/** Preset aplicado no canvas e listado em Temas → Modelos. */
export const DCLICKORA_SALES_THEME_ID = "dclickora-market";

/** Alinhado a `DEFAULT_LANDING_EXTRAS.theme` / chrome de `/planos`. */
const NAVY = "#070b16";
const NAVY_MID = "#0b1220";
const ACCENT = "#38bdf8";
const ACCENT_GLOW = "rgba(56,189,248,0.4)";
const WHITE = "#f8fafc";
const MUTED = "#94a3b8";
const CARD = "rgba(15,23,42,0.85)";

function typography(
  partial: Partial<{
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: number;
    textAlign: "left" | "center" | "right";
    textTransform: "none" | "uppercase";
  }>,
) {
  return {
    desktop: {
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0,
      textAlign: "center" as const,
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

function text(body: string, styles: WidgetNode["styles"]): WidgetNode {
  const w = createWidget("text");
  w.content = { ...(w.content as object), text: body };
  w.styles = { ...w.styles, ...styles };
  return w;
}

function primaryButton(label: string, href: string): WidgetNode {
  const w = createWidget("button");
  w.content = { ...(w.content as object), text: label, href };
  w.styles = {
    ...w.styles,
    color: "#0f172a",
    background: ACCENT,
    padding: { desktop: { top: 16, right: 28, bottom: 16, left: 28, unit: "px" } },
    border: { width: 0, style: "solid", color: ACCENT, radius: 999 },
    typography: typography({
      fontSize: 14,
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: 0.4,
      textAlign: "center",
      textTransform: "uppercase",
    }),
    align: { desktop: "center" },
    margin: { desktop: { top: 0, right: 8, bottom: 12, left: 8, unit: "px" } },
  };
  withEffects(w, {
    entranceAnimation: "zoomIn",
    entranceTrigger: "scroll",
    entranceDurationMs: 650,
    hoverTransform: "translateY(-3px) scale(1.02)",
    hoverBoxShadow: `0 14px 32px ${ACCENT_GLOW}`,
    transitionDurationMs: 220,
  });
  return w;
}

function ghostButton(label: string, href: string): WidgetNode {
  const w = createWidget("button");
  w.content = { ...(w.content as object), text: label, href };
  w.styles = {
    ...w.styles,
    color: WHITE,
    background: "transparent",
    padding: { desktop: { top: 15, right: 26, bottom: 15, left: 26, unit: "px" } },
    border: { width: 1, style: "solid", color: "rgba(248,250,252,0.45)", radius: 999 },
    typography: typography({
      fontSize: 14,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: 0.35,
      textAlign: "center",
      textTransform: "uppercase",
    }),
    align: { desktop: "center" },
    margin: { desktop: { top: 0, right: 8, bottom: 12, left: 8, unit: "px" } },
  };
  withEffects(w, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 650,
    hoverTransform: "translateY(-2px)",
    transitionDurationMs: 200,
  });
  return w;
}

/** 1 — Hero: marca + promessa + benefício + CTAs (persona media buyer / afiliado). */
function buildHero(opts?: { heroTitle?: string; heroSubtitle?: string }): SectionNode {
  const hero = createSection(1);
  hero.layout = "full";
  hero.styles = {
    ...hero.styles,
    background:
      "radial-gradient(ellipse 80% 55% at 78% -8%, rgba(56,189,248,0.26) 0%, transparent 55%), radial-gradient(ellipse 45% 35% at 8% 18%, rgba(56,189,248,0.1) 0%, transparent 50%), linear-gradient(180deg,#070b16 0%,#0b1220 55%,#070b16 100%)",
    padding: {
      desktop: { top: 80, right: 24, bottom: 64, left: 24, unit: "px" },
    },
  };

  const brand = heading("dclickora", "h1", {
    color: WHITE,
    typography: typography({
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: 0.6,
      textAlign: "center",
    }),
    margin: { desktop: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" } },
  });
  withEffects(brand, {
    entranceAnimation: "fadeIn",
    entranceTrigger: "load",
    entranceDurationMs: 550,
  });

  const line1 = heading(
    opts?.heroTitle?.trim() || "TRACKING + PRESELL NO MESMO PAINEL",
    "h2",
    {
      color: WHITE,
      typography: typography({
        fontSize: 42,
        fontWeight: 800,
        lineHeight: 1.08,
        letterSpacing: -0.7,
        textAlign: "center",
        textTransform: "uppercase",
      }),
      margin: { desktop: { top: 0, right: 0, bottom: 10, left: 0, unit: "px" } },
    },
  );
  withEffects(line1, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "load",
    entranceDurationMs: 750,
    entranceDelayMs: 60,
  });

  const line2 = heading("DO ANÚNCIO À VENDA CONFIRMADA", "h2", {
    color: ACCENT,
    typography: typography({
      fontSize: 36,
      fontWeight: 900,
      lineHeight: 1.1,
      letterSpacing: -0.5,
      textAlign: "center",
      textTransform: "uppercase",
    }),
    margin: { desktop: { top: 0, right: 0, bottom: 18, left: 0, unit: "px" } },
  });
  withEffects(line2, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "load",
    entranceDurationMs: 750,
    entranceDelayMs: 120,
  });

  const sub = text(
    opts?.heroSubtitle?.trim() ||
      "Para media buyers e afiliados: publique a presell sem WordPress, rastreie UTM/GCLID e feche a venda com postback Hotmart, Digistore, BuyGoods, SmartAdv e ClickBank.",
    {
      color: MUTED,
      typography: typography({
        fontSize: 17,
        fontWeight: 400,
        lineHeight: 1.55,
        textAlign: "center",
      }),
      margin: { desktop: { top: 0, right: 0, bottom: 16, left: 0, unit: "px" } },
    },
  );
  withEffects(sub, {
    entranceAnimation: "fadeIn",
    entranceTrigger: "load",
    entranceDurationMs: 700,
    entranceDelayMs: 180,
  });

  const badge = text("Starter grátis sem cartão nesta página · upgrade quando a operação pedir escala", {
    color: "#0f172a",
    background: ACCENT,
    border: { width: 0, style: "solid", color: ACCENT, radius: 999 },
    padding: { desktop: { top: 10, right: 20, bottom: 10, left: 20, unit: "px" } },
    margin: { desktop: { top: 4, right: 0, bottom: 28, left: 0, unit: "px" } },
    typography: typography({
      fontSize: 13,
      fontWeight: 700,
      lineHeight: 1.35,
      textAlign: "center",
    }),
    align: { desktop: "center" },
  });
  withEffects(badge, {
    entranceAnimation: "zoomIn",
    entranceTrigger: "load",
    entranceDurationMs: 600,
    entranceDelayMs: 240,
  });

  const ctaPrimary = primaryButton("Testar gratuitamente", "/auth");
  ctaPrimary.effects = {
    ...ctaPrimary.effects,
    entranceTrigger: "load",
    entranceDelayMs: 300,
  };
  const ctaSecondary = ghostButton("Falar com especialista", "/auth");
  ctaSecondary.effects = {
    ...ctaSecondary.effects,
    entranceTrigger: "load",
    entranceDelayMs: 360,
  };

  hero.columns[0].widgets = [brand, line1, line2, sub, badge, ctaPrimary, ctaSecondary];
  return hero;
}

/** 2 — Prova rápida (stats da landing clássica). */
function buildStats(): SectionNode {
  const sec = createSection(4);
  sec.styles = {
    ...sec.styles,
    background: NAVY_MID,
    padding: {
      desktop: { top: 36, right: 16, bottom: 36, left: 16, unit: "px" },
    },
  };
  const mk = (value: string, label: string) => {
    const h = heading(value, "h3", {
      color: ACCENT,
      typography: typography({ fontSize: 26, fontWeight: 800, lineHeight: 1.1, textAlign: "center" }),
      margin: { desktop: { top: 0, right: 0, bottom: 6, left: 0, unit: "px" } },
    });
    const t = text(label, {
      color: MUTED,
      typography: typography({ fontSize: 13, fontWeight: 400, lineHeight: 1.4, textAlign: "center" }),
    });
    return [h, t] as WidgetNode[];
  };
  sec.columns[0].widgets = mk("1 painel", "Presell + tracking + planos no mesmo login.");
  sec.columns[1].widgets = mk("0 WP", "Sem alojamento, tema ou plugins para a landing.");
  sec.columns[2].widgets = mk("Postback", "Vendas das redes entram nos planos com aviso.");
  sec.columns[3].widgets = mk("Starter", "Grátis sem cartão — limites no cartão do plano.");
  return sec;
}

/** 3 — História do funil (persuasão: como fecha). */
function buildFunnelStory(): SectionNode {
  const sec = createSection(3);
  sec.styles = {
    ...sec.styles,
    background: NAVY,
    padding: {
      desktop: { top: 56, right: 20, bottom: 24, left: 20, unit: "px" },
    },
  };
  const mk = (step: string, titleText: string, body: string) => {
    const s = heading(step, "h3", {
      color: ACCENT,
      typography: typography({
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 2,
        textAlign: "center",
        textTransform: "uppercase",
      }),
      margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
    });
    const h = heading(titleText, "h3", {
      color: WHITE,
      typography: typography({ fontSize: 20, fontWeight: 700, lineHeight: 1.25, textAlign: "center" }),
      margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
    });
    const t = text(body, {
      color: MUTED,
      typography: typography({ fontSize: 14, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }),
    });
    return [s, h, t] as WidgetNode[];
  };

  sec.columns[0].widgets = mk(
    "01",
    "Anúncio com parâmetros",
    "O clique chega com UTM, GCLID e keyword. O rotador e a campanha guardam o click ID.",
  );
  sec.columns[1].widgets = mk(
    "02",
    "Presell sua, no ar",
    "Editor visual → publicar → /p/uuid ou domínio próprio. Sem WordPress.",
  );
  sec.columns[2].widgets = mk(
    "03",
    "Venda no painel",
    "A rede envia o postback; a conversão liga-se ao mesmo clique. Menos furos no funil.",
  );
  return sec;
}

function buildFunnelIntro(): SectionNode {
  const sec = createSection(1);
  sec.styles = {
    ...sec.styles,
    background: NAVY,
    padding: {
      desktop: { top: 56, right: 24, bottom: 8, left: 24, unit: "px" },
    },
  };
  const title = heading("Como a dclickora fecha o ciclo", "h2", {
    color: WHITE,
    typography: typography({
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1.2,
      textAlign: "center",
    }),
  });
  const body = text(
    "Feito para quem escala tráfego pago: menos ferramentas, um click ID do anúncio até à rede afiliada.",
    {
      color: MUTED,
      typography: typography({ fontSize: 16, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }),
      margin: { desktop: { top: 12, right: 0, bottom: 0, left: 0, unit: "px" } },
    },
  );
  withEffects(title, { entranceAnimation: "fadeInUp", entranceTrigger: "scroll", entranceDurationMs: 700 });
  sec.columns[0].widgets = [title, body];
  return sec;
}

/** 4 — Capacidades reais (não genéricas). */
function buildCapabilities(): SectionNode {
  const sec = createSection(3);
  sec.styles = {
    ...sec.styles,
    background: NAVY_MID,
    padding: {
      desktop: { top: 48, right: 16, bottom: 48, left: 16, unit: "px" },
    },
  };
  const mk = (titleText: string, body: string) => {
    const boxTitle = heading(titleText, "h3", {
      color: WHITE,
      typography: typography({ fontSize: 18, fontWeight: 700, lineHeight: 1.3, textAlign: "center" }),
      margin: { desktop: { top: 0, right: 0, bottom: 10, left: 0, unit: "px" } },
    });
    const boxBody = text(body, {
      color: MUTED,
      typography: typography({ fontSize: 14, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }),
    });
    return [boxTitle, boxBody] as WidgetNode[];
  };
  sec.columns[0].widgets = mk(
    "Presell no ar em minutos",
    "Cookies, VSL/TSL, oferta e popups no editor. Publique na dclickora ou no seu domínio elegível.",
  );
  sec.columns[1].widgets = mk(
    "Tracking de clique e venda",
    "Campanha e palavra-chave viajam com o clique. A venda entra quando a rede manda o postback.",
  );
  sec.columns[2].widgets = mk(
    "Keywords e Ads",
    "Listas de pesquisa e rascunhos de anúncios. Módulo Google / Meta / TikTok no Pro Anual, com revisão.",
  );
  return sec;
}

/** 5 — Planos vivos (preços reais da base / Hotmart). */
function buildPlans(): SectionNode {
  const plansSec = createSection(1);
  plansSec.styles = {
    ...plansSec.styles,
    background: NAVY,
    padding: {
      desktop: { top: 40, right: 16, bottom: 48, left: 16, unit: "px" },
    },
  };
  const plansLabel = heading("PLANOS", "h3", {
    color: ACCENT,
    typography: typography({
      fontSize: 13,
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: 2.4,
      textAlign: "center",
      textTransform: "uppercase",
    }),
  });
  const plansTitle = heading("Escolha o plano certo para a sua operação", "h2", {
    color: WHITE,
    typography: typography({
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1.25,
      letterSpacing: -0.2,
      textAlign: "center",
    }),
    margin: { desktop: { top: 8, right: 0, bottom: 8, left: 0, unit: "px" } },
  });
  const plansNote = text(
    "Starter para validar o fluxo. Pro Mensal para quem já anuncia e precisa de postback e quotas. Pro Anual com mais domínios e módulo Ads. Preços e limites sincronizados com o admin — cartões vivos abaixo.",
    {
      color: MUTED,
      typography: typography({ fontSize: 14, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }),
      margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
    },
  );
  const livePlans = createWidget("livePlans");
  livePlans.content = {
    ...(livePlans.content as object),
    showHeader: false,
    accentColor: ACCENT,
    ctaBg: ACCENT,
    ctaColor: "#0f172a",
    cardBg: "#ffffff",
    textColor: "#0f172a",
    sectionLabel: "PLANOS",
    title: "Escolha o plano certo",
    subtitle: "Starter · Pro Mensal · Pro Anual — limites reais no cartão.",
  };
  withEffects(plansLabel, { entranceAnimation: "fadeIn", entranceTrigger: "scroll" });
  withEffects(plansTitle, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDelayMs: 80,
  });
  withEffects(livePlans, {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDelayMs: 140,
  });
  plansSec.columns[0].widgets = [plansLabel, plansTitle, plansNote, livePlans];
  return plansSec;
}

/** 6 — Objeções (FAQ real da app). */
function buildFaq(): SectionNode {
  const sec = createSection(1);
  sec.styles = {
    ...sec.styles,
    background: NAVY_MID,
    padding: {
      desktop: { top: 48, right: 20, bottom: 40, left: 20, unit: "px" },
    },
  };
  const title = heading("Perguntas frequentes", "h2", {
    color: WHITE,
    typography: typography({
      fontSize: 26,
      fontWeight: 800,
      lineHeight: 1.25,
      textAlign: "center",
    }),
    margin: { desktop: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" } },
  });
  const faq = createWidget("faq");
  faq.content = {
    ...(faq.content as object),
    allowMultiple: false,
    defaultOpen: 0,
    itemBg: CARD,
    itemBorderColor: "rgba(56,189,248,0.25)",
    questionColor: WHITE,
    answerColor: MUTED,
    accentColor: ACCENT,
    items: [
      {
        id: id("q_"),
        question: "O plano grátis inclui o quê?",
        answer:
          "Cria a conta e fica no Starter. O cartão mostra quantas presells e cliques por mês. Não pedimos cartão nesta página. O postback das redes fica nos planos pagos.",
      },
      {
        id: id("q_"),
        question: "Como funciona o pagamento?",
        answer:
          "Planos pagos abrem o checkout Hotmart. Após aprovação, o plano activa se o e-mail da compra for o da conta. Reembolso e cancelamento seguem as regras Hotmart.",
      },
      {
        id: id("q_"),
        question: "Preciso de WordPress?",
        answer:
          "Não. A presell publica na dclickora. Domínio próprio (quando o plano inclui) aponta para essa página — não é hosting à parte.",
      },
      {
        id: id("q_"),
        question: "A dclickora garante ROI?",
        answer:
          "Não. Fornecemos páginas, tracking e relatórios. Resultados dependem da oferta, da rede e do tráfego. Não inventamos métricas nem testemunhos de ganhos.",
      },
    ],
  };
  sec.columns[0].widgets = [title, faq];
  return sec;
}

/** 7 — Confiança + CTA final. */
function buildClosing(): SectionNode {
  const closing = createSection(1);
  closing.styles = {
    ...closing.styles,
    background: `radial-gradient(ellipse 70% 80% at 50% 0%, ${ACCENT_GLOW} 0%, transparent 55%), linear-gradient(180deg,#0b1220 0%,#070b16 100%)`,
    padding: {
      desktop: { top: 56, right: 24, bottom: 64, left: 24, unit: "px" },
    },
  };
  const trust = heading("Pagamento transparente", "h3", {
    color: ACCENT,
    typography: typography({
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: 1.6,
      textAlign: "center",
      textTransform: "uppercase",
    }),
    margin: { desktop: { top: 0, right: 0, bottom: 10, left: 0, unit: "px" } },
  });
  const trustBody = text(
    "Planos pagos via Hotmart. A dclickora não cobra o cartão nesta página. Sem promessa de vendas, ROI ou aprovação de anúncios.",
    {
      color: MUTED,
      typography: typography({ fontSize: 14, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }),
      margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } },
    },
  );
  const closeBrand = heading("dclickora", "h3", {
    color: WHITE,
    typography: typography({
      fontSize: 14,
      fontWeight: 800,
      letterSpacing: 2,
      textAlign: "center",
      textTransform: "uppercase",
    }),
    margin: { desktop: { top: 0, right: 0, bottom: 12, left: 0, unit: "px" } },
  });
  const closeH = heading("Pronto para rastrear com precisão?", "h2", {
    color: WHITE,
    typography: typography({
      fontSize: 30,
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: -0.3,
      textAlign: "center",
    }),
  });
  const closeBtn = primaryButton("Começar agora — Starter grátis", "/auth");
  closeBtn.effects = {
    ...closeBtn.effects,
    continuousAnimation: "pulse",
    continuousDurationMs: 2800,
    entranceDelayMs: 120,
  };
  withEffects(closeH, { entranceAnimation: "fadeInUp", entranceTrigger: "scroll" });
  closing.columns[0].widgets = [trust, trustBody, closeBrand, closeH, closeBtn];
  return closing;
}

/** Documento inicial enterprise da página de vendas (tema dclickora, 100% editável). */
export function createDefaultSalesLandingDocument(opts?: {
  heroTitle?: string;
  heroSubtitle?: string;
}): PageDocument {
  const doc = createEmptyPage("Página de vendas dclickora");
  doc.settings = {
    maxContentWidth: 1120,
    background: NAVY,
    themePreset: DCLICKORA_SALES_THEME_ID,
    globalDesign: {
      primary: ACCENT,
      accent: ACCENT,
      muted: MUTED,
      text: WHITE,
      secondary: NAVY_MID,
      fontPrimary: "system-ui, -apple-system, Segoe UI, sans-serif",
      fontSecondary: "system-ui, -apple-system, Segoe UI, sans-serif",
    },
  };

  doc.sections = [
    buildHero(opts),
    buildStats(),
    buildFunnelIntro(),
    buildFunnelStory(),
    buildCapabilities(),
    buildPlans(),
    buildFaq(),
    buildClosing(),
  ];
  doc.id = id("page_");
  doc.updatedAt = Date.now();
  return doc;
}

export function asSalesPageDocument(raw: unknown): PageDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.sections) || o.sections.length === 0) return null;
  return raw as PageDocument;
}

export function salesDocumentHasMarketTheme(doc: PageDocument | null | undefined): boolean {
  if (!doc?.settings) return false;
  return doc.settings.themePreset === DCLICKORA_SALES_THEME_ID;
}
