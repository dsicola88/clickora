/**
 * Presells DTC editáveis (Nitric Boost / Neotonics) — o afiliado troca textos,
 * imagens, preços e links ponta a ponta no editor manual.
 */
import type { SectionNode, WidgetNode } from "./types";
import { createColumn, createSection, createWidget, id } from "./factory";

type TemplateDefinition = {
  id: string;
  name: string;
  category: "landing" | "presell" | "vsl" | "lead";
  description: string;
  thumbnail: string;
  build: () => SectionNode[];
};

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

function s(
  columnsWidgets: WidgetNode[][],
  sectionStyles: SectionNode["styles"] = {},
  layout: SectionNode["layout"] = "boxed",
  columnWidths?: number[],
  extras?: Partial<Pick<SectionNode, "contentWidth" | "columnGap">>,
): SectionNode {
  const sec = createSection(columnsWidgets.length);
  sec.layout = layout;
  sec.styles = { ...sec.styles, ...sectionStyles };
  if (extras?.contentWidth != null) sec.contentWidth = extras.contentWidth;
  if (extras?.columnGap) sec.columnGap = extras.columnGap;
  const n = columnsWidgets.length;
  sec.columns = columnsWidgets.map((widgets, i) => {
    const pct = columnWidths?.[i] ?? Math.floor(100 / Math.max(n, 1));
    const col = createColumn(pct);
    col.widgets = widgets;
    col.widthPercent = { desktop: pct, tablet: n > 1 ? 100 : pct, mobile: 100 };
    return col;
  });
  return sec;
}

function heading(
  text: string,
  opts: {
    tag?: string;
    size?: number;
    color?: string;
    align?: "left" | "center" | "right";
    weight?: number;
    mb?: number;
    cssId?: string;
  } = {},
) {
  return w(
    "heading",
    { text, tag: opts.tag ?? "h2" },
    {
      typography: {
        desktop: {
          fontSize: opts.size ?? 28,
          fontWeight: opts.weight ?? 800,
          lineHeight: 1.2,
          letterSpacing: -0.2,
          textAlign: opts.align ?? "center",
          textTransform: "none",
        },
      },
      color: opts.color ?? "#111827",
      margin: { desktop: { top: 0, right: 0, bottom: opts.mb ?? 16, left: 0, unit: "px" } },
    },
    opts.cssId ? { cssId: opts.cssId } : undefined,
  );
}

function para(html: string, color = "#374151", align: "left" | "center" = "left") {
  return w(
    "text",
    { html },
    {
      typography: {
        desktop: {
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.75,
          letterSpacing: 0,
          textAlign: align,
          textTransform: "none",
        },
      },
      color,
      margin: { desktop: { top: 0, right: 0, bottom: 14, left: 0, unit: "px" } },
    },
  );
}

function cta(text: string, href: string, bg: string, color: string, cssId?: string) {
  return w(
    "button",
    { text, href, iconName: "ShoppingCart", iconPosition: "right", iconSize: 18 },
    {
      typography: {
        desktop: {
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: 0.4,
          textAlign: "center",
          textTransform: "uppercase",
        },
      },
      color,
      background: bg,
      padding: { desktop: { top: 16, right: 36, bottom: 16, left: 36, unit: "px" } },
      border: { width: 0, style: "solid", color: "#000", radius: 999 },
      align: { desktop: "center" },
      boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
    },
    cssId ? { cssId } : undefined,
  );
}

