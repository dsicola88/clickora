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
  it("white: dobra produto + hoplink no cookie", () => {
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
        generationNiche: "white",
      },
    });
    const fold = doc.sections[0];
    expect(fold.columns[0].widgets.map((w) => w.type)).toEqual(["image"]);
    expect(fold.columns[1].widgets.map((w) => w.type)).toEqual(["heading", "text"]);
    expect(fold.columns[0].widgets[0].content.src).toBe("https://cdn.example/pack.jpg");
    expect(fold.columns[0].widgets[0].content.hero).toBe(true);
    expect(fold.columns[1].widgets[0].content.text).toBe("StopWatt");
    expect(String(fold.columns[1].widgets[1].content.html)).toContain("tomada");
    const cookie = doc.sections[1].columns[0].widgets[0];
    expect(cookie.type).toBe("cookieBanner");
    expect(cookie.content.offerHref).toBe("https://offer.example/buy");
    expect(cookie.content.policyUrl).toBe("/privacidade");
    expect(cookie.content.followLanguage).toBe(false);
    expect(cookie.content.allowLabel).toBeTruthy();
    expect(cookie.content.overlayOpacity).toBe(28);
  });

  it("black cookies: artigo + CTA na página; cookie só desbloqueia (sem hoplink)", () => {
    const doc = buildEditablePageDocument({
      title: "Campanha",
      type: "cookies",
      language: "en",
      content: {
        title: "StopWatt",
        salesText: "Cura milagrosa garantida sem link",
        ctaText: "Ver oferta",
        affiliateLink: "https://offer.example/buy",
        productName: "StopWatt",
        productImages: ["https://cdn.example/pack.jpg"],
        generationNiche: "black",
      },
    });
    expect(doc.settings.maxContentWidth).toBe(720);
    const media = doc.sections[0].columns[0].widgets[0];
    expect(media.type).toBe("image");
    expect(media.content.hero).toBe(false);
    expect(media.content.src).toBe("https://cdn.example/pack.jpg");
    const bodyTypes = doc.sections[1].columns[0].widgets.map((w) => w.type);
    expect(bodyTypes).toEqual(["heading", "heading", "text", "button"]);
    const headline = String(doc.sections[1].columns[0].widgets[1].content.text).toLowerCase();
    expect(headline).toContain("stopwatt");
    expect(headline).not.toContain("milagrosa");
    const bodyHtml = String(doc.sections[1].columns[0].widgets[2].content.html).toLowerCase();
    expect(bodyHtml).not.toContain("milagrosa");
    expect(bodyHtml).toContain("official");
    expect(doc.sections[1].columns[0].widgets[3].content.href).toBe("https://offer.example/buy");
    const cookie = doc.sections[2].columns[0].widgets[0];
    expect(cookie.type).toBe("cookieBanner");
    expect(cookie.content.offerHref || "").toBe("");
    const baked = bakePublicOfferHrefs(
      doc,
      "https://app.example/track/r/x",
      "https://offer.example/buy",
      "https://brand.example/privacy",
      { unlockCookieOnly: true },
    );
    const bakedCookie = baked.sections
      .flatMap((s) => s.columns.flatMap((c) => c.widgets))
      .find((w) => w.type === "cookieBanner");
    expect(bakedCookie?.content.offerHref || "").toBe("");
    const bakedButton = baked.sections
      .flatMap((s) => s.columns.flatMap((c) => c.widgets))
      .find((w) => w.type === "button");
    expect(bakedButton?.content.href).toBe("https://app.example/track/r/x");
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
        generationNiche: "white",
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
    expect(types[0]).toBe("heading");
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
    const withCss = mirrorSrcDocToEditableHtml(
      `<!doctype html><html><head><base href="https://brand.example/"><link rel="stylesheet" href="/app.css"><link rel="icon" href="/i.png"><style>h1{color:red}</style></head><body><h1>X</h1></body></html>`,
    );
    expect(withCss).toContain('<base href="https://brand.example/">');
    expect(withCss).toContain('rel="stylesheet"');
    expect(withCss).toContain("https://brand.example/app.css");
    expect(withCss).not.toContain("rel=\"icon\"");
    const doc = buildEditablePageDocument({
      title: "Campanha",
      type: "cookies",
      content: {
        title: "StopWatt",
        affiliateLink: "https://offer.example/buy",
        productImages: ["https://cdn.example/pack.jpg"],
        generationNiche: "white",
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

  it("white: reusa o documento guardado em vez de inventar outra dobra", () => {
    const stored = buildEditablePageDocument({
      title: "A",
      type: "cookies",
      content: { title: "Guardado", generationNiche: "white", productImages: ["https://cdn.example/a.jpg"] },
    });
    const resolved = resolvePresellPageDocument(
      { pageDocument: stored },
      {
        title: "B",
        type: "cookies",
        content: {
          title: "Outro",
          generationNiche: "white",
          productImages: ["https://cdn.example/b.jpg"],
        },
      },
    );
    expect(String(resolved.sections[0].columns[1].widgets[0].content.text)).toMatch(/Guardado/);
  });

  it("black: regenera o artigo limpo mesmo com documento antigo guardado", () => {
    const stored = buildEditablePageDocument({
      title: "A",
      type: "cookies",
      content: { title: "Velho", generationNiche: "white", productImages: ["https://cdn.example/old.jpg"] },
    });
    const resolved = resolvePresellPageDocument(
      { pageDocument: stored },
      {
        title: "B",
        type: "cookies",
        language: "en",
        content: {
          title: "StopWatt",
          productName: "StopWatt",
          generationNiche: "black",
          productImages: ["https://cdn.example/pack.jpg"],
          affiliateLink: "https://offer.example/buy",
        },
      },
    );
    expect(resolved.settings.maxContentWidth).toBe(720);
    expect(resolved.sections[0].columns[0].widgets[0].content.hero).toBe(false);
    expect(String(resolved.sections[1].columns[0].widgets[1].content.text).toLowerCase()).toContain(
      "stopwatt",
    );
  });
});
