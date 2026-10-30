/**
 * Blocos de secção reutilizáveis — montar páginas DTC do zero sem template completo
 * (fluxo: estrutura → widgets → estilo).
 */
import type { PageDocument, SectionNode, WidgetNode } from "./types";
import { createColumn, createSection, createWidget, id } from "./factory";
import { resolvedIdentity, type PageIdentity } from "./pageIdentity";

export type { PageIdentity };

export interface SectionBlockDefinition {
  id: string;
  name: string;
  description: string;
  category: "nav" | "hero" | "proof" | "cta" | "compliance";
  build: (ctx?: PageIdentity) => SectionNode[];
}

function cookieStorageKey(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/™/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `clickora-cookie-${slug || "produto"}`;
}

function heroPlaceholder(name: string) {
  const bullets = ["OFFICIAL OFFER", "TRANSPARENT TERMS", "SECURE CHECKOUT", "INDEPENDENT PAGE"];
  return `<div style="position:relative;border-radius:18px;overflow:hidden;background:linear-gradient(160deg,#071a3d 0%,#0b3d7a 48%,#0a2f5c 100%);min-height:340px;box-shadow:0 18px 40px rgba(11,61,122,.22)">
  <div style="display:flex;gap:10px;padding:32px 18px 48px;align-items:center;justify-content:space-between">
    <div style="flex:1;display:flex;align-items:flex-end;justify-content:center;gap:8px;min-height:220px">
      <div style="width:70px;height:168px;border-radius:14px 14px 8px 8px;background:linear-gradient(#f8fafc,#e2e8f0);box-shadow:0 10px 18px rgba(0,0,0,.22)"></div>
      <div style="width:86px;height:210px;border-radius:16px 16px 8px 8px;background:linear-gradient(#fff,#eef2f7);box-shadow:0 14px 24px rgba(0,0,0,.28)"></div>
      <div style="width:70px;height:168px;border-radius:14px 14px 8px 8px;background:linear-gradient(#f8fafc,#e2e8f0);box-shadow:0 10px 18px rgba(0,0,0,.22)"></div>
    </div>
    <div style="width:44%;display:flex;flex-direction:column;gap:16px;padding-right:4px">
      ${bullets
        .map(
          (t) =>
            `<div style="display:flex;align-items:center;gap:10px"><span style="flex-shrink:0;width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.45);display:inline-flex;align-items:center;justify-content:center"><span style="width:10px;height:10px;border-radius:50%;background:#fff"></span></span><span style="color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;line-height:1.2">${t}</span></div>`,
        )
        .join("")}
    </div>
  </div>
  <p style="position:absolute;left:16px;right:16px;bottom:10px;margin:0;font-size:9px;line-height:1.35;color:rgba(255,255,255,.55);text-align:center">Placeholder visual de ${name} — substitua pela imagem da oferta importada. Resultados individuais variam. Not FDA evaluated.</p>
</div>`;
}

function w(
  type: WidgetNode["type"],
  content: Record<string, unknown>,
  styles: WidgetNode["styles"] = {},
  extra?: Pick<WidgetNode, "cssId" | "cssClasses">,
): WidgetNode {
  const base = createWidget(type);
  return {
    ...base,
    content: { ...base.content, ...content },
    styles: { ...base.styles, ...styles },
    ...extra,
  };
}

function container(
  children: WidgetNode[],
  content: {
    direction?: "row" | "column";
    justify?: "flex-start" | "center" | "flex-end" | "space-between";
    align?: "flex-start" | "center" | "flex-end" | "stretch";
    wrap?: "nowrap" | "wrap";
    gap?: number;
  },
  styles: WidgetNode["styles"] = {},
): WidgetNode {
  const base = createWidget("container");
  return {
    ...base,
    content: {
      ...base.content,
      direction: content.direction ?? "row",
      justify: content.justify ?? "flex-start",
      align: content.align ?? "center",
      wrap: content.wrap ?? "wrap",
      gap: content.gap ?? 16,
      widgets: children,
    },
    styles: { ...base.styles, ...styles },
  };
}

function section(
  columnsWidgets: WidgetNode[][],
  sectionStyles: SectionNode["styles"] = {},
  layout: SectionNode["layout"] = "boxed",
  columnWidths?: number[],
  contentWidth = 1140,
): SectionNode {
  const sec = createSection(columnsWidgets.length);
  sec.layout = layout;
  sec.contentWidth = contentWidth;
  sec.styles = { ...sec.styles, ...sectionStyles };
  const n = columnsWidgets.length;
  sec.columns = columnsWidgets.map((widgets, i) => {
    const pct = columnWidths?.[i] ?? Math.floor(100 / Math.max(n, 1));
    const col = createColumn(pct);
    col.widgets = widgets;
    col.widthPercent = { desktop: pct, tablet: n > 1 ? 100 : pct, mobile: 100 };
    col.styles = {
      ...col.styles,
      padding: { desktop: { top: 8, right: 8, bottom: 8, left: 8, unit: "px" } },
    };
    return col;
  });
  return sec;
}

