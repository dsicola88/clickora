import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ensureShowAffiliateTrustFooterOnCreate,
  isAffiliateTrustFooterEnabled,
} from "./presellAffiliateTrustFooter";
import { extractPresellSignals } from "../compliance/extractPresellSignals";

describe("isAffiliateTrustFooterEnabled", () => {
  it("sem chave = desligado (opt-in)", () => {
    assert.equal(isAffiliateTrustFooterEnabled(undefined), false);
    assert.equal(isAffiliateTrustFooterEnabled({}), false);
  });

  it("false explícito = desligado", () => {
    assert.equal(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: false }), false);
    assert.equal(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: "false" }), false);
  });

  it("true explícito = ligado", () => {
    assert.equal(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: true }), true);
  });
});

describe("ensureShowAffiliateTrustFooterOnCreate", () => {
  it("grava false quando a chave falta", () => {
    const s = ensureShowAffiliateTrustFooterOnCreate({ businessName: "X" });
    assert.equal(s.showAffiliateTrustFooter, false);
  });

  it("não altera true/false já enviados", () => {
    assert.equal(
      ensureShowAffiliateTrustFooterOnCreate({ showAffiliateTrustFooter: true }).showAffiliateTrustFooter,
      true,
    );
    assert.equal(
      ensureShowAffiliateTrustFooterOnCreate({ showAffiliateTrustFooter: false }).showAffiliateTrustFooter,
      false,
    );
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

  it("ausente nos settings = false (opt-in)", () => {
    const s = extractPresellSignals({
      title: "X",
      content: { affiliate_link: "https://offer.example.com/a" },
      settings: { businessName: "A" },
    });
    assert.equal(s.showAffiliateTrustFooter, false);
  });
});
