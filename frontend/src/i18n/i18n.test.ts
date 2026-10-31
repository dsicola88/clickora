import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import { pt } from "./messages/pt";
import { ptBR } from "./messages/pt-BR";
import { normalizeAppLocale, translate } from "./index";

function leafKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return prefix ? [prefix] : [];
  if (obj == null || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("app i18n catalogs", () => {
  it("en, pt e pt-BR têm exactamente as mesmas chaves", () => {
    const a = leafKeys(en).sort();
    const b = leafKeys(pt).sort();
    const c = leafKeys(ptBR).sort();
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(a.length).toBeGreaterThan(80);
  });

  it("normalizeAppLocale", () => {
    expect(normalizeAppLocale("en-US")).toBe("en");
    expect(normalizeAppLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeAppLocale("pt-PT")).toBe("pt");
    expect(normalizeAppLocale("pt")).toBe("pt");
  });

  it("translate en vs pt", () => {
    expect(translate("en", "nav.home")).toBe("Home");
    expect(translate("pt", "nav.home")).toBe("Início");
    expect(translate("pt-BR", "common.save")).toBe("Salvar");
    expect(translate("pt", "common.save")).toBe("Guardar");
  });
});