function stickyNav(opts: {
  brand: string;
  items: { label: string; href: string }[];
  cta: string;
  ctaHref: string;
  ctaBg: string;
  ink?: string;
  barBg?: string;
}) {
  const ink = opts.ink ?? "#0a0a0a";
  const logo = w(
    "heading",
    { text: opts.brand, tag: "h2" },
    {
      typography: {
        desktop: {
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: -0.3,
          textAlign: "left",
          textTransform: "none",
        },
      },
      color: ink,
      width: { desktop: "auto" },
      flexShrink: { desktop: 0 },
      margin: { desktop: { top: 0, right: 12, bottom: 0, left: 0, unit: "px" } },
    },
  );
  const menu = w(
    "navMenu",
    {
      align: "right",
      color: ink,
      hoverColor: opts.ctaBg,
      fontSize: 14,
      fontWeight: 600,
      gap: 18,
      underlineOnHover: false,
      items: opts.items.map((item) => ({ id: id("nav_"), ...item })),
    },
    { flexGrow: { desktop: 1 }, flexShrink: { desktop: 1 } },
  );
  const btn = w(
    "button",
    { text: opts.cta, href: opts.ctaHref, iconName: "ShoppingCart", iconPosition: "right", iconSize: 16 },
    {
      typography: {
        desktop: {
          fontSize: 14,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: 0.2,
          textAlign: "center",
          textTransform: "none",
        },
      },
      color: "#111",
      background: opts.ctaBg,
      padding: { desktop: { top: 12, right: 20, bottom: 12, left: 20, unit: "px" } },
      border: { width: 0, style: "solid", color: "#000", radius: 999 },
      align: { desktop: "right" },
      flexShrink: { desktop: 0 },
    },
  );
  const bar = createWidget("container");
  bar.content = {
    ...bar.content,
    direction: "row",
    justify: "space-between",
    align: "center",
    wrap: "wrap",
    gap: 12,
    widgets: [logo, menu, btn],
  };
  return s(
    [[bar]],
    {
      background: opts.barBg ?? "#ffffff",
      padding: { desktop: { top: 12, right: 20, bottom: 12, left: 20, unit: "px" } },
      boxShadow: "0 1px 0 rgba(15,23,42,0.12)",
      position: { desktop: "sticky" },
      top: { desktop: "0" },
      zIndex: { desktop: 200 },
    },
    "boxed",
    [100],
    { contentWidth: 1140 },
  );
}

function band(title: string, bg: string, color = "#ffffff", cssId?: string) {
  return s(
    [[heading(title, { size: 22, color, weight: 800, mb: 0, cssId })]],
    { background: bg, padding: { desktop: { top: 18, right: 16, bottom: 18, left: 16, unit: "px" } } },
    "full",
  );
}

function legalFooter(brand: string, bg: string) {
  return s(
    [
      [
        w(
          "html",
          {
            code: `<div style="text-align:center;color:#9ca3af;font-size:12px;line-height:1.7;max-width:760px;margin:0 auto">
<p style="margin:0 0 10px;color:#fff;font-weight:800;font-size:18px">${brand}</p>
<p style="margin:0 0 10px">© ${new Date().getFullYear()} Independent affiliate page. Replace with your company name and address.</p>
<p style="margin:0 0 10px"><strong style="color:#e5e7eb">Affiliate disclosure:</strong> We may earn a commission if you buy through links on this page.</p>
<p style="margin:0 0 14px"><strong style="color:#e5e7eb">FDA disclaimer:</strong> These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.</p>
<p style="margin:0">
<a href="/privacidade" style="color:#f5d76e;margin:0 8px">Privacy Policy</a> ·
<a href="/termos" style="color:#f5d76e;margin:0 8px">Terms</a> ·
<a href="/privacidade" style="color:#f5d76e;margin:0 8px">Cookies</a>
</p>
</div>`,
          },
          {},
        ),
      ],
    ],
    { background: bg, padding: { desktop: { top: 48, right: 20, bottom: 56, left: 20, unit: "px" } } },
  );
}

function cookieAndTop(storageKey: string) {
  return s(
    [
      [
        w(
          "cookieBanner",
          {
            title: "We Value Your Privacy",
            body: "We use cookies to enhance your browsing experience and analyze site traffic. By clicking Accept All, you consent to our use of cookies.",
            allowLabel: "ACCEPT ALL",
            declineLabel: "Manage Preferences",
            policyLabel: "Cookie Policy",
            policyUrl: "/privacidade",
            accentColor: "#2563eb",
            variant: "modal",
            backdrop: true,
            storageKey,
          },
          {},
        ),
        w("backToTop", { threshold: 280, position: "right", bg: "#e5e7eb", color: "#111827", size: 44, shape: "circle" }, {}),
      ],
    ],
    { background: "transparent", padding: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } } },
  );
}