/** Amarelo CTA / Order Now */
const yellow = "#ffd200";
const blue = "#0b3d7a";
const ink = "#0a0a0a";
const body = "#1f2937";

export const SECTION_BLOCKS: SectionBlockDefinition[] = [
  {
    id: "block-nav-order",
    name: "Menu + Order Now",
    description: "Logo à esquerda, links e Order Now à direita — o nome não fica por baixo do menu.",
    category: "nav",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      const logo = w(
        "heading",
        { text: b.name, tag: "h2" },
        {
          typography: {
            desktop: {
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -0.4,
              textAlign: "left",
              textTransform: "none",
            },
          },
          color: ink,
          width: { desktop: "auto" },
          flexShrink: { desktop: 0 },
          margin: { desktop: { top: 0, right: 16, bottom: 0, left: 0, unit: "px" } },
        },
      );
      const menu = w(
        "navMenu",
        {
          align: "right",
          color: ink,
          hoverColor: blue,
          fontSize: 15,
          fontWeight: 500,
          gap: 22,
          underlineOnHover: false,
          items: [
            { id: id("nav_"), label: "How It Works?", href: "#how" },
            { id: id("nav_"), label: "Ingredients", href: "#ingredients" },
            { id: id("nav_"), label: "Benefits", href: "#benefits" },
          ],
        },
        {
          margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
          flexGrow: { desktop: 1 },
          flexShrink: { desktop: 1 },
        },
      );
      const orderBtn = w(
        "button",
        {
          text: b.cta,
          href: b.offer,
          iconName: "ShoppingCart",
          iconPosition: "right",
          iconSize: 17,
        },
        {
          typography: {
            desktop: {
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: 0,
              textAlign: "center",
              textTransform: "none",
            },
          },
          color: ink,
          background: yellow,
          padding: { desktop: { top: 13, right: 22, bottom: 13, left: 22, unit: "px" } },
          border: { width: 0, style: "solid", color: "#000", radius: 999 },
          align: { desktop: "right" },
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          flexShrink: { desktop: 0 },
          margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
        },
      );
      const bar = container(
        [logo, menu, orderBtn],
        {
          direction: "row",
          justify: "space-between",
          align: "center",
          wrap: "wrap",
          gap: 12,
        },
        {
          margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
        },
      );

      return [
        section(
          [[bar]],
          {
            background: "#ffffff",
            padding: { desktop: { top: 14, right: 24, bottom: 14, left: 24, unit: "px" } },
            boxShadow: "0 1px 0 rgba(15, 23, 42, 0.12)",
            position: { desktop: "sticky" },
            top: { desktop: "0" },
            zIndex: { desktop: 200 },
          },
          "boxed",
          [100],
          1180,
        ),
      ];
    },
  },
  {
    id: "block-hero-2col",
    name: "Hero imagem + texto",
    description: "1.ª dobra: painel do produto + título + texto (edite/substitua a imagem)",
    category: "hero",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      const visual = b.image
        ? w(
            "image",
            { src: b.image, alt: b.name, link: b.offer === "#" ? "" : b.offer, hero: true },
            {
              margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
            },
          )
        : w(
            "html",
            { code: heroPlaceholder(b.name) },
            {
              margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
            },
          );
      return [
      section(
        [
          [
            visual,
          ],
          [
            w(
              "heading",
              {
                text: b.headline,
                tag: "h1",
              },
              {
                typography: {
                  desktop: {
                    fontSize: 34,
                    fontWeight: 800,
                    lineHeight: 1.18,
                    letterSpacing: -0.45,
                    textAlign: "left",
                    textTransform: "none",
                  },
                  mobile: {
                    fontSize: 24,
                    fontWeight: 800,
                    lineHeight: 1.22,
                    letterSpacing: -0.2,
                    textAlign: "left",
                    textTransform: "none",
                  },
                },
                color: ink,
                margin: { desktop: { top: 4, right: 0, bottom: 18, left: 0, unit: "px" } },
              },
              { cssId: "how" },
            ),
            w(
              "text",
              {
                html: `<p>${b.name} is presented on this independent affiliate landing. Edit this text to match the official offer you imported — do not invent ingredients, origin or disease claims.</p>
<p style="margin-top:14px">Confirm price, shipping and terms on checkout. Individual results vary. This page is not the manufacturer.</p>`,
              },
              {
                typography: {
                  desktop: {
                    fontSize: 16,
                    fontWeight: 400,
                    lineHeight: 1.7,
                    letterSpacing: 0,
                    textAlign: "left",
                    textTransform: "none",
                  },
                },
                color: body,
              },
              { cssId: "ingredients" },
            ),
          ],
        ],
        {
          background: "#ffffff",
          padding: { desktop: { top: 44, right: 32, bottom: 48, left: 32, unit: "px" } },
        },
        "boxed",
        [46, 54],
        1180,
      ),
    ];
    },
  },
  {
    id: "block-why-band",
    name: "Barra Why Choose",
    description: "Faixa azul full-width — Why Choose (nome da página em edição)",
    category: "proof",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      return [
      section(
        [
          [
            w(
              "heading",
              { text: `Why Choose ${b.name}?`, tag: "h2" },
              {
                typography: {
                  desktop: {
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: 0,
                    textAlign: "center",
                    textTransform: "none",
                  },
                },
                color: "#ffffff",
                margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
              },
            ),
          ],
        ],
        {
          background: blue,
          padding: { desktop: { top: 22, right: 20, bottom: 22, left: 20, unit: "px" } },
        },
        "full",
      ),
    ];
    },
  },
  {
    id: "block-blue-band",
    name: "Barra Benefits",
    description: "Faixa azul full-width — Benefits (nome da página em edição)",
    category: "proof",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      return [
      section(
        [
          [
            w(
              "heading",
              { text: `Benefits of ${b.name}`, tag: "h2" },
              {
                typography: {
                  desktop: {
                    fontSize: 26,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: 0,
                    textAlign: "center",
                    textTransform: "none",
                  },
                },
                color: "#ffffff",
                margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
              },
              { cssId: "benefits" },
            ),
          ],
        ],
        {
          background: blue,
          padding: { desktop: { top: 20, right: 16, bottom: 20, left: 16, unit: "px" } },
        },
        "full",
      ),
    ];
    },
  },
  {
    id: "block-trust-4",
    name: "4 selos de confiança",
    description: "USA / Natural / GMP / Facility — edite o HTML de cada selo",
    category: "proof",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      const seal = (title: string, ring: string, inner: string, label: string, blurb: string) =>
        w(
          "html",
          {
            code: `<div style="text-align:center;padding:8px 6px">
<div style="width:110px;height:110px;margin:0 auto 14px;border-radius:50%;border:4px solid ${ring};background:radial-gradient(circle at 40% 35%,#fff 0%,${inner} 70%);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(15,23,42,.12)">
<span style="font-size:11px;font-weight:800;letter-spacing:.04em;text-align:center;line-height:1.2;color:#0f172a;padding:8px;text-transform:uppercase">${label}</span>
</div>
<p style="margin:0 0 8px;font-size:15px;font-weight:800;letter-spacing:.04em;color:#0f172a;text-transform:uppercase">${title}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4b5563">${blurb}</p>
</div>`,
          },
          {},
        );
      return [
        section(
          [
            [seal("MADE IN THE USA", "#c41e3a", "#e8eef7", "USA", `Confirm origin claims for ${b.name} on the official offer. This page does not invent manufacturing facts.`)],
            [seal("100% NATURAL", "#166534", "#ecfdf5", "Natural", "All ingredients are pure, natural, and carefully sourced.")],
            [seal("GMP CERTIFIED", "#b91c1c", "#fef2f2", "GMP", "Produced following Good Manufacturing Practice standards.")],
            [
              seal(
                "FDA REGISTERED FACILITY",
                blue,
                "#eff6ff",
                "Facility",
                "Made in a US-based facility registered with the FDA. Not an FDA-approved drug claim.",
              ),
            ],
          ],
          {
            background: "#ffffff",
            padding: { desktop: { top: 40, right: 16, bottom: 40, left: 16, unit: "px" } },
          },
          "boxed",
          [25, 25, 25, 25],
        ),
      ];
    },
  },
  {
    id: "block-benefits-list",
    name: "Lista de benefícios (checks)",
    description: "Círculos azuis + título + descrição — edite cada item",
    category: "proof",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      return [
      section(
        [
          [
            w(
              "text",
              {
                html: `<p>Use this section to describe ${b.name} the same way the official offer does. Do not paste claims from another catalog product.</p>`,
              },
              {
                typography: {
                  desktop: {
                    fontSize: 16,
                    fontWeight: 400,
                    lineHeight: 1.7,
                    letterSpacing: 0,
                    textAlign: "left",
                    textTransform: "none",
                  },
                },
                color: body,
                margin: { desktop: { top: 0, right: 0, bottom: 28, left: 0, unit: "px" } },
              },
            ),
            w(
              "iconList",
              {
                iconSize: 18,
                iconColor: "#ffffff",
                iconBg: blue,
                iconShape: "circle",
                gap: 22,
                titleColor: ink,
                descColor: "#4b5563",
                items: [
                  {
                    id: id("il_"),
                    iconName: "check",
                    title: "Matches the official offer:",
                    description:
                      `<p>Keep copy, images and benefits aligned with ${b.name} — the page you opened in this editor.</p>`,
                    href: "",
                  },
                  {
                    id: id("il_"),
                    iconName: "check",
                    title: "Transparent affiliate landing:",
                    description:
                      "<p>Disclose the affiliate relationship. Confirm price and terms on checkout. Individual results vary.</p>",
                    href: "",
                  },
                  {
                    id: id("il_"),
                    iconName: "check",
                    title: "No invented medical claims:",
                    description:
                      "<p>Do not diagnose, treat, cure or prevent disease. Edit this list with facts from the product page you imported.</p>",
                    href: "",
                  },
                ],
              },
              {},
            ),
          ],
        ],
        {
          background: "#ffffff",
          padding: { desktop: { top: 36, right: 28, bottom: 40, left: 28, unit: "px" } },
        },
        "boxed",
        [100],
        820,
      ),
    ];
    },
  },
  {
    id: "block-yellow-cta",
    name: "CTA amarelo",
    description: "Botão GET A DISCOUNT / Order com ícone carrinho",
    category: "cta",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      return [
      section(
        [
          [
            w(
              "button",
              {
                text: "GET A DISCOUNT NOW!",
                href: b.offer,
                iconName: "ShoppingCart",
                iconPosition: "right",
                iconSize: 18,
              },
              {
                typography: {
                  desktop: {
                    fontSize: 16,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: 0.3,
                    textAlign: "center",
                    textTransform: "uppercase",
                  },
                },
                color: ink,
                background: yellow,
                padding: { desktop: { top: 18, right: 36, bottom: 18, left: 36, unit: "px" } },
                border: { width: 0, style: "solid", color: "#000", radius: 999 },
                align: { desktop: "center" },
                boxShadow: "0 8px 24px rgba(255, 210, 0, 0.4)",
              },
              { cssId: "offer" },
            ),
          ],
        ],
        {
          background: "#ffffff",
          padding: { desktop: { top: 24, right: 20, bottom: 32, left: 20, unit: "px" } },
        },
      ),
    ];
    },
  },
  {
    id: "block-yellow-cta-soft",
    name: "CTA amarelo (fundo cinza)",
    description: "Segundo botão GET A DISCOUNT — faixa cinza antes do rodapé",
    category: "cta",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      return [
      section(
        [
          [
            w(
              "button",
              {
                text: "GET A DISCOUNT NOW!",
                href: b.offer,
                iconName: "ShoppingCart",
                iconPosition: "right",
                iconSize: 18,
              },
              {
                typography: {
                  desktop: {
                    fontSize: 16,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: 0.3,
                    textAlign: "center",
                    textTransform: "uppercase",
                  },
                },
                color: ink,
                background: yellow,
                padding: { desktop: { top: 18, right: 40, bottom: 18, left: 40, unit: "px" } },
                border: { width: 0, style: "solid", color: "#000", radius: 999 },
                align: { desktop: "center" },
              },
            ),
          ],
        ],
        {
          background: "#f9fafb",
          padding: { desktop: { top: 36, right: 24, bottom: 36, left: 24, unit: "px" } },
        },
      ),
    ];
    },
  },
  {
    id: "block-cookie-modal",
    name: "Cookie modal (Accept All)",
    description: "Overlay centrado + botão voltar ao topo",
    category: "compliance",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      return [
      section(
        [
          [
            w(
              "cookieBanner",
              {
                title: "We Value Your Privacy",
                body: "We use cookies to enhance your browsing experience and analyze site traffic. By clicking Accept All, you consent to our use of cookies. Learn more in our",
                allowLabel: "ACCEPT ALL",
                declineLabel: "Manage Preferences",
                policyLabel: "Cookie Policy",
                policyUrl: "/privacidade",
                accentColor: "#2563eb",
                variant: "modal",
                backdrop: true,
                position: "bottom-right",
                storageKey: cookieStorageKey(b.name),
              },
              {},
            ),
            w(
              "backToTop",
              {
                threshold: 280,
                position: "right",
                bg: "#e5e7eb",
                color: "#111827",
                size: 44,
                shape: "circle",
              },
              {},
            ),
          ],
        ],
        {
          background: "transparent",
          padding: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
        },
      ),
    ];
    },
  },
  {
    id: "block-legal-footer",
    name: "Rodapé legal",
    description: "Afiliado + FDA disclaimer + links de política",
    category: "compliance",
    build: (ctx) => {
      const b = resolvedIdentity(ctx);
      return [
      section(
        [
          [
            w(
              "html",
              {
                code: `<div style="text-align:center;color:#9ca3af;font-size:12px;line-height:1.7;max-width:760px;margin:0 auto">
<p style="margin:0 0 10px;color:#fff;font-weight:800;font-size:18px">${b.name}</p>
<p style="margin:0 0 10px">© ${new Date().getFullYear()} Independent affiliate page. Replace with your company name and address.</p>
<p style="margin:0 0 10px"><strong style="color:#e5e7eb">Affiliate disclosure:</strong> We may earn a commission if you buy through links on this page.</p>
<p style="margin:0 0 14px"><strong style="color:#e5e7eb">FDA disclaimer:</strong> These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. “FDA registered facility” is not the same as FDA approval of the product.</p>
<p style="margin:0">
<a href="/privacidade" style="color:#f5c518;margin:0 8px">Privacy Policy</a> ·
<a href="/termos" style="color:#f5c518;margin:0 8px">Terms of Service</a> ·
<a href="/privacidade" style="color:#f5c518;margin:0 8px">Cookie Policy</a> ·
<a href="${b.offer}" style="color:#f5c518;margin:0 8px">Shipping &amp; Returns</a>
</p>
</div>`,
              },
              {},
            ),
          ],
        ],
        {
          background: "#0a0a0a",
          padding: { desktop: { top: 48, right: 24, bottom: 56, left: 24, unit: "px" } },
        },
      ),
    ];
    },
  },
];

