import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAffiliateTrustFooterEnabled } from "./presellAffiliateTrustFooter";
import { extractPresellSignals } from "../compliance/extractPresellSignals";

describe("isAffiliateTrustFooterEnabled", () => {
  it("legado sem chave = ligado", () => {
    assert.equal(isAffiliateTrustFooterEnabled(undefined), true);
    assert.equal(isAffiliateTrustFooterEnabled({}), true);
  });

  it("false explícito = desligado", () => {
    assert.equal(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: false }), false);
    assert.equal(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: "false" }), false);
  });
});

describe("extractPresellSignals + rodapé", () => {
  it("propaga showAffiliateTrustFooter=false", () => {
    const s = extractPresellSignals({
      title: "X",
      content: { affiliate_link: "https://offer.example.com/a", sales_text: "texto ".repeat(40) },
      settings: { showAffiliateTrustFooter: false },
    });
    assert.equal(s.showAffiliateTrustFooter, false);
  });

  it("ausente nos settings = true (páginas antigas)", () => {
    const s = extractPresellSignals({
      title: "X",
      content: { affiliate_link: "https://offer.example.com/a" },
      settings: { businessName: "A" },
    });
    assert.equal(s.showAffiliateTrustFooter, true);
  });
});
