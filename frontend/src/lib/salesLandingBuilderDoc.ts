import type { PageDocument } from "@/page-builder/types";
import { createEmptyPage, createSection, createWidget, id } from "@/page-builder/factory";

/** Documento inicial da página de vendas no editor visual (tipo Elementor). */
export function createDefaultSalesLandingDocument(opts?: {
  heroTitle?: string;
  heroSubtitle?: string;
}): PageDocument {
  const doc = createEmptyPage("Página de vendas");
  doc.settings = {
    maxContentWidth: 1200,
    background: "#0b1220",
  };

  const hero = createSection(1);
  hero.styles = {
    ...hero.styles,
    background: "#0b1220",
    padding: {
      desktop: { top: 72, right: 24, bottom: 40, left: 24, unit: "px" },
    },
  };
  const heroHeading = createWidget("heading");
  heroHeading.content = {
    ...(heroHeading.content as object),
    text:
      opts?.heroTitle?.trim() ||
      "Da criação da presell ao acompanhamento das vendas. Tudo num só lugar.",
    tag: "h1",
  };
  heroHeading.styles = {
    ...heroHeading.styles,
    color: "#ffffff",
    typography: {
      desktop: {
        fontSize: 42,
        fontWeight: 800,
        lineHeight: 1.15,
        letterSpacing: -0.5,
        textAlign: "center",
        textTransform: "none",
        fontStyle: "normal",
        textDecoration: "none",
        wordSpacing: 0,
      },
    },
  };
  const heroText = createWidget("text");
  heroText.content = {
    ...(heroText.content as object),
    text:
      opts?.heroSubtitle?.trim() ||
      "Monte a página como no editor manual de presell: arraste blocos, edite no painel da direita e publique.",
  };
  heroText.styles = {
    ...heroText.styles,
    color: "#94a3b8",
    typography: {
      desktop: {
        fontSize: 17,
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
      desktop: { top: 12, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  };
  hero.columns[0].widgets = [heroHeading, heroText];

  const plansSec = createSection(1);
  plansSec.styles = {
    ...plansSec.styles,
    background: "#0b1220",
    padding: {
      desktop: { top: 24, right: 16, bottom: 64, left: 16, unit: "px" },
    },
  };
  const livePlans = createWidget("livePlans");
  plansSec.columns[0].widgets = [livePlans];

  const ctaSec = createSection(1);
  ctaSec.styles = {
    ...ctaSec.styles,
    background: "#0b1220",
    padding: {
      desktop: { top: 8, right: 24, bottom: 72, left: 24, unit: "px" },
    },
  };
  const cta = createWidget("button");
  cta.content = {
    ...(cta.content as object),
    text: "Ver planos",
    href: "#planos",
  };
  ctaSec.columns[0].widgets = [cta];

  doc.sections = [hero, plansSec, ctaSec];
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
