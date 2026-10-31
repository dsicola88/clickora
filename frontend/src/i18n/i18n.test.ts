import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import { pt } from "./messages/pt";
import { ptBR } from "./messages/pt-BR";
import { es } from "./messages/es";
import { normalizeAppLocale, translate } from "./index";

function leafKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return prefix ? [prefix] : [];
  if (obj == null || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("app i18n catalogs", () => {
  it("en, pt, pt-BR e es têm exactamente as mesmas chaves", () => {
    const a = leafKeys(en).sort();
    expect(leafKeys(pt).sort()).toEqual(a);
    expect(leafKeys(ptBR).sort()).toEqual(a);
    expect(leafKeys(es).sort()).toEqual(a);
    expect(a.length).toBeGreaterThan(80);
  });

  it("normalizeAppLocale", () => {
    expect(normalizeAppLocale("en-US")).toBe("en");
    expect(normalizeAppLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeAppLocale("pt-PT")).toBe("pt");
    expect(normalizeAppLocale("pt")).toBe("pt");
    expect(normalizeAppLocale("es-MX")).toBe("es");
  });

  it("translate en / pt / es", () => {
    expect(translate("en", "nav.home")).toBe("Home");
    expect(translate("pt", "nav.home")).toBe("Início");
    expect(translate("es", "nav.home")).toBe("Inicio");
    expect(translate("pt-BR", "common.save")).toBe("Salvar");
    expect(translate("pt", "common.save")).toBe("Guardar");
    expect(translate("es", "common.save")).toBe("Guardar");
  });
});
