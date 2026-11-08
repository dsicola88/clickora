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

  it("resolve artigo transparente no idioma da página para bridge antiga", () => {
    const a = resolveHealthArticle({
      content: {},
      productName: "TryVisivra",
      language: "en",
      salesText: "See today's offer.\nPrice written on the offer page: $780.",
      ctaText: "See the offer",
    });
    expect(a.headline).toMatch(/review the TryVisivra offer/i);
    expect(a.ctaLabel).toBe("Continue to the official offer page");
    expect(a.kicker).toBe("Informational page");
    expect(a.productNote).toContain("TryVisivra");
    expect(a.intro).not.toMatch(/carotenoides|mácula|luz azul/i);
    expect(a.pillars).toHaveLength(3);
  });

  it("não deixa o artigo em português quando o idioma é espanhol", () => {
    const a = resolveHealthArticle({
      content: {},
      productName: "TryVisivra",
      language: "es",
      salesText: "",
    });
    expect(a.headline).toMatch(/oferta de TryVisivra/i);
    expect(a.headline).not.toMatch(/avaliar a oferta/i);
    expect(a.ctaLabel).toMatch(/Continuar a la página oficial/i);
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
    expect(a.kicker).toBe("Portal informativo");
    expect(a.pillars.map((p) => p.title)).toEqual([
      "Identidade do vendedor",
      "Preço, envio e garantia",
      "Composição e avisos do produto",
    ]);
  });

  it("não rejeita copy que só nega alegações (não afirmamos cura)", () => {
    const a = resolveHealthArticle({
      content: {
        articleKicker: "Artigo de afiliado",
        articleHeadline: "O que vale a pena saber sobre Neotonics",
        articleIntro:
          "Em mercados saturados de anúncios, Neotonics aparece com frequência. Este artigo resume critérios de um comprador prudente.",
        articlePillarsTitle: "Critérios editoriais",
        articlePillars: [
          { title: "Clareza", body: "Anúncio e landing devem dizer o mesmo." },
          {
            title: "Absolutos",
            body: "Não afirmamos cura, milagre nem resultado garantido. Confirme na origem.",
          },
        ],
        articleProductNote: "Podemos receber comissão.",
      },
      productName: "Neotonics",
      language: "pt-BR",
    });
    expect(a.kicker).toBe("Artigo de afiliado");
    expect(a.headline).toMatch(/vale a pena saber/i);
  });

  it("usa artigo estruturado PT da IA em vez do template genérico", () => {
    const a = resolveHealthArticle({
      content: {
        articleKicker: "Análise independente",
        articleHeadline: "Como avaliar a oferta de Neotonics com transparência",
        articleIntro:
          "Esta página é conteúdo informativo independente sobre Neotonics. Não somos o fabricante nem processamos pagamentos. O objectivo é ajudar o visitante a decidir com calma.",
        articlePillarsTitle: "O que deve confirmar",
        articlePillars: [
          { title: "Identidade", body: "Confirme o nome comercial e o contacto no destino." },
          { title: "Checkout", body: "Preço e garantia só no site do comerciante." },
          { title: "Avisos", body: "Leia composição e avisos na origem." },
        ],
        articleProductNote: "Podemos receber comissão por indicação.",
      },
      productName: "Neotonics",
      language: "pt-BR",
      salesText: "texto longo suficiente para não ser bridge ".repeat(20),
      ctaText: "Continuar para a página oficial da oferta",
    });
    expect(a.kicker).toBe("Análise independente");
    expect(a.headline).toMatch(/Neotonics/);
    expect(a.intro).toMatch(/informativo independente/);
    expect(a.pillars).toHaveLength(3);
    expect(a.ctaLabel).toMatch(/Continuar/);
  });
});
