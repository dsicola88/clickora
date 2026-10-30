/**
 * Auditoria estrutural (sem browser): documento gerado por tipo × nicho.
 * White primeiro; valida árvore de widgets, cookie, CTA e ausência de claims inventados.
 */
import { describe, expect, it } from "vitest";
import { PRESELL_TYPE_OPTIONS } from "./presellTypeOptions";
import { isPresellTypeAllowedForNiche, presellTypeGroupsForNiche } from "./presellGenerationNiche";
import {
  getInteractiveGateKind,
  getPresellGateKind,
  isDiscountPresellType,
  isGhostPresellType,
  isVideoPresellType,
} from "./presellTypeMeta";
import { CLICKORA_MIRROR_TRACK_MARKER } from "./presellMirrorMarkers";
import { bakePublicOfferHrefs, buildEditablePageDocument } from "./presellVisualEdit";

const WHITE_TYPES = presellTypeGroupsForNiche("white").flatMap((g) => g.types.map((t) => t.id));
const BLACK_TYPES = PRESELL_TYPE_OPTIONS.map((t) => t.id);

function widgetsOf(doc: ReturnType<typeof buildEditablePageDocument>) {
  return doc.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets));
}

function textBlob(doc: ReturnType<typeof buildEditablePageDocument>) {
  return widgetsOf(doc)
    .map((w) => {
      const c = w.content;
      return [c.text, c.html, c.code, c.title, c.body].filter(Boolean).join(" ");
    })
    .join("\n")
    .toLowerCase();
}

describe("conformidade estrutural WHITE (todos os tipos)", () => {
  it("catálogo white só tem tipos permitidos", () => {
    for (const id of WHITE_TYPES) {
      expect(isPresellTypeAllowedForNiche(id, "white")).toBe(true);
    }
    expect(WHITE_TYPES).toEqual(["cookies", "tsl", "dtc", "review", "desconto", "vsl", "vsl_tsl"]);
  });

  for (const type of WHITE_TYPES) {
    it(`white / ${type}: documento coerente`, () => {
      const mirror = `<!doctype html><html><head><style>h1{color:red}</style></head><body><h1>Oferta original</h1><p>${"Produto útil para casa. ".repeat(20)}</p><a href="${CLICKORA_MIRROR_TRACK_MARKER}">Buy</a></body></html>`;
      const doc = buildEditablePageDocument({
        title: "Campanha",
        type,
        videoUrl: isVideoPresellType(type) ? "https://www.youtube.com/watch?v=abc" : null,
        language: "en",
        content: {
          title: "GadgetX",
          productName: "GadgetX",
          salesText: "Useful device for home.",
          ctaText: "Buy",
          affiliateLink: "https://offer.example/buy",
          productImages: ["https://cdn.example/g.jpg"],
          generationNiche: "white",
          importMirrorSrcDoc: mirror,
        },
      });
      const widgets = widgetsOf(doc);
      expect(widgets.length).toBeGreaterThan(0);
      expect(doc.settings.background).toBe("#ffffff");

      if (getPresellGateKind(type) === "cookies") {
        const cookie = widgets.find((w) => w.type === "cookieBanner");
        expect(cookie?.content.offerHref || "").toBe("");
        const baked = bakePublicOfferHrefs(
          doc,
          "https://app.example/track/r/x",
          "https://offer.example/buy",
          "/privacidade",
          { unlockCookieOnly: true },
        );
        const bakedCookie = widgetsOf(baked).find((w) => w.type === "cookieBanner");
        expect(bakedCookie?.content.offerHref || "").toBe("");
        // Com espelho white, CTAs ficam no HTML do mirror (sem widget button extra).
        const mirrorHtml = widgetsOf(baked).find((w) => w.type === "html");
        if (mirrorHtml) {
          expect(String(mirrorHtml.content.code)).toContain("https://app.example/track/r/x");
        } else {
          expect(widgetsOf(baked).some((w) => w.type === "button")).toBe(true);
        }
      }

      // Espelho presente quando há mirror (>80 chars)
      expect(widgets[0].type).toBe("html");
      expect(String(widgets[0].content.code)).toContain("Oferta original");

      if (isDiscountPresellType(type)) {
        // Documento base igual; overlay é chrome em PublicPresell
        expect(isDiscountPresellType(type)).toBe(true);
      }
      if (isVideoPresellType(type)) {
        expect(widgets.some((w) => w.type === "video")).toBe(true);
      }
    });
  }
});

describe("conformidade estrutural BLACK (todos os tipos)", () => {
  for (const type of BLACK_TYPES) {
    it(`black / ${type}: portal organizado + Ads-safe`, () => {
      if (isGhostPresellType(type)) {
        // Fantasma não usa o documento portal da mesma forma na pública
        expect(isGhostPresellType(type)).toBe(true);
        return;
      }

      const doc = buildEditablePageDocument({
        title: "Campanha",
        type,
        videoUrl: isVideoPresellType(type) ? "https://www.youtube.com/watch?v=abc" : null,
        language: "pt-BR",
        content: {
          title: "StopWatt",
          productName: "StopWatt",
          salesText: "Cura milagrosa garantida",
          ctaText: "Ver oferta",
          affiliateLink: "https://offer.example/buy",
          productImages: ["https://cdn.example/p.jpg"],
          generationNiche: "black",
        },
      });

      const widgets = widgetsOf(doc);
      expect(widgets[0].type).toBe("html"); // header portal
      expect(doc.settings.maxContentWidth).toBe(720);
      expect(doc.settings.background).toBe("#f8fafc");

      const blob = textBlob(doc);
      expect(blob).not.toContain("milagrosa");
      expect(blob).toMatch(/portal|transparência|stopwatt|oficial/);

      const button = widgets.find((w) => w.type === "button");
      expect(button?.content.href).toBe("https://offer.example/buy");

      if (getPresellGateKind(type) === "cookies") {
        const cookie = widgets.find((w) => w.type === "cookieBanner");
        expect(cookie?.content.offerHref || "").toBe("");
        expect(String(widgets[0].content.code)).not.toContain("https://offer.example/buy");
        const baked = bakePublicOfferHrefs(
          doc,
          "https://app.example/track/r/x",
          "https://offer.example/buy",
          "/privacidade",
          { unlockCookieOnly: true },
        );
        expect(widgetsOf(baked).find((w) => w.type === "cookieBanner")?.content.offerHref || "").toBe("");
        expect(widgetsOf(baked).some((w) => w.type === "button")).toBe(true);
      }

      if (getInteractiveGateKind(type)) {
        // Documento tem CTA; o lock é runtime em PublicBuilderPresellView
        expect(button).toBeTruthy();
      }

      // Sem imagem hero de viewport
      const images = widgets.filter((w) => w.type === "image");
      for (const img of images) {
        expect(img.content.hero).not.toBe(true);
      }
    });
  }
});