function pack(
  bottles: string,
  price: string,
  per: string,
  badge: string,
  highlight: boolean,
  ctaBg: string,
  productImg: string,
) {
  const table = w(
    "priceTable",
    {
      badge,
      title: bottles,
      subtitle: per,
      currency: "$",
      price,
      period: "",
      features: [
        { id: id("pf_"), text: "Free shipping (edit)", included: true },
        { id: id("pf_"), text: "Money-back guarantee (edit)", included: true },
        { id: id("pf_"), text: "Replace with your offer bullets", included: true },
      ],
      ctaText: "BUY NOW",
      ctaHref: "#offer",
      highlighted: highlight,
      cardBg: highlight ? "#fffbeb" : "#ffffff",
      textColor: "#111827",
      accentColor: ctaBg,
      ctaBg,
      ctaColor: "#111111",
      borderRadius: 16,
    },
    {},
  );
  const photo = w(
    "image",
    { src: productImg, alt: `${bottles} — replace with pack photo`, link: "#offer" },
    {
      align: { desktop: "center" },
      border: { width: 0, style: "solid", color: "#000", radius: 12 },
      margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
    },
  );
  return [photo, table];
}

function copyBlock(html: string, bg: string, color = "#1f2937") {
  return s(
    [[para(html, color)]],
    { background: bg, padding: { desktop: { top: 28, right: 28, bottom: 28, left: 28, unit: "px" } } },
    "boxed",
    [100],
    { contentWidth: 760 },
  );
}

const IMG_BOTTLE = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=700&q=80";
const IMG_DOC = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80";
const IMG_DOC2 = "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80";
const IMG_POUCH = "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=700&q=80";
const IMG_HERB = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80";

