import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPresellSignals } from "./extractPresellSignals";
import { canPublishForAds, evaluateCompliance } from "./evaluate";
import type { DestinationProbeResult } from "./types";

/**
 * Simula o payload típico do wizard após import publishable=true
 * (com disclosure + privacidade que o wizard agora injeta).
 */
describe("wizard E2E publish gate", () => {
  const destOk: DestinationProbeResult = {
    attempted: true,
    ok: true,
    https: true,
    statusCode: 200,
    finalUrl: "https://offer.example.com/buy",
    redirectCount: 0,
    redirectCycle: false,
    openRedirectSuspect: false,
    domainChanged: false,
    initialHost: "offer.example.com",
    finalHost: "offer.example.com",
    crawlerBlocked: false,
    hops: ["https://offer.example.com/buy"],
  };

  it("import publishable com conteúdo real → ready_for_review (não força rascunho)", () => {
    const signals = extractPresellSignals({
      title: "Serum Capilar Regenera",
      type: "review",
      language: "pt",
      content: {
        product_name: "Serum Capilar Regenera",
        title: "Serum Capilar Regenera",
        subtitle: "Análise da oferta com base nos dados da página do vendedor",
        sales_text:
          "Serum Capilar Regenera. " +
          "Revímos o que o vendedor declara sobre composição, modo de uso e política de devolução. " +
          "Não prometemos resultados. Confirme o preço e a garantia no site oficial antes de comprar. " +
          "Esta página usa links de afiliado e serve para ajudar a decidir com informação própria. " +
          "Compare alternativas, leia o rótulo e verifique o suporte ao cliente da loja. " +
          "Limitações: estoque, prazos de envio e elegibilidade podem mudar sem aviso na origem.",
        cta_text: "Ver oferta",
        images: ["https://cdn.example.com/serum.jpg", "https://cdn.example.com/serum2.jpg"],
        affiliate_link: "https://offer.example.com/buy",
        source_url: "https://vendor.example.com/serum",
        importMirrorSrcDoc: "<article><p>" + "texto do espelho ".repeat(80) + "</p></article>",
      },
      settings: {
        cookiePolicyUrl: "/privacidade",
        privacyPolicyUrl: "/privacidade",
        businessName: "Analista Independente Lda",
        contactEmail: "ops@example.com",
        affiliateDisclosure:
          "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão — sem custo extra para si.",
      },
    });
    const ev = evaluateCompliance({ signals, destination: destOk });
    assert.notEqual(resultStatus(ev, "OC-001"), "FAIL");
    assert.equal(canPublishForAds(ev.gate), true, `gate=${ev.gate}`);
  });

  it("presell builder (pageDocument) passa gate com texto visível no editor", () => {
    const article =
      "Conteúdo informativo independente sobre Tea. Não somos o fabricante. " +
      "Podemos receber comissão por indicação. Confirme preço e garantia no site oficial. " +
      "Compare alternativas e leia o rótulo antes de comprar.";
    const signals = extractPresellSignals({
      title: "Tea",
      type: "builder",
      language: "pt-BR",
      content: {
        affiliateLink: "https://en.wikipedia.org/wiki/Tea",
        pageDocument: {
          sections: [
            {
              columns: [
                {
                  widgets: [
                    { type: "image", content: { src: "https://cdn.example/tea.jpg" } },
                    { type: "heading", content: { text: "Tea — editor" } },
                    { type: "text", content: { html: `<p>${article}</p>` } },
                    { type: "button", content: { text: "Continuar para a oferta" } },
                  ],
                },
              ],
            },
          ],
        },
      },
      settings: {
        businessName: "Operador Teste",
        contactEmail: "ops@example.com",
        privacyPolicyUrl: "/privacidade",
      },
    });
    const ev = evaluateCompliance({ signals, destination: destOk });
    assert.notEqual(resultStatus(ev, "OC-001"), "FAIL");
    assert.equal(resultStatus(ev, "CT-001"), "PASS");
    assert.equal(canPublishForAds(ev.gate), true, `gate=${ev.gate}`);
  });

  it("título genérico / página ponte → blocked (rascunho correcto)", () => {
    const signals = extractPresellSignals({
      title: "Home",
      content: {
        product_name: "X",
        sales_text: "Compre",
        images: ["https://cdn.example.com/a.jpg"],
        affiliate_link: "https://offer.example.com/x",
        cta_text: "Buy",
      },
      settings: { privacyPolicyUrl: "/privacidade" },
    });
    const ev = evaluateCompliance({ signals, destination: destOk });
    assert.equal(resultStatus(ev, "OC-001"), "FAIL");
    assert.equal(canPublishForAds(ev.gate), false);
  });
});

function resultStatus(
  ev: ReturnType<typeof evaluateCompliance>,
  id: string,
): string {
  return ev.results.find((r) => r.ruleId === id)?.status || "MISSING";
}
