/**
 * Tests para o gerador determinístico de RSA. Cobre principalmente:
 *  - Corte por fronteira de palavra (`clipAtWord`) — a peça que evita output
 *    como "TonicGreens Presentation You C" ou "tonic.phytogree.n".
 *  - Comportamento com marcas longas (≥18 chars), incluindo o fallback
 *    automático para `slug1` (1ª palavra) quando os templates não cabem.
 *  - Respeito pelos limites Google: ≤30 chars por headline, ≤90 por descrição.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDeterministicRsa, clipAtWord } from "./google-rsa-deterministic";

describe("clipAtWord", () => {
  it("devolve a string intacta quando já cabe", () => {
    assert.equal(clipAtWord("Hello world", 30), "Hello world");
  });

  it("corta limpo quando o caractere a seguir ao limite é separador", () => {
    /** "Hello world foo" tem 15 chars; pedindo max=11 → "Hello world" + " " logo a seguir → corte limpo. */
    assert.equal(clipAtWord("Hello world foo", 11), "Hello world");
  });

  it("recua até ao último espaço para não cortar palavra a meio", () => {
    /** "TonicGreens Presentation You Can Trust" — clip a 30 cortaria "C". Recua para "TonicGreens Presentation You". */
    const r = clipAtWord("TonicGreens Presentation You Can Trust", 30);
    assert.equal(r, "TonicGreens Presentation You");
  });

  it("recusa (null) quando perderia mais de 40 % do conteúdo", () => {
    /** "TonicGreensPresentation Today" — sem espaços antes do limite, recuar perderia tudo. */
    assert.equal(clipAtWord("TonicGreensPresentation Today", 30), "TonicGreensPresentation Today");
    /** Caso pior: 1ª palavra muito longa, separador depois do limite. */
    assert.equal(clipAtWord("Supercalifragilisticexpialidocious!", 30), null);
  });

  it("normaliza espaços antes de cortar", () => {
    assert.equal(clipAtWord("  Hello   world  ", 11), "Hello world");
  });

  it("remove pontuação/separadores de fim depois do corte", () => {
    /** Garante que não publicamos "Foo bar — " com hífen pendurado. */
    const r = clipAtWord("Foo bar — baz qux quux", 11);
    assert.equal(r, "Foo bar");
  });

  it("trata corretamente em cima do limite (max exacto)", () => {
    const s = "Buy TonicGreens Online Now"; // 26 chars
    assert.equal(clipAtWord(s, 26), "Buy TonicGreens Online Now");
  });

  it("devolve null para input vazio/whitespace", () => {
    assert.equal(clipAtWord("", 30), null);
    assert.equal(clipAtWord("   ", 30), null);
  });
});

describe("buildDeterministicRsa — marca longa (TonicGreens Presentation, 24 chars)", () => {
  const input = {
    landingUrl: "https://tonic.phytogreens.net/home/?aff_id=190743",
    offer: "TonicGreens Presentation",
    objective: "Generate conversions on the official site.",
  };

  it("nenhuma headline excede 30 chars", () => {
    const { headlines } = buildDeterministicRsa(input, "en");
    assert.ok(headlines.length >= 3, `expected ≥3 headlines, got ${headlines.length}`);
    for (const h of headlines) {
      assert.ok(h.length <= 30, `headline excede 30 chars (${h.length}): "${h}"`);
    }
  });

  it("nenhuma headline termina com palavra cortada (regressão dos screenshots)", () => {
    const { headlines } = buildDeterministicRsa(input, "en");
    /** Nenhuma headline pode terminar com fragmento mid-word: nem "TonicGreens Presentat",
     *  nem "TonicGreens Presenta", nem "tonic.phytogree", nem "TonicGreens Presentation O".
     *  A regra prática: se a última "palavra" é fragmento da marca de input ("Presentation"),
     *  a versão completa devia caber — recusamos os fragmentos. */
    const badFragments = [
      "Presentat",
      "Presenta",
      "TonicGreens Presentation O",
      "TonicGreens Presentation T",
      "TonicGreens Presentation Y",
      "TonicGreens Presentation —",
    ];
    for (const h of headlines) {
      for (const frag of badFragments) {
        assert.ok(
          !h.endsWith(frag),
          `headline "${h}" termina com fragmento "${frag}" — corte mid-word não foi prevenido`,
        );
      }
    }
  });

  it("nenhuma descrição excede 90 chars", () => {
    const { descriptions } = buildDeterministicRsa(input, "en");
    assert.ok(descriptions.length >= 2, `expected ≥2 descriptions, got ${descriptions.length}`);
    for (const d of descriptions) {
      assert.ok(d.length <= 90, `descrição excede 90 chars (${d.length}): "${d}"`);
    }
  });

  it("nenhuma descrição termina com fragmento de URL/host (regressão tonic.phytogree.n)", () => {
    const { descriptions } = buildDeterministicRsa(input, "en");
    for (const d of descriptions) {
      assert.ok(
        !/\.[a-z]{1,2}$/i.test(d),
        `descrição "${d}" termina com fragmento de TLD (ex.: ".n"). O host devia ter caído por inteiro ou a descrição usar slug1.`,
      );
    }
  });

  it("inclui pelo menos algumas headlines com referência à marca (slug1='TonicGreens')", () => {
    const { headlines } = buildDeterministicRsa(input, "en");
    const withBrand = headlines.filter((h) => /tonicgreens/i.test(h));
    assert.ok(
      withBrand.length >= Math.ceil(headlines.length * 0.5),
      `≥50% das headlines deviam mencionar a marca; só ${withBrand.length}/${headlines.length} mencionam`,
    );
  });
});

describe("buildDeterministicRsa — marca curta (Acme, 4 chars)", () => {
  const input = {
    landingUrl: "https://acme.example.com",
    offer: "Acme",
    objective: "Drive sign-ups for the trial.",
  };

  it("ainda devolve ≥3 headlines e nenhum corte é feito porque tudo cabe", () => {
    const { headlines } = buildDeterministicRsa(input, "en");
    assert.ok(headlines.length >= 3);
    for (const h of headlines) {
      assert.ok(h.length <= 30);
    }
  });
});

describe("buildDeterministicRsa — sinais reais aproveitados em headlines", () => {
  it("usa preço/desconto/garantia/envio quando fornecidos", () => {
    const { headlines } = buildDeterministicRsa(
      {
        landingUrl: "https://acme.example.com",
        offer: "Acme",
        objective: "Drive sales.",
      },
      "en",
      {
        price: "$49",
        discount: "30% Off",
        guarantee: "60-day money back",
        shipping: "Free Shipping",
      },
    );
    /** Cap interno de 7 dynamic headlines garante variedade e impede que todos os sinais
     *  monopolizem os 12 slots — verificamos os de maior CTR (preço, desconto, garantia)
     *  que são os primeiros a serem emitidos. */
    const all = headlines.join(" | ");
    assert.match(all, /\$49/, "headline com preço deve estar presente");
    assert.match(all, /30%/, "headline com desconto deve estar presente");
    assert.match(all, /60-day money back/i, "headline com garantia deve estar presente");
  });
});
