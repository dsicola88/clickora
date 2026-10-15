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

  it("resolve artigo transparente PT para bridge antiga (sem claims médicos)", () => {
    const a = resolveHealthArticle({
      content: {},
      productName: "TryVisivra",
      language: "en",
      salesText: "See today's offer.\nPrice written on the offer page: $780.",
      ctaText: "See the offer",
    });
    expect(a.headline).toMatch(/avaliar a oferta/i);
    expect(a.ctaLabel).toBe("Continuar para a página oficial da oferta");
    expect(a.productNote).toContain("TryVisivra");
    expect(a.intro).not.toMatch(/carotenoides|mácula|luz azul/i);
    expect(a.pillars).toHaveLength(3);
  });

  it("rejeita copy com alegações de saúde inventadas", () => {
    const a = resolveHealthArticle({
      content: {
        articleHeadline: "Nutrição Ocular: carotenoides",
        articleIntro: "Especialistas apontam luz azul e fadiga ocular.",
        articlePillars: [
          { title: "Ação Antioxidante", body: "Protege a mácula." },
          { title: "Visão", body: "Melhora visão noturna." },
        ],
      },
      productName: "TryVisivra",
      language: "pt-BR",
    });
    expect(a.headline).toMatch(/transparência/i);
    expect(a.pillars[0].title).toMatch(/Identidade/);
  });

  it("template PT só com factos verificáveis sobre a página", () => {
    const a = buildPtBrHealthPortalArticle("TryVisivra");
    expect(a.pillars.map((p) => p.title)).toEqual([
      "Identidade do vendedor",
      "Preço, envio e garantia",
      "Composição e avisos do produto",
    ]);
  });
});
