import { describe, expect, it } from "vitest";
import { buildEditablePageDocument, pointOfferButtonsAt } from "./presellVisualEdit";

describe("buildEditablePageDocument", () => {
  it("leva para o editor só o que a presell já tem", () => {
    const doc = buildEditablePageDocument({
      title: "Campanha",
      type: "cookies",
      content: {
        title: "StopWatt",
        subtitle: "Corrente instável.",
        salesText: "O aparelho fica entre a tomada e o equipamento.",
        ctaText: "Ver oferta",
        affiliateLink: "https://offer.example/buy",
        productName: "StopWatt",
        productImages: ["https://cdn.example/pack.jpg", "nota-interna"],
      },
    });
    const widgets = doc.sections[0].columns[0].widgets;
    expect(widgets.map((w) => w.type)).toEqual(["image", "heading", "text", "button", "cookieBanner"]);
    expect(widgets[0].content.src).toBe("https://cdn.example/pack.jpg");
    expect(widgets[1].content.text).toBe("StopWatt");
    expect(String(widgets[2].content.html)).toContain("tomada");
    expect(widgets[2].styles.typography?.desktop?.textAlign).toBe("left");
    expect(widgets[3].content.href).toBe("https://offer.example/buy");
  });

  it("ignora ícones e fotos repetidas e deixa a primeira imagem como capa", () => {
    const doc = buildEditablePageDocument({
      title: "Tea",
      type: "review",
      content: {
        title: "Tea",
        productImages: [
          "https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea.jpg",
          "https://thumb.wikimedia.org/wikipedia/en/thumb/1/1b/Semi-protection-shackle.svg/40px-Semi-protection-shackle.svg.png",
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Longjing_tea.jpg/500px-Longjing_tea.jpg",
          "https://upload.wikimedia.org/wikipedia/commons/e/e3/Camellia.jpg",
        ],
        ctaText: "Continuar",
        affiliateLink: "https://en.wikipedia.org/wiki/Tea",
      },
    });
    const widgets = doc.sections[0].columns[0].widgets;
    const images = widgets.filter((w) => w.type === "image").map((w) => String(w.content.src));
    expect(images).toEqual([
      "https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/e/e3/Camellia.jpg",
    ]);
    expect(widgets[0].type).toBe("image");
    expect(widgets[1].type).toBe("heading");
    expect(widgets.map((w) => w.type).indexOf("button")).toBeLessThan(widgets.map((w) => w.type).lastIndexOf("image"));
  });

  it("o botão único passa a usar o link da oferta", () => {
    const doc = buildEditablePageDocument({
      title: "Tea",
      type: "review",
      content: {
        title: "Tea",
        ctaText: "Continuar",
        affiliateLink: "https://example.com/oferta-preview",
      },
    });
    pointOfferButtonsAt(doc, "https://en.wikipedia.org/wiki/Tea", "https://example.com/oferta-preview");
    const button = doc.sections[0].columns[0].widgets.find((w) => w.type === "button");
    expect(button?.content.href).toBe("https://en.wikipedia.org/wiki/Tea");
  });

  it("não inventa foto nem botão quando esses dados não existem", () => {
    const doc = buildEditablePageDocument({
      title: "Rascunho",
      type: "review",
      content: { title: "Só um título" },
    });
    const types = doc.sections[0].columns[0].widgets.map((w) => w.type);
    expect(types).toEqual(["heading"]);
    expect(types).not.toContain("image");
    expect(types).not.toContain("button");
    expect(types).not.toContain("cookieBanner");
  });
});
