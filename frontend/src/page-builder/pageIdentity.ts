import type { PageDocument, WidgetNode } from "./types";

/** Identidade da página que está no editor — blocos novos copiam isto, não um produto de catálogo. */
export type PageIdentity = {
  productName: string;
  headline?: string;
  heroImage?: string;
  offerHref?: string;
  ctaLabel?: string;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function walkWidgets(doc: PageDocument): WidgetNode[] {
  const out: WidgetNode[] = [];
  const visit = (w: WidgetNode) => {
    out.push(w);
    const kids = w.content?.widgets;
    if (Array.isArray(kids)) {
      for (const child of kids) {
        if (child && typeof child === "object" && "type" in child) visit(child as WidgetNode);
      }
    }
  };
  for (const section of doc.sections ?? []) {
    for (const col of section.columns ?? []) {
      for (const w of col.widgets ?? []) visit(w);
    }
  }
  return out;
}

export function identityFromDocument(doc: PageDocument | null | undefined): PageIdentity {
  if (!doc) return { productName: "" };
  const widgets = walkWidgets(doc);
  const heading = widgets.find((w) => w.type === "heading" && asString(w.content.text));
  const image = widgets.find((w) => w.type === "image" && asString(w.content.src));
  const button = widgets.find((w) => w.type === "button" && asString(w.content.href) && asString(w.content.href) !== "#");
  const cta = widgets.find((w) => w.type === "button" && asString(w.content.text));
  return {
    productName: asString(doc.seo?.title) || asString(doc.name) || asString(heading?.content.text),
    headline: asString(heading?.content.text) || asString(doc.seo?.title),
    heroImage: asString(image?.content.src),
    offerHref: asString(button?.content.href),
    ctaLabel: asString(cta?.content.text),
  };
}

export function identityFromPresellContent(
  content: Record<string, unknown>,
  doc?: PageDocument | null,
  pageTitle?: string,
): PageIdentity {
  const fromDoc = identityFromDocument(doc ?? null);
  const images = Array.isArray(content.productImages)
    ? content.productImages.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    : [];
  return {
    productName:
      asString(content.productName) ||
      asString(content.product_name) ||
      asString(content.title) ||
      asString(pageTitle) ||
      fromDoc.productName,
    headline:
      asString(content.sourcePageTitle) ||
      asString(content.source_page_title) ||
      asString(content.title) ||
      fromDoc.headline,
    heroImage: images[0] || fromDoc.heroImage,
    offerHref: asString(content.affiliateLink) || fromDoc.offerHref,
    ctaLabel: asString(content.ctaText) || fromDoc.ctaLabel,
  };
}

export function documentHasImportedFold(doc: PageDocument | null | undefined): boolean {
  if (!doc) return false;
  return walkWidgets(doc).some(
    (w) => w.type === "html" && asString(w.content.code).length > 80,
  );
}

export function resolvedIdentity(ctx?: PageIdentity) {
  const name = (ctx?.productName || "").trim() || "Produto";
  return {
    name,
    headline: (ctx?.headline || "").trim() || name,
    image: (ctx?.heroImage || "").trim(),
    offer: (ctx?.offerHref || "").trim() || "#",
    cta: (ctx?.ctaLabel || "").trim() || "Order Now",
  };
}
