import { describe, expect, it } from "vitest";
import { createWidget } from "@/page-builder/factory";
import type { PageDocument } from "@/page-builder/types";
import {
  decomposeMirrorHtmlToWidgets,
  expandMonolithicHtmlDocument,
  isMonolithicHtmlFold,
  sectionFromMirrorHtml,
  sectionsFromMirrorHtml,
} from "./mirrorHtmlToEditableWidgets";

describe("mirrorHtmlToEditableWidgets", () => {
  it("decompõe heading, texto, imagem e botão", () => {
    const html = `
      <base href="https://brand.example/">
      <h1>Produto X</h1>
      <p>Descrição curta do produto para afiliados.</p>
      <img src="/hero.jpg" alt="Pack" />
      <a class="btn-order" href="/buy">Order Now</a>
    `;
    const widgets = decomposeMirrorHtmlToWidgets(html);
    expect(widgets.map((w) => w.type)).toEqual(
      expect.arrayContaining(["heading", "text", "image", "button"]),
    );
    expect(widgets.find((w) => w.type === "heading")?.content.text).toBe("Produto X");
    expect(String(widgets.find((w) => w.type === "image")?.content.src)).toContain(
      "https://brand.example/hero.jpg",
    );
    expect(widgets.find((w) => w.type === "button")?.content.fromMirror).toBe(true);
    expect(String(widgets.find((w) => w.type === "button")?.content.href)).toContain(
      "https://brand.example/buy",
    );
  });

  it("cria secção com vários widgets", () => {
    const sec = sectionFromMirrorHtml(
      `<body><h2>Hi</h2><p>Para</p><a href="https://o.example/x">Buy</a></body>`,
    );
    expect(sec).not.toBeNull();
    expect(sec!.columns[0].widgets.length).toBeGreaterThanOrEqual(2);
  });

  it("expande documento monolítico no editor", () => {
    const htmlW = createWidget("html");
    htmlW.content = {
      code: `<h1>Oferta</h1><p>Texto longo o suficiente para contar.</p><a class="btn" href="https://o.example">Comprar</a><img src="https://cdn.example/a.jpg" alt="a" />`,
    };
    const doc: PageDocument = {
      id: "page_x",
      name: "Test",
      sections: [
        {
          id: "sec_1",
          layout: "full",
          contentWidth: 1200,
          columnGap: { desktop: 20 },
          styles: {},
          columns: [{ id: "col_1", widthPercent: { desktop: 100 }, styles: {}, widgets: [htmlW] }],
        },
      ],
      settings: { maxContentWidth: 1200 },
      updatedAt: 1,
    };
    expect(isMonolithicHtmlFold(doc)).toBe(true);
    const expanded = expandMonolithicHtmlDocument(doc);
    expect(expanded).not.toBe(doc);
    const types = expanded.sections.flatMap((s) =>
      s.columns[0].widgets.map((w) => w.type),
    );
    expect(types).toEqual(expect.arrayContaining(["heading", "text", "button", "image"]));
    expect(types.includes("html")).toBe(false);
  });

  it("decompõe lander em tabela + headline em div (estilo Tinnitrol)", () => {
    const html = `
      <base href="https://tinnitrol.example/">
      <style>@font-face{font-family:X}</style>
      <table width="100%">
        <tr>
          <td>
            <div class="nav">
              <div>Tinnitrol</div>
              <a href="#benefits">BENEFITS</a>
              <a class="btn" href="/buy" style="background:#0a2540;color:#fff">ORDER NOW</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#cfe8f5">
            <div class="headline" style="font-size:48px;font-weight:800;color:#0a2540">360 DEGREE HEARING SUPPORT</div>
            <p>Advanced formula for tinnitus relief and clarity.</p>
            <a class="btn-order" href="/checkout">ORDER NOW</a>
            <img src="/product.png" alt="Tinnitrol bottle" />
          </td>
        </tr>
      </table>
    `;
    const widgets = decomposeMirrorHtmlToWidgets(html);
    const types = widgets.map((w) => w.type);
    expect(types).toEqual(expect.arrayContaining(["heading", "text", "image", "button"]));
    expect(String(widgets.find((w) => w.type === "heading")?.content.text)).toMatch(/360 DEGREE/i);
    expect(String(widgets.find((w) => w.type === "image")?.content.src)).toContain(
      "https://tinnitrol.example/product.png",
    );
    expect(widgets.filter((w) => w.type === "button").length).toBeGreaterThanOrEqual(1);
    const sections = sectionsFromMirrorHtml(html);
    expect(sections.length).toBeGreaterThanOrEqual(1);
    const natives = sections.flatMap((s) =>
      s.columns[0].widgets.filter((w) =>
        ["heading", "text", "image", "button"].includes(w.type),
      ),
    );
    expect(natives.length).toBeGreaterThanOrEqual(3);
  });

  it("expande HTML monolítico com layout em tabela", () => {
    const htmlW = createWidget("html");
    htmlW.content = {
      code: `
        <table><tr><td>
          <h1>Hearing Support</h1>
          <p>Relief you can trust every day.</p>
          <img src="https://cdn.example/pack.jpg" alt="pack" />
          <a class="cta" href="https://offer.example/buy">Buy Now</a>
        </td></tr></table>
      `,
    };
    const doc: PageDocument = {
      id: "page_table",
      name: "Table",
      sections: [
        {
          id: "sec_1",
          layout: "full",
          contentWidth: 1200,
          columnGap: { desktop: 20 },
          styles: {},
          columns: [{ id: "col_1", widthPercent: { desktop: 100 }, styles: {}, widgets: [htmlW] }],
        },
      ],
      settings: { maxContentWidth: 1200 },
      updatedAt: 1,
    };
    const expanded = expandMonolithicHtmlDocument(doc);
    expect(isMonolithicHtmlFold(expanded)).toBe(false);
    const types = expanded.sections.flatMap((s) => s.columns[0].widgets.map((w) => w.type));
    expect(types).toEqual(expect.arrayContaining(["heading", "image", "button"]));
  });
});
