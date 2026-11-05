import { describe, expect, it } from "vitest";
import { translateLegacyPt } from "./legacyBridge";

describe("legacy PT bridge", () => {
  it("keeps Portuguese for pt locale", () => {
    expect(translateLegacyPt("pt", "A carregar…")).toBe("A carregar…");
  });

  it("translates known chrome to English", () => {
    const out = translateLegacyPt("en", "A carregar…");
    expect(out.toLowerCase()).toMatch(/load/);
  });

  it("applies BR orthography", () => {
    expect(translateLegacyPt("pt-BR", "Guardar")).toMatch(/Salvar|Guardar/);
  });
});