export const presellNitricBoostTemplate: TemplateDefinition = {
  id: "presell-nitric-boost",
  name: "Presell — Nitric Boost (vitalidade)",
  category: "presell",
  description:
    "Landing escura editável: menu, garantia, médicos, copy, ingredientes, 3 packs, FAQ e cookies. Troque nome, imagens e link da oferta.",
  thumbnail: IMG_BOTTLE,
  build: () => {
    const navy = "#0e3a38";
    const cream = "#f6f1de";
    const gold = "#f0c94a";
    return [
      stickyNav({
        brand: "Nitric Boost™",
        items: [
          { label: "How it works", href: "#how" },
          { label: "Ingredients", href: "#ingredients" },
          { label: "Offer", href: "#offer" },
        ],
        cta: "Order Now",
        ctaHref: "#offer",
        ctaBg: gold,
        ink: "#ffffff",
        barBg: navy,
      }),
      s(
        [
          [
            w(
              "image",
              { src: IMG_BOTTLE, alt: "Nitric Boost bottle — replace with your product", link: "#offer" },
              { align: { desktop: "center" }, border: { width: 0, style: "solid", color: "#000", radius: 12 } },
            ),
          ],
          [
            heading("Boost Your Sexual Vitality", {
              tag: "h1",
              size: 36,
              color: "#ffffff",
              align: "left",
              cssId: "how",
            }),
            para(
              "<p>Independent affiliate landing. Edit this headline and body to match your offer. Designed for men who want to support energy, circulation and intimacy as part of a healthy lifestyle. Individual results vary.</p>",
              "#d1fae5",
            ),
            cta("ORDER NOW", "#offer", gold, "#111111"),
          ],
        ],
        { background: navy, padding: { desktop: { top: 36, right: 24, bottom: 40, left: 24, unit: "px" } } },
        "boxed",
        [40, 60],
        { contentWidth: 1100, columnGap: { desktop: 28 } },
      ),
      s(
        [[heading("100% Quality Assurance", { size: 22, color: navy, mb: 8 })]],
        { background: cream, padding: { desktop: { top: 22, right: 16, bottom: 8, left: 16, unit: "px" } } },
      ),
      s(
        [
          [
            w(
              "html",
              {
                code: `<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;align-items:center;padding:8px 0 16px">
${["USA", "GMP", "NATURAL", "LAB TESTED", "NON-GMO", "60-DAY"].map((t) => `<div style="width:84px;height:84px;border-radius:50%;border:3px solid ${navy};background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:.04em;text-align:center;color:${navy};padding:8px">${t}</div>`).join("")}
</div>`,
              },
              {},
            ),
          ],
        ],
        { background: cream, padding: { desktop: { top: 0, right: 16, bottom: 28, left: 16, unit: "px" } } },
      ),
      s(
        [
          [
            w("image", { src: IMG_DOC, alt: "Specialist photo — replace" }, { border: { width: 0, style: "solid", color: "#000", radius: 8 } }),
            para("<p style='text-align:center'><strong>Replace name</strong><br/>Edit role / quote in the text widget.</p>", "#4b5563", "center"),
          ],
          [
            w("image", { src: IMG_DOC2, alt: "Specialist photo — replace" }, { border: { width: 0, style: "solid", color: "#000", radius: 8 } }),
            para("<p style='text-align:center'><strong>Replace name</strong><br/>Edit role / quote in the text widget.</p>", "#4b5563", "center"),
          ],
        ],
        { background: cream, padding: { desktop: { top: 8, right: 20, bottom: 36, left: 20, unit: "px" } } },
        "boxed",
        [50, 50],
      ),
      band("WHAT IS NITRIC BOOST?", navy),
      copyBlock(
        "<p><strong>Nitric Boost</strong> is a dietary supplement you fully rewrite here. Describe who it is for, the daily routine, and why men look for vitality and circulation support. Keep claims compliant. Individual results vary.</p><p>Use 2–4 short paragraphs. Link every CTA to your checkout.</p>",
        cream,
      ),
      band("HOW DOES IT WORK?", navy),
      copyBlock(
        "<p>Explain the mechanism in plain language (circulation, nitric oxide support, energy). Replace this advertorial copy. This product is not intended to diagnose, treat, cure, or prevent any disease.</p>",
        cream,
      ),
      band("WHY YOU SHOULD CHOOSE NITRIC BOOST", navy, "#ffffff", "ingredients"),
      s(
        [
          [
            w(
              "html",
              {
                code: `<div style="max-width:460px;margin:0 auto;background:radial-gradient(circle at 40% 30%,#1a5c58,${navy});border-radius:28px;padding:32px 24px;color:#fff;text-align:center;box-shadow:0 16px 40px rgba(14,58,56,.35)">
<p style="font-size:12px;letter-spacing:.16em;font-weight:800;margin:0 0 16px">CORE FORMULA</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;font-weight:700">
<span>L-Citrulline</span><span>L-Arginine</span><span>Ginseng</span><span>Zinc</span>
</div>
<p style="margin:16px 0 0;font-size:11px;opacity:.75">Replace this panel with your formula graphic.</p>
</div>`,
              },
              {},
            ),
          ],
        ],
        { background: cream, padding: { desktop: { top: 28, right: 20, bottom: 12, left: 20, unit: "px" } } },
      ),
      s(
        [
          [
            w(
              "iconList",
              {
                iconSize: 16,
                iconColor: "#ffffff",
                iconBg: navy,
                iconShape: "circle",
                gap: 16,
                titleColor: "#111827",
                descColor: "#4b5563",
                items: [
                  { id: id("il_"), iconName: "check", title: "Daily vitality support:", description: "<p>Edit this benefit.</p>", href: "" },
                  { id: id("il_"), iconName: "check", title: "Simple routine:", description: "<p>Edit this benefit.</p>", href: "" },
                  { id: id("il_"), iconName: "check", title: "Manufactured with quality checks:", description: "<p>Edit this benefit.</p>", href: "" },
                ],
              },
              {},
            ),
          ],
        ],
        { background: cream, padding: { desktop: { top: 8, right: 28, bottom: 36, left: 28, unit: "px" } } },
        "boxed",
        [100],
        { contentWidth: 760 },
      ),
      band("THE BOTTOM LINE", navy),
      copyBlock(
        "<p>Summarize why someone would order today. Edit this block. Repeat the CTA below.</p>",
        cream,
      ),
      s(
        [[cta("ORDER NOW", "#offer", gold, "#111111")]],
        { background: cream, padding: { desktop: { top: 0, right: 16, bottom: 28, left: 16, unit: "px" } } },
      ),
      band("CHOOSE YOUR PACKAGE", navy),
      s(
        [
          pack("1 BOTTLE", "69", "30-day supply", "", false, gold, IMG_BOTTLE),
          pack("3 BOTTLES", "49", "Best value · per bottle", "MOST POPULAR", true, gold, IMG_BOTTLE),
          pack("6 BOTTLES", "39", "Lowest price · per bottle", "BEST DEAL", false, gold, IMG_BOTTLE),
        ],
        { background: cream, padding: { desktop: { top: 36, right: 16, bottom: 16, left: 16, unit: "px" } } },
        "boxed",
        [33, 34, 33],
        { contentWidth: 1100 },
      ),
      s(
        [[cta("GET A DISCOUNT NOW", "#offer", gold, "#111111", "offer")]],
        { background: cream, padding: { desktop: { top: 8, right: 16, bottom: 36, left: 16, unit: "px" } } },
      ),
      s(
        [
          [
            heading("60-Day Money-Back Guarantee", { size: 24, color: navy }),
            para(
              "<p>Edit the guarantee: unused bottles, refund window, and how to contact support. This is placeholder copy for the affiliate to replace.</p>",
              "#374151",
              "center",
            ),
          ],
        ],
        { background: "#fff7cc", padding: { desktop: { top: 32, right: 24, bottom: 32, left: 24, unit: "px" } } },
      ),
      s(
        [
          [
            heading("Frequently Asked Questions", { size: 24, color: navy }),
            w(
              "faq",
              {
                items: [
                  { id: id("q_"), question: "How do I take it?", answer: "<p>Replace with serving size and timing from the label.</p>" },
                  { id: id("q_"), question: "When will I notice a difference?", answer: "<p>Individual results vary. Edit this answer.</p>" },
                  { id: id("q_"), question: "Is there a guarantee?", answer: "<p>Describe your 60-day policy.</p>" },
                  { id: id("q_"), question: "Where is it made?", answer: "<p>Replace with facility / country of manufacture.</p>" },
                ],
                allowMultiple: false,
                defaultOpen: 0,
                itemBg: "#ffffff",
                itemBorderColor: "#d6d3c4",
                questionColor: navy,
                answerColor: "#4b5563",
                accentColor: gold,
              },
              {},
            ),
          ],
        ],
        { background: cream, padding: { desktop: { top: 36, right: 24, bottom: 40, left: 24, unit: "px" } } },
        "boxed",
        [100],
        { contentWidth: 760 },
      ),
      legalFooter("Nitric Boost™", navy),
      cookieAndTop("clickora-cookie-nitric-boost"),
    ];
  },
};

