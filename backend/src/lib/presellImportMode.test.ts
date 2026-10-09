import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPresellImport } from "./presellImportMode";
import { assertExternalProductUrl, isBlockedPresellImportHost } from "./presellImporter";

describe("classifyPresellImport", () => {
  it("publica só o espelho e avisa que o JavaScript da origem não corre", () => {
    const out = classifyPresellImport({
      mirrorChars: 1200,
      imageCount: 2,
      salesChars: 400,
      title: "StopWatt Official",
      browser: "rendered",
    });
    assert.equal(out.mode, "mirror");
    assert.equal(out.publishable, true);
    assert.match(out.notes.join(" "), /não é uma cópia fiel/i);
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
    assert.equal(out.publishable, false);
    assert.match(out.notes.join(" "), /Chromium não está disponível/);
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
