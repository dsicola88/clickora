import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectSalesPageLanguage,
  normalizePresellLocaleKey,
  resolveImportLanguage,
} from "./presellSourceLanguageDetect";

describe("normalizePresellLocaleKey", () => {
  it("maps en-US and pt to supported keys", () => {
    assert.equal(normalizePresellLocaleKey("en-US"), "en");
    assert.equal(normalizePresellLocaleKey("pt"), "pt-BR");
  });
});

describe("detectSalesPageLanguage", () => {
  it("reads html lang", () => {
    const html = `<!DOCTYPE html><html lang="en-US"><head><title>T</title></head><body><p>Buy now</p></body></html>`;
    const d = detectSalesPageLanguage(html);
    assert.equal(d.locale, "en");
    assert.equal(d.confidence, "high");
    assert.equal(d.source, "html-lang");
  });

  it("reads og:locale", () => {
    const html = `<html><head><meta property="og:locale" content="es_ES" /></head><body><p>Hola</p></body></html>`;
    const d = detectSalesPageLanguage(html);
    assert.equal(d.locale, "es");
    assert.equal(d.confidence, "high");
  });

  it("heuristic EN sales copy", () => {
    const html = `<html><body>
      <h1>Trimoryn</h1>
      <p>Order now with free shipping and money-back guarantee for our customers today.</p>
      <p>Ingredients and reviews from verified buyers.</p>
    </body></html>`;
    const d = detectSalesPageLanguage(html);
    assert.equal(d.locale, "en");
    assert.equal(d.confidence, "medium");
    assert.equal(d.source, "text-heuristic");
  });

  it("resolveImportLanguage overrides pt-BR default on medium EN", () => {
    const html = `<html><body>
      <p>Order now with free shipping and money-back guarantee for customers today.</p>
      <p>Limited offer with ingredients and reviews.</p>
    </body></html>`;
    const r = resolveImportLanguage("pt-BR", html);
    assert.equal(r.language, "en");
    assert.equal(r.detection.confidence, "medium");
  });
});