export const presellNeotonicsTemplate: TemplateDefinition = {
  id: "presell-neotonics",
  name: "Presell — Neotonics (pele & intestino)",
  category: "presell",
  description:
    "Landing clara editável: selos, grelha de ingredientes, selo dourado, médico, depoimentos, 2 packs, garantia, FAQ e cookies.",
  thumbnail: IMG_POUCH,
  build: () => {
    const purple = "#6b3d91";
    const gold = "#c9a227";
    const ink = "#1f1630";
    return [
      stickyNav({
        brand: "Neotonics™",
        items: [
          { label: "Ingredients", href: "#ingredients" },
          { label: "Reviews", href: "#reviews" },
          { label: "FAQ", href: "#faq" },
        ],
        cta: "Order Now",
        ctaHref: "#offer",
        ctaBg: gold,
        ink,
        barBg: "#ffffff",
      }),
      s(
        [
          [
            w(
              "html",
              {
                code: `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center">${["GMP", "USA MADE", "NATURAL", "LAB TESTED", "GLUTEN FREE", "NON-GMO"].map((t) => `<div style="width:78px;height:78px;border-radius:50%;border:2px solid ${purple};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;letter-spacing:.03em;text-align:center;color:${purple};padding:6px;background:#fff">${t}</div>`).join("")}</div>`,
              },
              {},
            ),
          ],
        ],
        { background: "#ffffff", padding: { desktop: { top: 16, right: 16, bottom: 0, left: 16, unit: "px" } } },
      ),
      s(
        [
          [
            w(
              "image",
              { src: IMG_POUCH, alt: "Neotonics pouch — replace with your product", link: "#offer" },
              { align: { desktop: "center" }, border: { width: 0, style: "solid", color: "#000", radius: 16 } },
            ),
          ],
          [
            heading("NEOTONICS", { tag: "h1", size: 40, color: purple, align: "left", mb: 8 }),
            heading("The Gut–Skin Connection", { tag: "h2", size: 26, color: ink, align: "left", weight: 700 }),
            para(
              "<p>Edit this advertorial: how inner balance can support a clearer-looking complexion. Independent affiliate page — not the manufacturer. Individual results vary.</p>",
              "#4b5563",
            ),
            cta("ORDER NOW", "#offer", gold, "#111111"),
          ],
        ],
        { background: "#ffffff", padding: { desktop: { top: 24, right: 24, bottom: 36, left: 24, unit: "px" } } },
        "boxed",
        [46, 54],
        { contentWidth: 1100, columnGap: { desktop: 28 } },
      ),
      s(
        [
          [
            heading("6 SKIN + DIGESTIVE INGREDIENTS", { size: 18, color: purple, cssId: "ingredients" }),
            w(
              "html",
              {
                code: `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;max-width:640px;margin:0 auto">
${["Hyaluronic acid", "Biotin", "Collagen support", "Probiotic blend", "Green botanicals", "Zinc"].map((name) => `<div style="text-align:center"><img src="${IMG_HERB}" alt="${name}" style="width:92px;height:92px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block"/><p style="margin:0;font-size:12px;font-weight:700;color:${ink}">${name}</p></div>`).join("")}
</div>
<p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0">Replace photos and names with your formula.</p>`,
              },
              {},
            ),
          ],
        ],
        { background: "#faf7ff", padding: { desktop: { top: 36, right: 20, bottom: 40, left: 20, unit: "px" } } },
      ),
      s(
        [
          [
            w("image", { src: IMG_POUCH, alt: "Product in use — replace" }, { border: { width: 0, style: "solid", color: "#000", radius: 12 } }),
          ],
          [
            heading("Daily gummies, simple habit", { size: 26, color: ink, align: "left" }),
            para(
              "<p>Rewrite: serving, taste, and when to take it. Keep this section educational. Add your own lifestyle photos.</p>",
              "#4b5563",
            ),
          ],
        ],
        { background: "#ffffff", padding: { desktop: { top: 36, right: 24, bottom: 36, left: 24, unit: "px" } } },
        "boxed",
        [48, 52],
      ),
      s(
        [
          [
            w(
              "html",
              {
                code: `<div style="text-align:center;padding:12px 0">
<div style="width:160px;height:160px;margin:0 auto 16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f5e7a3,${gold} 55%,#8a7010);border:8px solid #5c4a0c;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(0,0,0,.2)">
<span style="color:#3f2f04;font-size:13px;font-weight:800;letter-spacing:.04em;line-height:1.25;padding:16px">KEY TO A RADIANT LOOK</span>
</div>
<p style="margin:0;color:${ink};font-size:15px">Edit this seal and the promise below. Not a disease treatment claim.</p>
</div>`,
              },
              {},
            ),
          ],
        ],
        { background: "#1a1224", padding: { desktop: { top: 36, right: 20, bottom: 36, left: 20, unit: "px" } } },
        "full",
      ),
      s(
        [
          [
            w("image", { src: IMG_DOC, alt: "Expert photo — replace" }, { border: { width: 0, style: "solid", color: "#000", radius: 12 } }),
          ],
          [
            heading("Meet the expert (edit name)", { size: 24, color: ink, align: "left" }),
            para(
              "<p>Placeholder quote from a practitioner. Replace with a real, permitted testimonial or remove this block.</p>",
              "#4b5563",
            ),
          ],
        ],
        { background: "#ffffff", padding: { desktop: { top: 36, right: 24, bottom: 24, left: 24, unit: "px" } } },
        "boxed",
        [40, 60],
      ),
      s(
        [
          [
            heading("A visible difference starts within", { size: 26, color: ink, align: "left" }),
            para(
              "<p>Second lifestyle block: routines, photos of skin-looking glow in a compliant way (appearance, not disease). Swap image and copy in the editor.</p>",
              "#4b5563",
            ),
          ],
          [
            w("image", { src: IMG_HERB, alt: "Lifestyle photo — replace" }, { border: { width: 0, style: "solid", color: "#000", radius: 12 } }),
          ],
        ],
        { background: "#faf7ff", padding: { desktop: { top: 28, right: 24, bottom: 28, left: 24, unit: "px" } } },
        "boxed",
        [52, 48],
      ),
      s(
        [
          [
            heading("What customers say", { size: 24, color: ink, cssId: "reviews" }),
            w(
              "testimonials",
              {
                items: [
                  { id: id("t_"), name: "Name 1", role: "Verified buyer", avatar: "", quote: "Replace with a real review you are allowed to use.", rating: 5 },
                  { id: id("t_"), name: "Name 2", role: "Verified buyer", avatar: "", quote: "Second placeholder review.", rating: 5 },
                  { id: id("t_"), name: "Name 3", role: "Verified buyer", avatar: "", quote: "Third placeholder review.", rating: 4 },
                ],
                autoplay: true,
                intervalMs: 6000,
                showStars: true,
                showAvatars: true,
                cardBg: "#faf7ff",
                textColor: ink,
                accentColor: gold,
              },
              {},
            ),
          ],
        ],
        { background: "#faf7ff", padding: { desktop: { top: 32, right: 20, bottom: 36, left: 20, unit: "px" } } },
      ),
      band("THE GUT–SKIN CONNECTION", purple),
      s(
        [
          [
            para(
              "<p>Long-form educational copy: microbiome, digestion comfort, and appearance of skin. Rewrite for your geo and compliance rules.</p>",
              "#374151",
            ),
          ],
        ],
        { background: "#ffffff", padding: { desktop: { top: 28, right: 28, bottom: 28, left: 28, unit: "px" } } },
        "boxed",
        [100],
        { contentWidth: 720 },
      ),
      s(
        [
          pack("6 POUCHES", "49", "Most popular", "BEST VALUE", true, gold, IMG_POUCH),
          pack("3 POUCHES", "59", "Starter pack", "", false, gold, IMG_POUCH),
        ],
        { background: "#fffdf5", padding: { desktop: { top: 36, right: 16, bottom: 12, left: 16, unit: "px" } } },
        "boxed",
        [50, 50],
        { contentWidth: 900 },
      ),
      s(
        [[cta("BUY NOW", "#offer", gold, "#111111", "offer")]],
        { background: "#fffdf5", padding: { desktop: { top: 8, right: 16, bottom: 28, left: 16, unit: "px" } } },
      ),
      s(
        [
          [
            heading("100% Money-Back Guarantee", { size: 24, color: "#ffffff" }),
            para(
              "<p>Edit refund rules. Purple band matches the original layout — change colors in the section styles.</p>",
              "#e9d5ff",
              "center",
            ),
          ],
        ],
        { background: purple, padding: { desktop: { top: 32, right: 20, bottom: 32, left: 20, unit: "px" } } },
        "full",
      ),
      s(
        [
          [
            heading("Frequently Asked Questions", { size: 24, color: ink, cssId: "faq" }),
            w(
              "faq",
              {
                items: [
                  { id: id("q_"), question: "Are these gummies or capsules?", answer: "<p>Replace with your product format.</p>" },
                  { id: id("q_"), question: "How many per day?", answer: "<p>Replace with label directions.</p>" },
                  { id: id("q_"), question: "Can I take it with other supplements?", answer: "<p>Direct readers to a healthcare professional.</p>" },
                  { id: id("q_"), question: "What is the guarantee?", answer: "<p>Describe the 60-day window.</p>" },
                ],
                allowMultiple: true,
                defaultOpen: 0,
                itemBg: "#ffffff",
                itemBorderColor: "#e9d5ff",
                questionColor: ink,
                answerColor: "#4b5563",
                accentColor: purple,
              },
              {},
            ),
          ],
        ],
        { background: "#ffffff", padding: { desktop: { top: 36, right: 24, bottom: 36, left: 24, unit: "px" } } },
        "boxed",
        [100],
        { contentWidth: 760 },
      ),
      s(
        [
          pack("6 POUCHES", "49", "Repeat offer", "POPULAR", true, gold, IMG_POUCH),
          pack("3 POUCHES", "59", "Repeat offer", "", false, gold, IMG_POUCH),
        ],
        { background: "#fffdf5", padding: { desktop: { top: 24, right: 16, bottom: 16, left: 16, unit: "px" } } },
        "boxed",
        [50, 50],
        { contentWidth: 900 },
      ),
      s(
        [
          [
            w(
              "html",
              {
                code: `<p style="text-align:center;font-size:11px;letter-spacing:.12em;font-weight:800;color:#6b7280;margin:0 0 10px">SECURE CHECKOUT</p>
<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center">
${["VISA", "MASTERCARD", "AMEX", "PAYPAL", "PCI"].map((t) => `<span style="border:1px solid #d1d5db;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:800;color:#374151;background:#fff">${t}</span>`).join("")}
</div>
<p style="text-align:center;font-size:11px;color:#9ca3af;margin:10px 0 0">Replace with your processor badges.</p>`,
              },
              {},
            ),
          ],
        ],
        { background: "#ffffff", padding: { desktop: { top: 12, right: 16, bottom: 28, left: 16, unit: "px" } } },
      ),
      legalFooter("Neotonics™", "#111827"),
      cookieAndTop("clickora-cookie-neotonics"),
    ];
  },
};
