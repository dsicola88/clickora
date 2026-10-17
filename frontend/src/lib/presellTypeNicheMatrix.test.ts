import { describe, expect, it } from "vitest";
import { PRESELL_TYPE_OPTIONS } from "./presellTypeOptions";
import {
  coercePresellTypeForNiche,
  isPresellTypeAllowedForNiche,
  presellTypeGroupsForNiche,
} from "./presellGenerationNiche";
import { getInteractiveGateKind, getPresellGateKind, isGhostPresellType } from "./presellTypeMeta";
import { bakePublicOfferHrefs, buildEditablePageDocument } from "./presellVisualEdit";

const WHITE_ONLY_EXCLUDED = [
  "fantasma",
  "sexo",
  "idade",
  "idade_sexo",
  "idade_pais",
  "sexo_pais",
  "grupo_homem",
  "grupo_mulher",
  "pais",
  "captcha",
  "modelos",
] as const;

describe("matriz tipo × nicho", () => {
  it("lista canónica cobre todos os tipos do combobox", () => {
    const ids = PRESELL_TYPE_OPTIONS.map((t) => t.id);
    expect(ids).toEqual([
      "cookies",
      "fantasma",
      "tsl",
      "dtc",
      "review",
      "desconto",
      "vsl",
      "vsl_tsl",
      "sexo",
      "idade",
      "idade_sexo",
      "idade_pais",
      "sexo_pais",
      "grupo_homem",
      "grupo_mulher",
      "pais",
      "captcha",
      "modelos",
    ]);
  });

  it("black permite todos; white exclui fantasma e gates demográficos", () => {
    for (const t of PRESELL_TYPE_OPTIONS) {
      expect(isPresellTypeAllowedForNiche(t.id, "black")).toBe(true);
    }
    for (const id of WHITE_ONLY_EXCLUDED) {
      expect(isPresellTypeAllowedForNiche(id, "white")).toBe(false);
      expect(coercePresellTypeForNiche(id, "white")).toBe("tsl");
    }
    const whiteIds = presellTypeGroupsForNiche("white").flatMap((g) => g.types.map((t) => t.id));
    expect(whiteIds).not.toContain("fantasma");
    expect(whiteIds).not.toContain("idade");
    expect(whiteIds).toContain("cookies");
    expect(whiteIds).toContain("review");
  });

  it("cada tipo tem gate/meta coerente", () => {
    expect(getPresellGateKind("cookies")).toBe("cookies");
    expect(isGhostPresellType("fantasma")).toBe(true);
    expect(getInteractiveGateKind("idade")).toBe("age");
    expect(getInteractiveGateKind("pais")).toBe("country");
    expect(getInteractiveGateKind("sexo")).toBe("sex");
    expect(getInteractiveGateKind("captcha")).toBe("captcha");
    expect(getInteractiveGateKind("modelos")).toBe("models");
    expect(getInteractiveGateKind("cookies")).toBeNull();
    expect(getInteractiveGateKind("review")).toBeNull();
  });

  it("black cookies: portal + CTA na página; cookie sem offerHref", () => {
    for (const type of ["cookies", "idade", "pais", "review", "vsl", "desconto"] as const) {
      const doc = buildEditablePageDocument({
        title: "Campanha",
        type,
        language: "pt-BR",
        content: {
          title: "ProdutoX",
          productName: "ProdutoX",
          affiliateLink: "https://offer.example/buy",
          productImages: ["https://cdn.example/p.jpg"],
          generationNiche: "black",
        },
      });
      expect(doc.sections[0].columns[0].widgets[0].type).toBe("html");
      const widgets = doc.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets));
      const button = widgets.find((w) => w.type === "button");
      expect(button?.content.href).toBe("https://offer.example/buy");
      if (type === "cookies") {
        const cookie = widgets.find((w) => w.type === "cookieBanner");
        expect(cookie).toBeTruthy();
        expect(cookie?.content.offerHref || "").toBe("");
        expect(String(doc.sections[0].columns[0].widgets[0].content.code)).not.toContain(
          "https://offer.example/buy",
        );
        const baked = bakePublicOfferHrefs(
          doc,
          "https://app.example/track/r/x",
          "https://offer.example/buy",
          "/privacidade",
          { unlockCookieOnly: true },
        );
        const bakedCookie = baked.sections
          .flatMap((s) => s.columns.flatMap((c) => c.widgets))
          .find((w) => w.type === "cookieBanner");
        expect(bakedCookie?.content.offerHref || "").toBe("");
        expect(
          baked.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets)).some((w) => w.type === "button"),
        ).toBe(true);
      }
    }
  });

  it("white cookies: CTA na página; cookie sem hoplink", () => {
    const doc = buildEditablePageDocument({
      title: "Campanha",
      type: "cookies",
      content: {
        title: "Gadget",
        affiliateLink: "https://offer.example/buy",
        productImages: ["https://cdn.example/p.jpg"],
        generationNiche: "white",
      },
    });
    const cookie = doc.sections
      .flatMap((s) => s.columns.flatMap((c) => c.widgets))
      .find((w) => w.type === "cookieBanner");
    expect(cookie?.content.offerHref || "").toBe("");
    expect(
      doc.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets)).some((w) => w.type === "button"),
    ).toBe(true);
    expect(doc.settings.background).toBe("#ffffff");
  });
});
