import { describe, expect, it } from "vitest";
import {
  applyHtmlFoldPatchToElement,
  classifyHtmlFoldElement,
  serializeHtmlFoldContent,
  snapshotHtmlFoldElement,
  stripHtmlFoldEditorChrome,
} from "./htmlFoldEdit";

describe("htmlFoldEdit", () => {
  it("classifica elementos do espelho", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <h1>Title</h1>
      <p>Copy</p>
      <img src="https://cdn.example/a.jpg" alt="a" />
      <a class="btn" href="/buy">Order Now</a>
      <a href="#benefits">Benefits</a>
    `;
    expect(classifyHtmlFoldElement(root.querySelector("h1")!)).toBe("heading");
    expect(classifyHtmlFoldElement(root.querySelector("p")!)).toBe("text");
    expect(classifyHtmlFoldElement(root.querySelector("img")!)).toBe("image");
    expect(classifyHtmlFoldElement(root.querySelector("a.btn")!)).toBe("button");
    expect(classifyHtmlFoldElement(root.querySelector('a[href="#benefits"]')!)).toBe("link");
  });

  it("aplica patches sem destruir a estrutura", () => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<section style="background:#cfe"><h1 style="color:#111">Hello</h1><img src="/old.png" alt="x" /><a class="btn" href="/buy">Buy</a></section>`;
    const h1 = wrap.querySelector("h1")!;
    applyHtmlFoldPatchToElement(h1, { text: "Hello world", color: "#e11d48" });
    expect(h1.textContent).toBe("Hello world");
    expect((h1 as HTMLElement).style.color).toBe("rgb(225, 29, 72)");

    const img = wrap.querySelector("img")!;
    applyHtmlFoldPatchToElement(img, { src: "https://cdn.example/new.png", alt: "pack" });
    expect(img.getAttribute("src")).toBe("https://cdn.example/new.png");
    expect(img.getAttribute("alt")).toBe("pack");

    const a = wrap.querySelector("a")!;
    applyHtmlFoldPatchToElement(a, { text: "ORDER NOW", href: "https://track.example/r/1", background: "#0a2540" });
    expect(a.textContent).toBe("ORDER NOW");
    expect(a.getAttribute("href")).toBe("https://track.example/r/1");
    expect((a as HTMLElement).style.backgroundColor).toBe("rgb(10, 37, 64)");
    expect(wrap.querySelector("section")).toBeTruthy();
  });

  it("serializa sem marcas de editor", () => {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-clickora-html-edit", "1");
    wrap.innerHTML = `<h1 data-clickora-html-selected="1" data-clickora-html-field="1" contenteditable="true">X</h1>`;
    const html = serializeHtmlFoldContent(wrap);
    expect(html).toContain("X");
    expect(html).not.toContain("data-clickora-html-selected");
    expect(html).not.toContain("contenteditable");
    expect(stripHtmlFoldEditorChrome(html)).toBe(html);
  });

  it("cria snapshot para o painel", () => {
    const img = document.createElement("img");
    img.src = "https://cdn.example/p.png";
    img.alt = "Pack";
    document.body.appendChild(img);
    const snap = snapshotHtmlFoldElement("w1", img);
    expect(snap?.kind).toBe("image");
    expect(snap?.src).toContain("cdn.example/p.png");
    img.remove();
  });
});
