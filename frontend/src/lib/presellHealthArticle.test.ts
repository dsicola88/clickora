import { describe, expect, it } from "vitest";
import {
  buildPtBrHealthPortalArticle,
  isThinBridgeSalesText,
  resolveHealthArticle,
} from "./presellHealthArticle";

describe("presellHealthArticle", () => {
  it("detecta bridge junk com preço solto", () => {
    expect(
      isThinBridgeSalesText(
        "Tryvisivra\n\nSee today's offer.\n\nPrice written on the offer page: $780.",
      ),
    ).toBe(true);
  });

  it("resolve artigo portal PT para bridge antiga", () => {
    const a = resolveHealthArticle({
      content: {},
      productName: "TryVisivra",
      language: "en",
      salesText: "See today's offer.\nPrice written on the offer page: $780.",
      ctaText: "See the offer",
    });
    expect(a.headline).toMatch(/Nutrição Ocular/);
    expect(a.ctaLabel).toBe("Visitar o Site Oficial do Fabricante");
    expect(a.productNote).toContain("TryVisivra");
    expect(a.pillars).toHaveLength(3);
  });

  it("template PT inclui pilares pedidos", () => {
    const a = buildPtBrHealthPortalArticle("TryVisivra");
    expect(a.pillars.map((p) => p.title)).toEqual([
      "Suporte contra a Fadiga Diária",
      "Ação Antioxidante",
      "Nutrição Vitamínica Completa",
    ]);
  });
});
