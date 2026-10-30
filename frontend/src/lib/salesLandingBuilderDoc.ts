import type { PageDocument } from "@/page-builder/types";
import { createEmptyPage, createSection, createWidget, id } from "@/page-builder/factory";

/** Documento inicial enterprise da página de vendas (estilo Utmify/Voluum, 100% editável). */
export function createDefaultSalesLandingDocument(opts?: {
  heroTitle?: string;
  heroSubtitle?: string;
}): PageDocument {
  const doc = createEmptyPage("Página de vendas dclickora");
  doc.settings = {
    maxContentWidth: 1120,
    background: "#070b16",
  };

  const hero = createSection(1);
  hero.styles = {
    ...hero.styles,
    background: "linear-gradient(180deg,#070b16 0%,#0f172a 55%,#070b16 100%)",
    padding: {
      desktop: { top: 80, right: 24, bottom: 48, left: 24, unit: "px" },
    },
  };
  const heroHeading = createWidget("heading");
  heroHeading.content = {
    ...(heroHeading.content as object),
    text:
      opts?.heroTitle?.trim() ||
      "CONHEÇA O TRACKING E A PRESELL QUE FECHAM O FUNIL",
    tag: "h1",
  };
  heroHeading.styles = {
    ...heroHeading.styles,
    color: "#f8fafc",
    typography: {
      desktop: {
        fontSize: 44,
        fontWeight: 800,
        lineHeight: 1.12,
        letterSpacing: -0.8,
        textAlign: "center",
        textTransform: "none",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
  };
  heroHeading.effects = {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 800,
    entranceDelayMs: 0,
  };
  const heroText = createWidget("text");
  heroText.content = {
    ...(heroText.content as object),
    text:
      opts?.heroSubtitle?.trim() ||
      "Trackeie cliques e vendas com precisão. Publique presells sem WordPress. Aumente o controlo do funil — teste grátis sem cartão nesta página.",
  };
  heroText.styles = {
    ...heroText.styles,
    color: "#94a3b8",
    typography: {
      desktop: {
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1.55,
        letterSpacing: 0,
        textAlign: "center",
        textTransform: "none",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
    margin: {
      desktop: { top: 16, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  };
  heroText.effects = {
    entranceAnimation: "fadeIn",
    entranceTrigger: "scroll",
    entranceDurationMs: 700,
    entranceDelayMs: 120,
  };
  const ctaPrimary = createWidget("button");
  ctaPrimary.content = {
    ...(ctaPrimary.content as object),
    text: "Testar gratuitamente",
    href: "/auth",
  };
  ctaPrimary.effects = {
    entranceAnimation: "zoomIn",
    entranceTrigger: "scroll",
    entranceDurationMs: 650,
    entranceDelayMs: 220,
    hoverTransform: "translateY(-4px) scale(1.03)",
    hoverBoxShadow: "0 12px 28px rgba(56,189,248,0.35)",
    transitionDurationMs: 220,
  };
  const ctaSecondary = createWidget("button");
  ctaSecondary.content = {
    ...(ctaSecondary.content as object),
    text: "Falar com especialista",
    href: "/auth",
  };
  ctaSecondary.effects = {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 650,
    entranceDelayMs: 280,
    hoverTransform: "translateY(-2px)",
    transitionDurationMs: 200,
  };
  hero.columns[0].widgets = [heroHeading, heroText, ctaPrimary, ctaSecondary];

  const features = createSection(1);
  features.styles = {
    ...features.styles,
    background: "#0b1220",
    padding: {
      desktop: { top: 56, right: 24, bottom: 24, left: 24, unit: "px" },
    },
  };
  const featTitle = createWidget("heading");
  featTitle.content = {
    ...(featTitle.content as object),
    text: "Uma plataforma. Do anúncio à venda confirmada.",
    tag: "h2",
  };
  featTitle.styles = {
    ...featTitle.styles,
    color: "#f8fafc",
    typography: {
      desktop: {
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: -0.3,
        textAlign: "center",
        textTransform: "none",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
  };
  const featBody = createWidget("text");
  featBody.content = {
    ...(featBody.content as object),
    text: "Presell · keywords · criativos · tracking — sem WordPress e sem tracker à parte. Arraste blocos, edite no painel e publique.",
  };
  featBody.styles = {
    ...featBody.styles,
    color: "#94a3b8",
    typography: {
      desktop: {
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        textAlign: "center",
        textTransform: "none",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
  };
  featTitle.effects = {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDurationMs: 700,
  };
  featBody.effects = {
    entranceAnimation: "fadeIn",
    entranceTrigger: "scroll",
    entranceDelayMs: 100,
  };
  features.columns[0].widgets = [featTitle, featBody];

  const plansSec = createSection(1);
  plansSec.styles = {
    ...plansSec.styles,
    background: "#070b16",
    padding: {
      desktop: { top: 32, right: 16, bottom: 48, left: 16, unit: "px" },
    },
  };
  const plansLabel = createWidget("heading");
  plansLabel.content = {
    ...(plansLabel.content as object),
    text: "PLANOS",
    tag: "h3",
  };
  plansLabel.styles = {
    ...plansLabel.styles,
    color: "#fb7185",
    typography: {
      desktop: {
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: 2,
        textAlign: "center",
        textTransform: "uppercase",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
  };
  const plansTitle = createWidget("heading");
  plansTitle.content = {
    ...(plansTitle.content as object),
    text: "Escolha o plano certo para a sua operação",
    tag: "h2",
  };
  plansTitle.styles = {
    ...plansTitle.styles,
    color: "#e2e8f0",
    typography: {
      desktop: {
        fontSize: 26,
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: -0.2,
        textAlign: "center",
        textTransform: "none",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
  };
  const livePlans = createWidget("livePlans");
  plansLabel.effects = {
    entranceAnimation: "fadeIn",
    entranceTrigger: "scroll",
  };
  plansTitle.effects = {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDelayMs: 80,
  };
  livePlans.effects = {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
    entranceDelayMs: 140,
  };
  plansSec.columns[0].widgets = [plansLabel, plansTitle, livePlans];

  const closing = createSection(1);
  closing.styles = {
    ...closing.styles,
    background: "linear-gradient(135deg,#1e1b4b 0%,#0f172a 50%,#164e63 100%)",
    padding: {
      desktop: { top: 56, right: 24, bottom: 64, left: 24, unit: "px" },
    },
  };
  const closeH = createWidget("heading");
  closeH.content = {
    ...(closeH.content as object),
    text: "Pronto para rastrear com precisão?",
    tag: "h2",
  };
  closeH.styles = {
    ...closeH.styles,
    color: "#ffffff",
    typography: {
      desktop: {
        fontSize: 28,
        fontWeight: 800,
        lineHeight: 1.2,
        letterSpacing: -0.3,
        textAlign: "center",
        textTransform: "none",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
  };
  const closeBtn = createWidget("button");
  closeBtn.content = {
    ...(closeBtn.content as object),
    text: "Começar agora",
    href: "/auth",
  };
  closeH.effects = {
    entranceAnimation: "fadeInUp",
    entranceTrigger: "scroll",
  };
  closeBtn.effects = {
    entranceAnimation: "zoomIn",
    entranceTrigger: "scroll",
    entranceDelayMs: 120,
    hoverTransform: "scale(1.05)",
    continuousAnimation: "pulse",
    continuousDurationMs: 2800,
  };
  closing.columns[0].widgets = [closeH, closeBtn];

  doc.sections = [hero, features, plansSec, closing];
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