export const SECTION_BLOCK_CATEGORIES: Array<{
  id: SectionBlockDefinition["category"];
  label: string;
}> = [
  { id: "nav", label: "Navegação" },
  { id: "hero", label: "Hero" },
  { id: "proof", label: "Prova / benefícios" },
  { id: "cta", label: "CTA" },
  { id: "compliance", label: "Cookies / legal" },
];

/** Ordem DTC no editor manual (sem abrir o modelo). */
export const VISIVRA_FROM_SCRATCH_RECIPE: string[] = [
  "block-nav-order",
  "block-hero-2col",
  "block-yellow-cta",
  "block-why-band",
  "block-trust-4",
  "block-blue-band",
  "block-benefits-list",
  "block-yellow-cta-soft",
  "block-legal-footer",
  "block-cookie-modal",
];

/** Identidade só para o atalho de catálogo Visivra (página nova vazia). */
export const VISIVRA_PAGE_IDENTITY: PageIdentity = {
  productName: "Visivra™",
  headline: "Visivra : Natural Support for Sharp and Clear Vision",
};

export function buildSectionsFromRecipe(
  recipe: string[] = VISIVRA_FROM_SCRATCH_RECIPE,
  ctx?: PageIdentity,
): SectionNode[] {
  return recipe.flatMap((blockId) => {
    const block = SECTION_BLOCKS.find((b) => b.id === blockId);
    if (!block) throw new Error(`Bloco em falta: ${blockId}`);
    return block.build(ctx);
  });
}

/**
 * Página completa montada bloco a bloco no editor manual.
 * Sem ctx usa «Produto»; o atalho Visivra passa VISIVRA_PAGE_IDENTITY.
 */
export function buildDtcFromScratch(ctx?: PageIdentity): PageDocument {
  const b = resolvedIdentity(ctx);
  return {
    id: id("page_"),
    name: `${b.name} — editor manual`,
    sections: buildSectionsFromRecipe(undefined, ctx),
    settings: { maxContentWidth: 1180, background: "#ffffff" },
    seo: {
      title: b.headline,
      description: "Independent affiliate landing built section by section in the Clickora editor.",
    },
    updatedAt: Date.now(),
  };
}

export function buildVisivraFromScratch(): PageDocument {
  return buildDtcFromScratch(VISIVRA_PAGE_IDENTITY);
}

/** @deprecated use buildVisivraFromScratch — a 1.ª dobra já não é o recorte isolado. */
export function buildVisivraFirstFoldFromScratch(): PageDocument {
  return buildVisivraFromScratch();
}
