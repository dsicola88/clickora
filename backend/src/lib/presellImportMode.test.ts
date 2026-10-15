import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPresellImport } from "./presellImportMode";
import { assertExternalProductUrl, isBlockedPresellImportHost } from "./presellImporter";

describe("classifyPresellImport", () => {
  it("não publica a página original, mesmo sem preço", () => {
    const out = classifyPresellImport({
      mirrorChars: 20_000,
      imageCount: 12,
      salesChars: 4000,
      sourceTextChars: 4000,
      headingCount: 4,
      hasPrice: false,
      hasSourceCta: false,
      title: "StopWatt Official",
      browser: "rendered",
    });
    assert.equal(out.mode, "template");
    assert.equal(out.publishable, true);
    assert.match(out.notes.join(" "), /espelho visual|não é copiada/i);
    assert.match(out.notes.join(" "), /não é um clone/i);
  });

  it("publica o espelho só com título, imagem, texto e prova de oferta", () => {
    const out = classifyPresellImport({
      mirrorChars: 1200,
      imageCount: 2,
      salesChars: 400,
      sourceTextChars: 400,
      headingCount: 2,
      hasPrice: true,
      hasSourceCta: false,
      title: "StopWatt Official",
      browser: "rendered",
    });
    assert.equal(out.mode, "template");
    assert.equal(out.publishable, true);
    assert.match(out.notes.join(" "), /não é um clone/i);
  });

  it("mantém Example Domain em rascunho mesmo com espelho e preço", () => {
    const out = classifyPresellImport({
      mirrorChars: 5000,
      imageCount: 3,
      salesChars: 900,
      sourceTextChars: 900,
      headingCount: 1,
      hasPrice: true,
      hasSourceCta: true,
      title: "Example Domain",
      browser: "rendered",
    });
    assert.equal(out.publishable, false);
    assert.match(out.notes.join(" "), /genérico|Importação incompleta/i);
  });

  it("fica em modelo editável sem espelho quando há texto e imagem", () => {
    const out = classifyPresellImport({
      mirrorChars: 0,
      imageCount: 1,
      salesChars: 220,
      title: "Produto real",
      browser: "unavailable",
    });
    assert.equal(out.mode, "template");
    assert.equal(out.publishable, true);
    assert.match(out.notes.join(" "), /Chromium não está disponível/);
    assert.match(out.notes.join(" "), /não é um clone/i);
  });

  it("publica marca curta real (Yusleep/Visivra) com imagem e oferta", () => {
    const out = classifyPresellImport({
      mirrorChars: 4000,
      imageCount: 4,
      salesChars: 500,
      sourceTextChars: 500,
      hasPrice: true,
      hasSourceCta: true,
      title: "Yusleep",
      browser: "rendered",
    });
    assert.equal(out.mode, "template");
    assert.equal(out.publishable, true);
  });

  it("marca importação incompleta sem título útil nem imagem", () => {
    const out = classifyPresellImport({
      mirrorChars: 40,
      imageCount: 0,
      salesChars: 12,
      title: "x",
      browser: "failed",
    });
    assert.equal(out.mode, "incomplete");
    assert.equal(out.publishable, false);
    assert.match(out.notes.join(" "), /Importação incompleta/);
  });
});

describe("SSRF da importação", () => {
  const blocked = [
    "http://127.0.0.1/admin",
    "http://localhost/x",
    "http://10.1.2.3/",
    "http://192.168.1.8/",
    "http://172.16.0.4/",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://metadata.google.internal/",
    "http://db.internal/",
    "http://printer.local/",
    "http://user:pass@example.com/",
  ];

  for (const url of blocked) {
    it(`recusa ${url}`, () => {
      assert.throws(() => assertExternalProductUrl(url));
    });
  }

  it("aceita um URL público https", () => {
    assert.doesNotThrow(() => assertExternalProductUrl("https://example.com/produto"));
    assert.equal(isBlockedPresellImportHost("example.com"), false);
  });
});
