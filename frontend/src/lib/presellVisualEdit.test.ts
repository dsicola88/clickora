import { describe, expect, it } from "vitest";
import { CLICKORA_MIRROR_TRACK_MARKER } from "./presellMirrorMarkers";
import {
  bakePublicOfferHrefs,
  buildEditablePageDocument,
  mirrorSrcDocToEditableHtml,
  pointOfferButtonsAt,
  resolvePresellPageDocument,
} from "./presellVisualEdit";

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
        generationNiche: "black",
      },
    });
    const fold = doc.sections[0];
    expect(fold.columns[0].widgets.map((w) => w.type)).toEqual(["image"]);
    expect(fold.columns[1].widgets.map((w) => w.type)).toEqual(["heading", "text", "button"]);
    expect(fold.columns[0].widgets[0].content.src).toBe("https://cdn.example/pack.jpg");
    expect(fold.columns[0].widgets[0].content.hero).toBe(true);
    expect(fold.columns[1].widgets[0].content.text).toBe("StopWatt");
    expect(fold.columns[1].widgets[0].styles.typography?.desktop?.fontSize).toBe(52);
    expect(String(fold.columns[1].widgets[1].content.html)).toContain("tomada");
    expect(fold.columns[1].widgets[2].content.href).toBe("https://offer.example/buy");
    const cookie = doc.sections[1].columns[0].widgets[0];
    expect(cookie.type).toBe("cookieBanner");
    expect(cookie.content.offerHref).toBe("https://offer.example/buy");
    expect(cookie.content.policyUrl).toBe("/privacidade");
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
    const images = doc.sections
      .flatMap((s) => s.columns.flatMap((c) => c.widgets))
      .filter((w) => w.type === "image")
      .map((w) => String(w.content.src));
    expect(images).toEqual([
      "https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/e/e3/Camellia.jpg",
    ]);
    expect(doc.sections[0].columns[0].widgets[0].type).toBe("image");
    expect(doc.sections[0].columns[1].widgets[0].type).toBe("heading");
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
    const button = doc.sections
      .flatMap((s) => s.columns.flatMap((c) => c.widgets))
      .find((w) => w.type === "button");
    expect(button?.content.href).toBe("https://en.wikipedia.org/wiki/Tea");
  });

  it("aceita foto em data URL para a dobra", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const doc = buildEditablePageDocument({
      title: "Campanha",
      type: "cookies",
      content: {
        title: "StopWatt",
        productImages: [png],
        generationNiche: "black",
      },
    });
    expect(doc.sections[0].columns[0].widgets[0].content.src).toBe(png);
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

  it("usa o HTML do espelho como primeira dobra quando o import guardou a página", () => {
    const srcdoc = `<!doctype html><html><head><style>h1{color:red}</style></head><body><h1 onclick="alert(1)">Oferta original</h1><script>alert(1)</script><a href="${CLICKORA_MIRROR_TRACK_MARKER}">Comprar</a></body></html>`;
    const html = mirrorSrcDocToEditableHtml(srcdoc);
    expect(html).toContain("h1{color:red}");
    expect(html).toContain("Oferta original");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("alert(1)");
    const doc = buildEditablePageDocument({
      title: "Campanha",
      type: "cookies",
      content: {
        title: "StopWatt",
        affiliateLink: "https://offer.example/buy",
        productImages: ["https://cdn.example/pack.jpg"],
        generationNiche: "black",
        importMirrorSrcDoc: srcdoc,
      },
    });
    expect(doc.sections[0].columns[0].widgets[0].type).toBe("html");
    expect(String(doc.sections[0].columns[0].widgets[0].content.code)).toContain("Oferta original");
    const baked = bakePublicOfferHrefs(
      doc,
      "https://app.example/track/r/x",
      "https://offer.example/buy",
      "https://brand.example/privacy",
    );
    const cookie = baked.sections
      .flatMap((s) => s.columns.flatMap((c) => c.widgets))
      .find((w) => w.type === "cookieBanner");
    expect(cookie?.content.policyUrl).toBe("https://brand.example/privacy");
    expect(cookie?.content.offerHref).toBe("https://app.example/track/r/x");
    expect(String(baked.sections[0].columns[0].widgets[0].content.code)).toContain(
      "https://app.example/track/r/x",
    );
    expect(String(baked.sections[0].columns[0].widgets[0].content.code)).not.toContain(
      CLICKORA_MIRROR_TRACK_MARKER,
    );
  });

  it("reusa o documento guardado em vez de inventar outra dobra", () => {
    const stored = buildEditablePageDocument({
      title: "A",
      type: "cookies",
      content: { title: "Guardado", generationNiche: "black" },
    });
    const resolved = resolvePresellPageDocument(
      { pageDocument: stored },
      { title: "B", type: "cookies", content: { title: "Outro" } },
    );
    expect(resolved.sections[0].columns[0].widgets[0].content.text).toBe("Guardado");
  });
});
