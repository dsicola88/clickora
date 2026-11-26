import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findAdPolicyRiskTerms } from "./adPolicyCopy";

describe("findAdPolicyRiskTerms", () => {
  it("deteta os termos que estavam na landing de produção", () => {
    const extras = {
      features: {
        cards: [
          { title: "Estratégia Black/White", body: 'O modo "Assistente Black" cria o portal informativo de proteção num clique.' },
          { title: "Foco Principal", body: "Rastreamento + Criação de Páginas + Contingência Automática." },
        ],
      },
    };
    assert.deepEqual(findAdPolicyRiskTerms(extras), ["black/white", "modo/página black", "contingência"]);
  });

  it("deteta cloaker, burlar, esconder links, clonar páginas, página segura e anti-ban", () => {
    for (const [text, label] of [
      ["O melhor cloaker do mercado", "cloaker / cloaking"],
      ["Burlar bloqueios do Google", "burlar / contornar bloqueios"],
      ["contornar a revisão de anúncios", "burlar / contornar bloqueios"],
      ["Esconder links de afiliado", "esconder links"],
      ["Clonar páginas em 1 clique", "clonar páginas"],
      ["Mostra uma página segura ao revisor", "white page / página segura"],
      ["Presell à prova de bloqueio", "à prova de bloqueio"],
      ["Sistema anti-ban indetectável", "anti-ban / indetectável"],
    ] as const) {
      assert.ok(findAdPolicyRiskTerms({ t: text }).includes(label), `${text} → ${label}`);
    }
  });

  it("não acusa copy institucional nem cores/estilos", () => {
    assert.deepEqual(
      findAdPolicyRiskTerms({
        hero: "Criação de landing pages de alta conversão, otimização de campanhas e rastreamento de métricas.",
        faq: "A dclickora garante vendas ou ROI? Não.",
        style: { color: "black", background: "#000", theme: "white" },
        blacklist: "Lista de IPs bloqueados no salto para a oferta (antifraude).",
      }),
      [],
    );
  });
});
